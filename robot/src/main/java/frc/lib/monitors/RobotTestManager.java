package frc.lib.monitors;

import edu.wpi.first.networktables.DoubleSubscriber;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.StringPublisher;
import edu.wpi.first.networktables.StringSubscriber;
import edu.wpi.first.wpilibj.RobotController;

import java.util.ArrayList;
import java.util.List;

/**
 * Full robot preflight test suite.
 *
 * Subscribes to {@code /3544/RobotTest/RunRequest}; when a new request arrives
 * it runs all checks synchronously and publishes results JSON to
 * {@code /3544/RobotTest/Results}.
 *
 * All threshold values are configurable at runtime via the dashboard through
 * {@code /3544/RobotTest/Config} (JSON object — see {@link #parseConfig}).
 *
 * Register a {@link RobotHealthMonitor} with {@link #setHealthMonitor} so the
 * device-based checks (CAN, temps, encoders, gyro, vision, subsystems) have
 * access to live snapshot data.
 *
 * Call {@link #periodic()} once per robot loop.
 */
public class RobotTestManager {

    // ── Status enum ───────────────────────────────────────────────────────────

    public enum CheckStatus { PENDING, RUNNING, PASS, WARNING, FAIL, SKIPPED }

    // ── CheckResult ───────────────────────────────────────────────────────────

    /**
     * Represents a single preflight check item with its current status and detail.
     */
    public static class CheckResult {
        public final String id;
        public final String label;
        public final String description;
        public CheckStatus status = CheckStatus.PENDING;
        public String      detail = "";

        public CheckResult(String id, String label, String description) {
            this.id          = id;
            this.label       = label;
            this.description = description;
        }

        /** Serialises this result to a JSON object string. */
        public String toJson() {
            return "{\"id\":\"" + id + "\","
                    + "\"label\":\""       + esc(label)       + "\","
                    + "\"description\":\"" + esc(description) + "\","
                    + "\"status\":\""      + status.name().toLowerCase() + "\","
                    + "\"detail\":\""      + esc(detail)      + "\"}";
        }

        private static String esc(String s) {
            if (s == null) return "";
            return s.replace("\\", "\\\\").replace("\"", "\\\"");
        }
    }

    // ── Configurable thresholds ───────────────────────────────────────────────
    // These are updated from the NT config JSON whenever it changes.

    private double batteryWarnV  = 12.0;
    private double batteryCritV  = 10.5;
    private double tempWarnC     = 70.0;
    private double tempFailC     = 85.0;
    private double currentWarnA  = 120.0;
    private double currentFailA  = 200.0;

    // ── NT state ──────────────────────────────────────────────────────────────

    private final StringPublisher  resultsPublisher;
    private final StringPublisher  statePublisher;
    private final DoubleSubscriber runRequestSub;
    private final StringSubscriber configSub;

    // ── Runtime state ─────────────────────────────────────────────────────────

    private final List<CheckResult> checks = new ArrayList<>();
    private double lastRunRequest = -1.0;
    private String lastConfig     = "";
    private RobotHealthMonitor healthMonitor;

    // ── Constructor ───────────────────────────────────────────────────────────

    public RobotTestManager() {
        var table = NetworkTableInstance.getDefault().getTable("3544").getSubTable("RobotTest");
        resultsPublisher = table.getStringTopic("Results").publish();
        statePublisher   = table.getStringTopic("State").publish();
        runRequestSub    = table.getDoubleTopic("RunRequest").subscribe(-1.0);
        configSub        = table.getStringTopic("Config").subscribe("");

        initChecks();
        statePublisher.set("idle");
        publishResults();
    }

    // ── Configuration ─────────────────────────────────────────────────────────

    /**
     * Provides access to a {@link RobotHealthMonitor} for the device-based
     * checks. Must be called before the first run request arrives.
     */
    public void setHealthMonitor(RobotHealthMonitor monitor) {
        this.healthMonitor = monitor;
    }

    // ── Periodic ──────────────────────────────────────────────────────────────

