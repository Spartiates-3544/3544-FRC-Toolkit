package frc.lib.monitors;

import com.ctre.phoenix6.CANBus;
import com.ctre.phoenix6.hardware.TalonFX;
import edu.wpi.first.networktables.DoublePublisher;
import edu.wpi.first.networktables.DoubleSubscriber;
import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.StringPublisher;
import edu.wpi.first.networktables.StringSubscriber;
import edu.wpi.first.wpilibj.RobotController;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Generic robot health monitor. Tracks CAN bus health, CAN device status
 * (TalonFX), ethernet target reachability, and per-subsystem fault/warning
 * state. Publishes everything to NetworkTables under {@code /3544/Health}.
 *
 * All robot-specific configuration (CAN bus names, ethernet targets) is passed
 * in through the constructor so this class stays season-agnostic.
 *
 * Register TalonFX devices with {@link #registerTalonFX} and call
 * {@link #periodic(double)} once per robot loop.
 *
 * <h3>NT namespace</h3>
 * <pre>
 *   /3544/Health/Summary          — JSON summary (overall, counts, voltage)
 *   /3544/Health/Status           — JSON array of subsystem states
 *   /3544/Health/Faults           — semicolon-delimited fault strings
 *   /3544/Health/Warnings         — semicolon-delimited warning strings
 *   /3544/Health/CAN/Buses        — JSON array of CAN bus status objects
 *   /3544/Health/CAN/Devices      — JSON array of CAN device status objects
 *   /3544/Health/Ethernet/Targets — JSON array of ethernet target statuses
 *   /3544/Health/Events/Latest    — JSON of the most recent event
 * </pre>
 */
public class RobotHealthMonitor {

    // ── Configuration ────────────────────────────────────────────────────────

    /**
     * Describes one ethernet target to monitor. Port 0 means ICMP ping;
     * a positive port triggers a TCP connect check (e.g. 5800 for PhotonVision).
     */
    public record EthernetTarget(String name, String role, String host, int port, boolean enabled) {}

    // ── Timing constants ─────────────────────────────────────────────────────

    /** How often (in seconds) to poll CAN buses and devices. */
    private static final double POLL_PERIOD_SEC   = 0.5;
    /** TCP connect / ICMP timeout for ethernet checks. */
    private static final int    ETHERNET_TIMEOUT_MS = 250;

    // ── NT publishers ─────────────────────────────────────────────────────────
    private final StringPublisher summaryPublisher;
    private final StringPublisher statusPublisher;
    private final StringPublisher faultsPublisher;
    private final StringPublisher warningsPublisher;
    private final DoublePublisher canUtilizationPublisher;
    private final StringPublisher canBusesPublisher;
    private final StringPublisher canDevicesPublisher;
    private final StringPublisher ethernetTargetsPublisher;
    private final StringPublisher latestEventPublisher;
    private final DoublePublisher eventSeqPublisher;

    // NT subscribers (dashboard → robot)
    private final DoubleSubscriber ethernetTestRequest;
    private final StringSubscriber resetFaultsKey;
    private final DoubleSubscriber resetFaultsSeq;

    // ── Internal state ────────────────────────────────────────────────────────
    private final List<CanBusEntry>                  canBuses        = new ArrayList<>();
    private final List<HealthDevice>                 devices         = new ArrayList<>();
    private final List<EthernetEntry>                ethernetTargets = new ArrayList<>();
    private final Map<String, SubsystemIssue>        subsystemIssues     = new LinkedHashMap<>();
    private final Map<String, String>                lastSubsystemIssueKeys = new LinkedHashMap<>();
    private final Map<String, String>                lastDeviceFaults    = new LinkedHashMap<>();
    private final Map<String, String>                lastEthernetStatuses = new LinkedHashMap<>();

    private double pollAccumulator    = POLL_PERIOD_SEC; // fire immediately on first loop
    private double lastEthernetRequest = 0.0;
    private double lastResetFaultsSeq  = 0.0;
    private int    eventSeq            = 0;
    private Thread ethernetCheckThread = null;

    // ── Constructor ───────────────────────────────────────────────────────────

    /**
     * Creates a health monitor with the given configuration.
     *
     * @param canBusNames      CAN bus names to monitor (e.g. {@code "rio"}, {@code "canivore"}).
     *                         If empty, falls back to the roboRIO bus.
     * @param ethernetTargets  Ethernet hosts to check. Use {@link EthernetTarget}.
     */
    public RobotHealthMonitor(String[] canBusNames, EthernetTarget[] ethernetTargets) {
        NetworkTable health = NetworkTableInstance.getDefault()
                .getTable("3544").getSubTable("Health");

        summaryPublisher          = health.getStringTopic("Summary").publish();
        statusPublisher           = health.getStringTopic("Status").publish();
        faultsPublisher           = health.getStringTopic("Faults").publish();
        warningsPublisher         = health.getStringTopic("Warnings").publish();
        canUtilizationPublisher   = health.getSubTable("CAN").getDoubleTopic("Utilization").publish();
        canBusesPublisher         = health.getSubTable("CAN").getStringTopic("Buses").publish();
        canDevicesPublisher       = health.getSubTable("CAN").getStringTopic("Devices").publish();
        ethernetTargetsPublisher  = health.getSubTable("Ethernet").getStringTopic("Targets").publish();
        latestEventPublisher      = health.getSubTable("Events").getStringTopic("Latest").publish();
        eventSeqPublisher         = health.getSubTable("Events").getDoubleTopic("Seq").publish();

        // Dashboard-driven requests
        ethernetTestRequest = health.getSubTable("Ethernet").getDoubleTopic("TestRequest").subscribe(0.0);
        resetFaultsKey      = health.getSubTable("CAN").getStringTopic("ResetFaults").subscribe("");
        resetFaultsSeq      = health.getSubTable("CAN").getDoubleTopic("ResetFaultsSeq").subscribe(0.0);

        // Initialise CAN bus entries
        for (String bus : canBusNames) {
            String normalized = normalizeBus(bus);
            this.canBuses.add(new CanBusEntry(normalized, new CANBus(normalized)));
        }
        if (this.canBuses.isEmpty()) {
            this.canBuses.add(new CanBusEntry("rio", CANBus.roboRIO()));
        }

        // Initialise ethernet target entries
        for (EthernetTarget target : ethernetTargets) {
            this.ethernetTargets.add(new EthernetEntry(
                    target.name(), target.role(), target.host(), target.port(), target.enabled()));
        }

        publishEvent("info", "RobotHealth", "startup", "Robot health monitor started", "", "");
    }

    // ── Device registration ───────────────────────────────────────────────────

    /**
     * Registers a TalonFX motor for health monitoring.
     *
     * @param subsystem Subsystem name (e.g. "Shooter")
     * @param name      Motor name within the subsystem (e.g. "TopMotor")
     * @param canId     CAN device ID
     * @param bus       CAN bus name (empty string = "rio")
     * @param talon     The TalonFX hardware object
     */
    public void registerTalonFX(String subsystem, String name, int canId, String bus, TalonFX talon) {
        devices.add(new TalonFxDevice(subsystem, name, canId, normalizeBus(bus), talon));
    }

    // ── Subsystem state updates ───────────────────────────────────────────────

    /**
     * Reports the current state of a subsystem. Call once per periodic loop
     * for each subsystem so health events are published promptly.
     *
     * @param name    Subsystem name matching the name used in registration
     * @param ready   Whether the subsystem is at its setpoint / ready to operate
     * @param state   Current state-machine state string
     * @param fault   Active fault description (empty = none)
     * @param warning Active warning description (empty = none)
     */
    public void updateSubsystem(String name, boolean ready, String state, String fault, String warning) {
        SubsystemIssue issue = new SubsystemIssue(name, ready, state, clean(fault), clean(warning));
        subsystemIssues.put(name, issue);

        String issueKey = issue.fault + "|" + issue.warning + "|" + issue.ready + "|" + issue.state;
        String previous = lastSubsystemIssueKeys.put(name, issueKey);

        // Only emit an event when something actually changed
        if (previous != null && !issueKey.equals(previous)) {
            if (!issue.fault.isEmpty()) {
                publishEvent("error",   name, "subsystem", "Subsystem fault",    issue.fault,  name);
            } else if (!issue.warning.isEmpty()) {
                publishEvent("warning", name, "subsystem", "Subsystem warning",  issue.warning, name);
            } else if (!issue.ready) {
                publishEvent("warning", name, "subsystem", "Subsystem not ready", issue.state, name);
            } else {
                publishEvent("info",    name, "subsystem", "Subsystem recovered", issue.state, name);
            }
        }
    }

    // ── Periodic ──────────────────────────────────────────────────────────────

    /**
     * Must be called once per robot loop. Polls CAN buses and devices at
     * {@link #POLL_PERIOD_SEC} intervals and handles dashboard requests.
     *
     * @param dtSeconds Loop period in seconds (typically 0.02)
     */
    public void periodic(double dtSeconds) {
        pollAccumulator += dtSeconds;

        // Check if the dashboard requested an ethernet test
        double request = ethernetTestRequest.get(0.0);
        boolean shouldTestEthernet = request > lastEthernetRequest;
        if (shouldTestEthernet) {
            lastEthernetRequest = request;
        }

        // Check if the dashboard requested a sticky fault clear
        double resetSeq = resetFaultsSeq.get(0.0);
        if (resetSeq > lastResetFaultsSeq) {
            lastResetFaultsSeq = resetSeq;
            handleResetStickyFaults(resetFaultsKey.get(""));
        }

        if (pollAccumulator >= POLL_PERIOD_SEC || shouldTestEthernet) {
            pollAccumulator = 0.0;
            pollCanBuses();
            pollDevices();
            if (shouldTestEthernet) {
                pollEthernetTargetsAsync();
            } else {
                publishEthernetTargets();
            }
            publishAll();
        }
    }

    // ── Snapshot accessors (for RobotTestManager) ─────────────────────────────

    /** Returns an immutable snapshot of all registered CAN device statuses. */
    public List<DeviceSnapshot> getDeviceSnapshots() {
        List<DeviceSnapshot> result = new ArrayList<>(devices.size());
        for (HealthDevice d : devices) result.add(new DeviceSnapshot(d));
        return result;
    }

    /** Returns an immutable snapshot of all ethernet target statuses. */
    public List<EthernetSnapshot> getEthernetSnapshots() {
        List<EthernetSnapshot> result = new ArrayList<>(ethernetTargets.size());
        for (EthernetEntry e : ethernetTargets) result.add(new EthernetSnapshot(e));
        return result;
    }

    /** Returns an immutable snapshot of all subsystem health states. */
    public List<SubsystemSnapshot> getSubsystemSnapshots() {
        List<SubsystemSnapshot> result = new ArrayList<>(subsystemIssues.size());
        for (SubsystemIssue s : subsystemIssues.values()) result.add(new SubsystemSnapshot(s));
        return result;
    }

    // ── Public snapshot types ─────────────────────────────────────────────────

    /** Read-only view of a registered CAN device at a point in time. */
    public static class DeviceSnapshot {
        public final String       subsystem;
        public final String       name;
        public final String       type;
        public final boolean      online;
        public final double       temperatureC;
        public final List<String> activeFaults;
        public final List<String> stickyFaults;

        DeviceSnapshot(HealthDevice d) {
            this.subsystem    = d.subsystem;
            this.name         = d.name;
            this.type         = d.type;
            this.online       = d.online;
            this.temperatureC = d.temperatureC;
            this.activeFaults = List.copyOf(d.activeFaults);
            this.stickyFaults = List.copyOf(d.stickyFaults);
        }
    }

    /** Read-only view of an ethernet target at a point in time. */
    public static class EthernetSnapshot {
        public final String name;
        public final String role;
        public final String status;

        EthernetSnapshot(EthernetEntry e) {
            this.name   = e.name;
            this.role   = e.role;
            this.status = e.status;
        }
    }

    /** Read-only view of a subsystem's health state at a point in time. */
    public static class SubsystemSnapshot {
        public final String  name;
        public final boolean ready;
        public final String  state;
        public final String  fault;

        SubsystemSnapshot(SubsystemIssue s) {
            this.name  = s.name;
            this.ready = s.ready;
            this.state = s.state;
            this.fault = s.fault;
        }
    }

    // ── Private polling ───────────────────────────────────────────────────────

    private void handleResetStickyFaults(String deviceKey) {
        boolean all = "__all__".equals(deviceKey) || deviceKey.isBlank();
        for (HealthDevice device : devices) {
            if (all || (device.subsystem + "/" + device.name).equals(deviceKey)) {
                device.clearStickyFaults();
            }
        }
        publishEvent("info",
                deviceKey.isBlank() || all ? "all" : deviceKey,
                "can", "Sticky faults cleared",
                all ? "All devices" : deviceKey, "");
    }

    private void pollCanBuses() {
        for (CanBusEntry entry : canBuses) {
            try {
                CANBus.CANBusStatus status = entry.bus.getStatus();
                entry.status      = status.Status.toString();
                entry.ok          = status.Status.isOK();
                entry.utilization = status.BusUtilization;
                entry.busOffCount = status.BusOffCount;
                entry.txFullCount = status.TxFullCount;
                entry.rec         = status.REC;
                entry.tec         = status.TEC;
                entry.fd          = entry.bus.isNetworkFD();
            } catch (RuntimeException ex) {
                entry.ok     = false;
                entry.status = ex.getClass().getSimpleName();
            }
        }
    }

    private void pollDevices() {
        for (HealthDevice device : devices) {
            device.poll();
            String key      = device.subsystem + "/" + device.name;
            String faultKey = String.join("|", device.activeFaults);
            String previous = lastDeviceFaults.put(key, faultKey);
            if (!faultKey.equals(previous) && !faultKey.isEmpty()) {
                publishEvent("error", key, "can", "CAN device fault", faultKey, device.subsystem);
            }
        }
    }

    private void pollEthernetTargetsAsync() {
        if (ethernetCheckThread != null && ethernetCheckThread.isAlive()) return;

        // Mark all enabled targets as "checking" and publish immediately so
        // the dashboard shows a spinner while the async check runs
        for (EthernetEntry target : ethernetTargets) {
            if (target.enabled) target.status = "checking";
        }
        publishEthernetTargets();

        ethernetCheckThread = new Thread(() -> {
            for (EthernetEntry target : ethernetTargets) {
                if (!target.enabled) {
                    target.status    = "disabled";
                    target.latencyMs = -1;
                    target.error     = "";
                    publishEthernetTargets();
                    continue;
                }

                long started = System.nanoTime();
                try {
                    boolean reachable;
                    if (target.port > 0) {
                        try (Socket sock = new Socket()) {
                            sock.connect(new InetSocketAddress(target.host, target.port), ETHERNET_TIMEOUT_MS);
                            reachable = true;
                        }
                    } else {
                        reachable = InetAddress.getByName(target.host).isReachable(ETHERNET_TIMEOUT_MS);
                    }
                    target.latencyMs = (System.nanoTime() - started) / 1_000_000.0;
                    target.status    = reachable ? "online" : "offline";
                    target.error     = reachable ? "" : "No response";
                } catch (Exception ex) {
                    target.latencyMs = -1;
                    target.status    = "offline";
                    target.error     = ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName();
                }
                target.lastCheckedMs = System.currentTimeMillis();

                String previous = lastEthernetStatuses.put(target.name, target.status);
                if (previous != null && !target.status.equals(previous)) {
                    String level = "online".equals(target.status) ? "info" : "warning";
                    publishEvent(level, target.name, "ethernet",
                            "Ethernet target " + target.status, target.error, "");
                }

                // Update NT after each target so the dashboard shows incremental results
                publishEthernetTargets();
            }
        }, "ethernet-check");
        ethernetCheckThread.setDaemon(true);
        ethernetCheckThread.start();
    }

    // ── NT publishing ─────────────────────────────────────────────────────────

    private void publishAll() {
        List<String> faults   = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        int subsystemIssueCount = 0;
        int canDeviceFaults = 0;
        int canBusFaults    = 0;
        int ethernetFaults  = 0;

        // Subsystem issues
        for (SubsystemIssue issue : subsystemIssues.values()) {
            if (!issue.fault.isEmpty()) {
                faults.add(issue.name + ": " + issue.fault);
                subsystemIssueCount++;
            }
            if (!issue.warning.isEmpty()) {
                warnings.add(issue.name + ": " + issue.warning);
                subsystemIssueCount++;
            }
            if (!issue.ready) {
                warnings.add(issue.name + ": not ready (" + issue.state + ")");
            }
        }

        // CAN buses
        for (CanBusEntry bus : canBuses) {
            if (!bus.ok) {
                canBusFaults++;
                faults.add("CAN bus " + bus.name + ": " + bus.status);
            } else if (bus.utilization > 0.90) {
                warnings.add(String.format("CAN bus %s high utilization: %.1f%%",
                        bus.name, bus.utilization * 100.0));
            }
        }

        // CAN devices
        for (HealthDevice device : devices) {
            if (!device.online) {
                canDeviceFaults++;
                faults.add(device.subsystem + "/" + device.name + ": offline");
            }
            for (String fault : device.activeFaults) {
                canDeviceFaults++;
                faults.add(device.subsystem + "/" + device.name + ": " + fault);
            }
            for (String fault : device.stickyFaults) {
                warnings.add(device.subsystem + "/" + device.name + " sticky: " + fault);
            }
        }

        // Ethernet targets
        for (EthernetEntry target : ethernetTargets) {
            if (target.enabled && ("offline".equals(target.status) || "error".equals(target.status))) {
                ethernetFaults++;
                warnings.add(target.name + ": " + target.status);
            }
        }

        double canUtilization = canBuses.isEmpty()
                ? RobotController.getCANStatus().percentBusUtilization
                : canBuses.get(0).utilization;

        canUtilizationPublisher.set(canUtilization);
        faultsPublisher.set(String.join("; ", faults));
        warningsPublisher.set(String.join("; ", warnings));
        statusPublisher.set(subsystemsJson());
        canBusesPublisher.set(canBusesJson());
        canDevicesPublisher.set(devicesJson());
        publishEthernetTargets();

        String overall = faults.isEmpty() ? (warnings.isEmpty() ? "healthy" : "warning") : "fault";
        summaryPublisher.set("{"
                + jsonPair("overall",              overall)             + ","
                + jsonPair("timestampMs",          System.currentTimeMillis()) + ","
                + jsonPair("batteryVoltage",       RobotController.getBatteryVoltage()) + ","
                + jsonPair("faultCount",           faults.size())       + ","
                + jsonPair("warningCount",         warnings.size())     + ","
                + jsonPair("subsystemIssueCount",  subsystemIssueCount) + ","
                + jsonPair("canBusCount",          canBuses.size())     + ","
                + jsonPair("canBusFaultCount",     canBusFaults)        + ","
                + jsonPair("canDeviceCount",       devices.size())      + ","
                + jsonPair("canDeviceFaultCount",  canDeviceFaults)     + ","
                + jsonPair("ethernetTargetCount",  ethernetTargets.size()) + ","
                + jsonPair("ethernetFaultCount",   ethernetFaults)
                + "}");
    }

    private void publishEthernetTargets() {
        ethernetTargetsPublisher.set(ethernetJson());
    }

    private void publishEvent(String level, String source, String category,
                              String message, String detail, String related) {
        eventSeq++;
        String event = "{"
                + jsonPair("timestamp", System.currentTimeMillis()) + ","
                + jsonPair("level",     level)                      + ","
                + jsonPair("source",    source)                     + ","
                + jsonPair("category",  category)                   + ","
                + jsonPair("message",   message)                    + ","
                + jsonPair("detail",    detail)                     + ","
                + jsonPair("related",   related)
                + "}";
        latestEventPublisher.set(event);
        eventSeqPublisher.set(eventSeq);
    }

    // ── JSON serialisers ──────────────────────────────────────────────────────

    private String subsystemsJson() {
        StringBuilder sb = new StringBuilder("[");
        int index = 0;
        for (SubsystemIssue issue : subsystemIssues.values()) {
            if (index++ > 0) sb.append(",");
            String detail = !issue.fault.isEmpty() ? issue.fault : issue.warning;
            sb.append("{")
              .append(jsonPair("name",    issue.name)).append(",")
              .append(jsonPair("ready",   issue.ready)).append(",")
              .append(jsonPair("state",   issue.state)).append(",")
              .append(jsonPair("detail",  detail)).append(",")
              .append(jsonPair("fault",   issue.fault)).append(",")
              .append(jsonPair("warning", issue.warning))
              .append("}");
        }
        return sb.append("]").toString();
    }

    private String canBusesJson() {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < canBuses.size(); i++) {
            CanBusEntry bus = canBuses.get(i);
            if (i > 0) sb.append(",");
            sb.append("{")
              .append(jsonPair("name",        bus.name)).append(",")
              .append(jsonPair("status",      bus.status)).append(",")
              .append(jsonPair("ok",          bus.ok)).append(",")
              .append(jsonPair("fd",          bus.fd)).append(",")
              .append(jsonPair("utilization", bus.utilization)).append(",")
              .append(jsonPair("busOffCount", bus.busOffCount)).append(",")
              .append(jsonPair("txFullCount", bus.txFullCount)).append(",")
              .append(jsonPair("rec",         bus.rec)).append(",")
              .append(jsonPair("tec",         bus.tec))
              .append("}");
        }
        return sb.append("]").toString();
    }

    private String devicesJson() {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < devices.size(); i++) {
            HealthDevice device = devices.get(i);
            if (i > 0) sb.append(",");
            sb.append("{")
              .append(jsonPair("name",          device.name)).append(",")
              .append(jsonPair("subsystem",     device.subsystem)).append(",")
              .append(jsonPair("type",          device.type)).append(",")
              .append(jsonPair("canId",         device.canId)).append(",")
              .append(jsonPair("bus",           device.bus)).append(",")
              .append(jsonPair("online",        device.online)).append(",")
              .append(jsonPair("firmware",      device.firmware)).append(",")
              .append(jsonPair("supplyVoltage", device.supplyVoltage)).append(",")
              .append(jsonPair("temperatureC",  device.temperatureC)).append(",")
              .append(jsonPair("lastUpdateMs",  device.lastUpdateMs)).append(",")
              .append("\"activeFaults\":").append(stringArray(device.activeFaults)).append(",")
              .append("\"stickyFaults\":").append(stringArray(device.stickyFaults))
              .append("}");
        }
        return sb.append("]").toString();
    }

    private String ethernetJson() {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < ethernetTargets.size(); i++) {
            EthernetEntry target = ethernetTargets.get(i);
            if (i > 0) sb.append(",");
            sb.append("{")
              .append(jsonPair("name",          target.name)).append(",")
              .append(jsonPair("role",          target.role)).append(",")
              .append(jsonPair("host",          target.host)).append(",")
              .append(jsonPair("enabled",       target.enabled)).append(",")
              .append(jsonPair("status",        target.status)).append(",")
              .append(jsonPair("latencyMs",     target.latencyMs)).append(",")
              .append(jsonPair("lastCheckedMs", target.lastCheckedMs)).append(",")
              .append(jsonPair("error",         target.error))
              .append("}");
        }
        return sb.append("]").toString();
    }

    // ── JSON helpers ──────────────────────────────────────────────────────────

    private static String normalizeBus(String bus) {
        return bus == null || bus.isBlank() ? "rio" : bus;
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static String stringArray(List<String> values) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(esc(values.get(i))).append("\"");
        }
        return sb.append("]").toString();
    }

    private static String jsonPair(String key, String value) {
        return "\"" + key + "\":\"" + esc(value) + "\"";
    }

    private static String jsonPair(String key, boolean value) {
        return "\"" + key + "\":" + value;
    }

    private static String jsonPair(String key, int value) {
        return "\"" + key + "\":" + value;
    }

    private static String jsonPair(String key, long value) {
        return "\"" + key + "\":" + value;
    }

    private static String jsonPair(String key, double value) {
        if (Double.isNaN(value) || Double.isInfinite(value)) {
            return "\"" + key + "\":null";
        }
        return "\"" + key + "\":" + value;
    }

    private static String esc(String v) {
        return clean(v).replace("\\", "\\\\").replace("\"", "\\\"");
    }

    // ── Private inner types ───────────────────────────────────────────────────

    private static class CanBusEntry {
        final String  name;
        final CANBus  bus;
        String  status      = "unknown";
        boolean ok          = true;
        boolean fd          = false;
        double  utilization = 0.0;
        int     busOffCount = 0;
        int     txFullCount = 0;
        int     rec         = 0;
        int     tec         = 0;

        CanBusEntry(String name, CANBus bus) {
            this.name = name;
            this.bus  = bus;
        }
    }

    private static class EthernetEntry {
        final String  name;
        final String  role;
        final String  host;
        final int     port;
        final boolean enabled;
        String status       = "pending";
        double latencyMs    = -1;
        long   lastCheckedMs = 0;
        String error        = "";

        EthernetEntry(String name, String role, String host, int port, boolean enabled) {
            this.name    = name;
            this.role    = role;
            this.host    = host;
            this.port    = port;
            this.enabled = enabled;
        }
    }

    private static class SubsystemIssue {
        final String  name;
        final boolean ready;
        final String  state;
        final String  fault;
        final String  warning;

        SubsystemIssue(String name, boolean ready, String state, String fault, String warning) {
            this.name    = name;
            this.ready   = ready;
            this.state   = clean(state);
            this.fault   = fault;
            this.warning = warning;
        }
    }

    // ── HealthDevice abstraction ──────────────────────────────────────────────

    private abstract static class HealthDevice {
        final String subsystem;
        final String name;
        final String type;
        final int    canId;
        final String bus;
        boolean      online        = false;
        String       firmware      = "";
        double       supplyVoltage = 0.0;
        double       temperatureC  = 0.0;
        long         lastUpdateMs  = 0;
        final List<String> activeFaults = new ArrayList<>();
        final List<String> stickyFaults = new ArrayList<>();

        HealthDevice(String subsystem, String name, String type, int canId, String bus) {
            this.subsystem = subsystem;
            this.name      = name;
            this.type      = type;
            this.canId     = canId;
            this.bus       = bus;
        }

        abstract void poll();
        abstract void clearStickyFaults();
    }

    // ── TalonFX device implementation ─────────────────────────────────────────

    private static class TalonFxDevice extends HealthDevice {
        final TalonFX talon;

        TalonFxDevice(String subsystem, String name, int canId, String bus, TalonFX talon) {
            super(subsystem, name, "TalonFX", canId, bus);
            this.talon = talon;
        }

        @Override
        void poll() {
            activeFaults.clear();
            stickyFaults.clear();
            try {
                var version = talon.getVersion().refresh(false);
                var voltage = talon.getSupplyVoltage().refresh(false);
                var temp    = talon.getDeviceTemp().refresh(false);

                online        = version.getStatus().isOK() || voltage.getStatus().isOK() || temp.getStatus().isOK();
                firmware      = version.getStatus().isOK() ? versionString((int) version.getValueAsDouble()) : "";
                supplyVoltage = voltage.getStatus().isOK() ? voltage.getValueAsDouble() : 0.0;
                temperatureC  = temp.getStatus().isOK()    ? temp.getValueAsDouble()    : 0.0;

                // Active faults
                addFault(activeFaults, "Hardware",            talon.getFault_Hardware(false).refresh(false).getValue());
                addFault(activeFaults, "Processor temperature", talon.getFault_ProcTemp(false).refresh(false).getValue());
                addFault(activeFaults, "Device temperature",  talon.getFault_DeviceTemp(false).refresh(false).getValue());
                addFault(activeFaults, "Undervoltage",        talon.getFault_Undervoltage(false).refresh(false).getValue());
                addFault(activeFaults, "Boot during enable",  talon.getFault_BootDuringEnable(false).refresh(false).getValue());
                addFault(activeFaults, "Bridge brownout",     talon.getFault_BridgeBrownout(false).refresh(false).getValue());
                addFault(activeFaults, "Unstable supply",     talon.getFault_UnstableSupplyV(false).refresh(false).getValue());
                addFault(activeFaults, "Stator current limit", talon.getFault_StatorCurrLimit(false).refresh(false).getValue());
                addFault(activeFaults, "Supply current limit", talon.getFault_SupplyCurrLimit(false).refresh(false).getValue());
                addFault(activeFaults, "Static brake disabled", talon.getFault_StaticBrakeDisabled(false).refresh(false).getValue());
                addFault(activeFaults, "Rotor fault 1",       talon.getFault_RotorFault1(false).refresh(false).getValue());
                addFault(activeFaults, "Rotor fault 2",       talon.getFault_RotorFault2(false).refresh(false).getValue());

                // Sticky faults
                addFault(stickyFaults, "Hardware",            talon.getStickyFault_Hardware(false).refresh(false).getValue());
                addFault(stickyFaults, "Processor temperature", talon.getStickyFault_ProcTemp(false).refresh(false).getValue());
                addFault(stickyFaults, "Device temperature",  talon.getStickyFault_DeviceTemp(false).refresh(false).getValue());
                addFault(stickyFaults, "Undervoltage",        talon.getStickyFault_Undervoltage(false).refresh(false).getValue());
                addFault(stickyFaults, "Boot during enable",  talon.getStickyFault_BootDuringEnable(false).refresh(false).getValue());
                addFault(stickyFaults, "Bridge brownout",     talon.getStickyFault_BridgeBrownout(false).refresh(false).getValue());
                addFault(stickyFaults, "Unstable supply",     talon.getStickyFault_UnstableSupplyV(false).refresh(false).getValue());
                addFault(stickyFaults, "Stator current limit", talon.getStickyFault_StatorCurrLimit(false).refresh(false).getValue());
                addFault(stickyFaults, "Supply current limit", talon.getStickyFault_SupplyCurrLimit(false).refresh(false).getValue());
                addFault(stickyFaults, "Static brake disabled", talon.getStickyFault_StaticBrakeDisabled(false).refresh(false).getValue());
                addFault(stickyFaults, "Rotor fault 1",       talon.getStickyFault_RotorFault1(false).refresh(false).getValue());
                addFault(stickyFaults, "Rotor fault 2",       talon.getStickyFault_RotorFault2(false).refresh(false).getValue());

            } catch (RuntimeException ex) {
                online = false;
                activeFaults.add(ex.getClass().getSimpleName());
            }
            lastUpdateMs = System.currentTimeMillis();
        }

        @Override
        void clearStickyFaults() {
            try {
                talon.clearStickyFaults();
            } catch (RuntimeException ignored) {}
        }

        private static void addFault(List<String> faults, String label, Boolean active) {
            if (Boolean.TRUE.equals(active)) faults.add(label);
        }

        /** Converts a packed Phoenix 6 version integer to a readable "major.minor.bugfix.build" string. */
        private static String versionString(int version) {
            int major  = (version >> 24) & 0xFF;
            int minor  = (version >> 16) & 0xFF;
            int bugfix = (version >> 8)  & 0xFF;
            int build  =  version        & 0xFF;
            return major + "." + minor + "." + bugfix + "." + build;
        }
    }
}