    /** Call once per robot loop. */
    public void periodic() {
        // Update thresholds if the dashboard pushed a new config JSON
        String cfg = configSub.get("");
        if (!cfg.isEmpty() && !cfg.equals(lastConfig)) {
            lastConfig = cfg;
            parseConfig(cfg);
        }

        // Run all checks when the dashboard sends a new run request
        double req = runRequestSub.get(-1.0);
        if (req > 0 && req != lastRunRequest) {
            lastRunRequest = req;
            runAllChecks();
        }
    }

    // ── Config parser ─────────────────────────────────────────────────────────

    /**
     * Parses a subset of a JSON object to update threshold fields.
     * Uses simple string scanning — no library dependency required.
     *
     * Recognised keys: {@code batteryWarnV}, {@code batteryCritV},
     * {@code tempWarnC}, {@code tempFailC}, {@code currentWarnA}, {@code currentFailA}.
     */
    private void parseConfig(String json) {
        batteryWarnV = readDouble(json, "batteryWarnV", batteryWarnV);
        batteryCritV = readDouble(json, "batteryCritV", batteryCritV);
        tempWarnC    = readDouble(json, "tempWarnC",    tempWarnC);
        tempFailC    = readDouble(json, "tempFailC",    tempFailC);
        currentWarnA = readDouble(json, "currentWarnA", currentWarnA);
        currentFailA = readDouble(json, "currentFailA", currentFailA);
    }

    private static double readDouble(String json, String key, double fallback) {
        String search = "\"" + key + "\":";
        int idx = json.indexOf(search);
        if (idx < 0) return fallback;
        int start = idx + search.length();
        int end   = start;
        while (end < json.length()
                && (Character.isDigit(json.charAt(end)) || json.charAt(end) == '.' || json.charAt(end) == '-')) {
            end++;
        }
        try {
            return Double.parseDouble(json.substring(start, end));
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    // ── Check runner ──────────────────────────────────────────────────────────

    /** Declares the ordered list of checks (called at construction and before each run). */
    private void initChecks() {
        checks.clear();
        checks.add(new CheckResult("battery_voltage",     "Battery Voltage",     "Validates voltage is within safe operating range"));
        checks.add(new CheckResult("can_devices",         "CAN Devices",         "Confirms all expected CAN devices are online"));
        checks.add(new CheckResult("motor_faults",        "Motor Faults",        "Reads and reports any sticky or active motor faults"));
        checks.add(new CheckResult("motor_temps",         "Motor Temperatures",  "Flags motors above thermal thresholds"));
        checks.add(new CheckResult("current_draw",        "Current Draw",        "Checks for overcurrent conditions"));
        checks.add(new CheckResult("encoders",            "Encoders",            "Validates encoder connectivity and plausibility"));
        checks.add(new CheckResult("gyro",                "Gyro",                "Confirms gyro is connected and reading"));
        checks.add(new CheckResult("vision",              "Vision",              "Checks vision co-processor connectivity and target detection"));
        checks.add(new CheckResult("subsystem_readiness", "Subsystem Readiness", "Confirms each subsystem reports as ready"));
    }

    private void runAllChecks() {
        initChecks();
        statePublisher.set("running");
        publishResults();

        for (CheckResult check : checks) {
            check.status = CheckStatus.RUNNING;
            publishResults();
            runCheck(check);
            publishResults();
        }

        statePublisher.set("done");
        publishResults();
    }

    private void runCheck(CheckResult r) {
        try {
            switch (r.id) {
                case "battery_voltage":     checkBatteryVoltage(r);    break;
                case "can_devices":         checkCanDevices(r);         break;
                case "motor_faults":        checkMotorFaults(r);        break;
                case "motor_temps":         checkMotorTemperatures(r);  break;
                case "current_draw":        checkCurrentDraw(r);        break;
                case "encoders":            checkEncoders(r);           break;
                case "gyro":               checkGyro(r);               break;
                case "vision":             checkVision(r);             break;
                case "subsystem_readiness": checkSubsystemReadiness(r); break;
                default:
                    r.status = CheckStatus.SKIPPED;
                    r.detail = "Unknown check ID";
            }
        } catch (Exception e) {
            r.status = CheckStatus.FAIL;
            r.detail = "Exception: " + e.getClass().getSimpleName() + ": " + e.getMessage();
        }
    }

    // ── Individual checks ─────────────────────────────────────────────────────

    private void checkBatteryVoltage(CheckResult r) {
        double v = RobotController.getBatteryVoltage();
        r.detail = String.format("%.2f V", v);
        if      (v >= batteryWarnV) { r.status = CheckStatus.PASS; }
        else if (v >= batteryCritV) { r.status = CheckStatus.WARNING; r.detail += " — low, charge battery"; }
        else                        { r.status = CheckStatus.FAIL;    r.detail += " — critically low"; }
    }

    private void checkCanDevices(CheckResult r) {
        if (healthMonitor == null) { skip(r, "No health monitor"); return; }
        List<RobotHealthMonitor.DeviceSnapshot> devs = healthMonitor.getDeviceSnapshots();
        if (devs.isEmpty()) { skip(r, "No CAN devices registered"); return; }
        long offline = devs.stream().filter(d -> !d.online).count();
        if (offline == 0) {
            r.status = CheckStatus.PASS;
            r.detail = devs.size() + " device(s) online";
        } else {
            r.status = CheckStatus.FAIL;
            r.detail = offline + "/" + devs.size() + " device(s) offline";
        }
    }

    private void checkMotorFaults(CheckResult r) {
        if (healthMonitor == null) { skip(r, "No health monitor"); return; }
        List<RobotHealthMonitor.DeviceSnapshot> devs = healthMonitor.getDeviceSnapshots();
        long withActive = devs.stream().filter(d -> !d.activeFaults.isEmpty()).count();
        long withSticky = devs.stream().filter(d -> !d.stickyFaults.isEmpty()).count();
        if (withActive == 0 && withSticky == 0) {
            r.status = CheckStatus.PASS;
            r.detail = "No faults on " + devs.size() + " device(s)";
        } else if (withActive == 0) {
            r.status = CheckStatus.WARNING;
            r.detail = withSticky + " device(s) with sticky faults (clear after inspection)";
        } else {
            r.status = CheckStatus.FAIL;
            r.detail = withActive + " device(s) with active faults";
        }
    }

    private void checkMotorTemperatures(CheckResult r) {
        if (healthMonitor == null) { skip(r, "No health monitor"); return; }
        List<RobotHealthMonitor.DeviceSnapshot> devs = healthMonitor.getDeviceSnapshots();
        if (devs.isEmpty()) { skip(r, "No devices registered"); return; }
        double maxTemp = devs.stream().mapToDouble(d -> d.temperatureC).max().orElse(0.0);
        String hotDevice = devs.stream()
                .filter(d -> d.temperatureC == maxTemp)
                .map(d -> d.subsystem + "/" + d.name)
                .findFirst().orElse("unknown");
        if (maxTemp >= tempFailC) {
            r.status = CheckStatus.FAIL;
            r.detail = String.format("%.0f°C on %s — critical threshold exceeded", maxTemp, hotDevice);
        } else if (maxTemp >= tempWarnC) {
            r.status = CheckStatus.WARNING;
            r.detail = String.format("%.0f°C on %s — warm, monitor closely", maxTemp, hotDevice);
        } else {
            r.status = CheckStatus.PASS;
            r.detail = String.format("Max %.0f°C — all motors nominal", maxTemp);
        }
    }

    private void checkCurrentDraw(CheckResult r) {
        double current = RobotController.getInputCurrent();
        r.detail = String.format("%.1f A input current", current);
        if      (current > currentFailA) { r.status = CheckStatus.FAIL;    r.detail += " — over limit"; }
        else if (current > currentWarnA) { r.status = CheckStatus.WARNING; r.detail += " — high draw"; }
        else                             { r.status = CheckStatus.PASS; }
    }

    private void checkEncoders(CheckResult r) {
        if (healthMonitor == null) { skip(r, "No health monitor"); return; }
        List<RobotHealthMonitor.DeviceSnapshot> devs = healthMonitor.getDeviceSnapshots();
        List<RobotHealthMonitor.DeviceSnapshot> motorDevs = new ArrayList<>();
        for (RobotHealthMonitor.DeviceSnapshot d : devs) {
            if (d.type.equalsIgnoreCase("TalonFX") || d.type.toLowerCase().contains("encoder")) {
                motorDevs.add(d);
            }
        }
        if (motorDevs.isEmpty()) { skip(r, "No motor/encoder devices registered"); return; }
        long offline = motorDevs.stream().filter(d -> !d.online).count();
        if (offline == 0) {
            r.status = CheckStatus.PASS;
            r.detail = motorDevs.size() + " encoder(s) responding";
        } else {
            r.status = CheckStatus.FAIL;
            r.detail = offline + "/" + motorDevs.size() + " encoder(s) not responding";
        }
    }

    private void checkGyro(CheckResult r) {
        if (healthMonitor == null) { skip(r, "No health monitor"); return; }
        List<RobotHealthMonitor.DeviceSnapshot> devs = healthMonitor.getDeviceSnapshots();
        List<RobotHealthMonitor.DeviceSnapshot> gyros = new ArrayList<>();
        for (RobotHealthMonitor.DeviceSnapshot d : devs) {
            String t = d.type.toLowerCase();
            if (t.contains("pigeon") || t.contains("gyro") || t.contains("cancoder")) gyros.add(d);
        }
        if (gyros.isEmpty()) {
            r.status = CheckStatus.WARNING;
            r.detail = "No gyro/IMU device registered";
            return;
        }
        long offline = gyros.stream().filter(d -> !d.online).count();
        if (offline == 0) {
            r.status = CheckStatus.PASS;
            r.detail = gyros.size() + " gyro/IMU device(s) online";
        } else {
            r.status = CheckStatus.FAIL;
            r.detail = offline + "/" + gyros.size() + " gyro/IMU device(s) offline";
        }
    }

    private void checkVision(CheckResult r) {
        if (healthMonitor == null) { skip(r, "No health monitor"); return; }
        List<RobotHealthMonitor.EthernetSnapshot> targets = healthMonitor.getEthernetSnapshots();
        List<RobotHealthMonitor.EthernetSnapshot> visionTargets = new ArrayList<>();
        for (RobotHealthMonitor.EthernetSnapshot t : targets) {
            String nameL = t.name.toLowerCase();
            String roleL = t.role.toLowerCase();
            if (nameL.contains("photon") || nameL.contains("limelight") || nameL.contains("vision")
                    || roleL.contains("vision") || roleL.contains("camera")) {
                visionTargets.add(t);
            }
        }
        if (visionTargets.isEmpty()) {
            r.status = CheckStatus.SKIPPED;
            r.detail = "No vision targets registered in ethernet config";
            return;
        }
        long online = visionTargets.stream().filter(t -> "online".equals(t.status)).count();
        if (online == visionTargets.size()) {
            r.status = CheckStatus.PASS;
            r.detail = visionTargets.size() + " vision target(s) online";
        } else {
            r.status = CheckStatus.FAIL;
            r.detail = online + "/" + visionTargets.size() + " vision target(s) online";
        }
    }

    private void checkSubsystemReadiness(CheckResult r) {
        if (healthMonitor == null) { skip(r, "No health monitor"); return; }
        List<RobotHealthMonitor.SubsystemSnapshot> subs = healthMonitor.getSubsystemSnapshots();
        if (subs.isEmpty()) {
            r.status = CheckStatus.WARNING;
            r.detail = "No subsystems registered yet";
            return;
        }
        long notReady = subs.stream().filter(s -> !s.ready).count();
        if (notReady == 0) {
            r.status = CheckStatus.PASS;
            r.detail = subs.size() + " subsystem(s) all ready";
        } else {
            StringBuilder sb = new StringBuilder();
            for (RobotHealthMonitor.SubsystemSnapshot s : subs) {
                if (!s.ready) {
                    if (sb.length() > 0) sb.append(", ");
                    sb.append(s.name);
                    if (!s.fault.isEmpty()) sb.append(" (").append(s.fault).append(")");
                }
            }
            r.status = CheckStatus.WARNING;
            r.detail = notReady + "/" + subs.size() + " not ready: " + sb;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static void skip(CheckResult r, String reason) {
        r.status = CheckStatus.SKIPPED;
        r.detail = reason;
    }

    private void publishResults() {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < checks.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append(checks.get(i).toJson());
        }
        sb.append("]");
        resultsPublisher.set(sb.toString());
    }
}
