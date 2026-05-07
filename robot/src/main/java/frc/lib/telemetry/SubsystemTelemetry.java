package frc.lib.telemetry;

import edu.wpi.first.networktables.BooleanPublisher;
import edu.wpi.first.networktables.DoublePublisher;
import edu.wpi.first.networktables.DoubleSubscriber;
import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.StringPublisher;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Generic NetworkTables telemetry helper for command-based subsystems.
 *
 * Publishes all live data and tunables under a configurable NT root (default "3544"):
 *   /{root}/Subsystems/{name}/  — live telemetry (measured value, target, state, faults)
 *   /{root}/Tunables/{name}/    — live-editable gains and setpoints
 *   /{root}/Tunables/Names      — JSON registry consumed by the dashboard
 *
 * Usage:
 *   SubsystemTelemetry telemetry = new SubsystemTelemetry("Shooter", "velocity");
 *   telemetry.registerTunable("kP", 0.005);
 *   // in periodic():
 *   telemetry.publish(measuredRPM, targetRPM, ready, state, fault, warning);
 *   double kp = telemetry.getTunable("kP", 0.005);
 */
public class SubsystemTelemetry {

    // ── NT tables ────────────────────────────────────────────────────────────
    private final NetworkTable subsystemTable;
    private final NetworkTable tunablesTable;

    // ── Telemetry publishers ─────────────────────────────────────────────────
    private final DoublePublisher  primaryPublisher;
    private final DoublePublisher  targetPublisher;
    private final BooleanPublisher readyPublisher;
    private final StringPublisher  statePublisher;
    private final StringPublisher  faultPublisher;
    private final StringPublisher  warningPublisher;

    // ── Tunable state ────────────────────────────────────────────────────────
    private final Map<String, DoublePublisher>  tunablePublishers  = new HashMap<>();
    private final Map<String, DoubleSubscriber> tunableSubscribers = new HashMap<>();

    /** Ordered list of registered tunables — used to rebuild the Names JSON. */
    private final List<TunableEntry> tunableEntries = new ArrayList<>();

    private static class TunableEntry {
        final String key;
        final double defaultValue;
        TunableEntry(String key, double defaultValue) {
            this.key = key;
            this.defaultValue = defaultValue;
        }
    }

    private final String subsystemName;
    private final String ntRoot;

    // ── Topic name helpers ───────────────────────────────────────────────────

    /** Maps control mode string to the measured-value topic name. */
    private static String primaryTopicName(String mode) {
        return switch (mode) {
            case "velocity" -> "Velocity";
            case "position" -> "Position";
            default         -> "OutputPercent";
        };
    }

    /** Maps control mode string to the setpoint/target topic name. */
    private static String targetTopicName(String mode) {
        return switch (mode) {
            case "velocity" -> "TargetVelocity";
            case "position" -> "TargetPosition";
            default         -> "TargetOutput";
        };
    }

    // ── Constructors ─────────────────────────────────────────────────────────

    /**
     * Creates a telemetry instance under the default "3544" NT root.
     *
     * @param subsystemName PascalCase name matching the subsystem class (e.g. "Shooter")
     * @param mode          "velocity", "position", or "open_loop"
     */
    public SubsystemTelemetry(String subsystemName, String mode) {
        this(subsystemName, mode, "3544");
    }

    /**
     * Creates a telemetry instance under a custom NT root.
     *
     * @param subsystemName PascalCase name matching the subsystem class (e.g. "Shooter")
     * @param mode          "velocity", "position", or "open_loop"
     * @param ntRoot        Top-level NetworkTables table name (e.g. "3544")
     */
    public SubsystemTelemetry(String subsystemName, String mode, String ntRoot) {
        this.subsystemName = subsystemName;
        this.ntRoot = ntRoot;

        var nt = NetworkTableInstance.getDefault();
        subsystemTable = nt.getTable(ntRoot).getSubTable("Subsystems").getSubTable(subsystemName);
        tunablesTable  = nt.getTable(ntRoot).getSubTable("Tunables").getSubTable(subsystemName);

        primaryPublisher = subsystemTable.getDoubleTopic(primaryTopicName(mode)).publish();
        targetPublisher  = subsystemTable.getDoubleTopic(targetTopicName(mode)).publish();
        readyPublisher   = subsystemTable.getBooleanTopic("Ready").publish();
        statePublisher   = subsystemTable.getStringTopic("State").publish();
        faultPublisher   = subsystemTable.getStringTopic("Fault").publish();
        warningPublisher = subsystemTable.getStringTopic("Warning").publish();

        // Clear fault/warning on startup so stale values don't persist across deploys
        faultPublisher.set("");
        warningPublisher.set("");
    }

    // ── Registration ─────────────────────────────────────────────────────────

    /**
     * Registers a live-tunable value. Call once per tunable in the subsystem
     * constructor (after creating this object). Idempotent — safe to call twice.
     *
     * @param key          NT key, also displayed as the label on the dashboard (e.g. "kP")
     * @param defaultValue Value used before the dashboard overrides it
     */
    public void registerTunable(String key, double defaultValue) {
        if (tunablePublishers.containsKey(key)) return;

        var pub = tunablesTable.getDoubleTopic(key).publish();
        var sub = tunablesTable.getDoubleTopic(key).subscribe(defaultValue);
        pub.set(defaultValue);

        tunablePublishers.put(key, pub);
        tunableSubscribers.put(key, sub);
        tunableEntries.add(new TunableEntry(key, defaultValue));

        publishNames();
    }

    // ── Read tunables ─────────────────────────────────────────────────────────

    /**
     * Returns the current dashboard-overridden value of a tunable.
     * Returns {@code defaultValue} if the key has not been registered yet.
     */
    public double getTunable(String key, double defaultValue) {
        DoubleSubscriber sub = tunableSubscribers.get(key);
        if (sub == null) return defaultValue;
        return sub.get(defaultValue);
    }

    // ── Publish telemetry ────────────────────────────────────────────────────

    /**
     * Publishes one telemetry frame. Call once per {@code periodic()} invocation.
     *
     * @param primary  Measured value (RPM / degrees / output percent, depending on mode)
     * @param target   Setpoint / commanded value
     * @param ready    True when the mechanism has reached its target
     * @param state    Current state-machine state string
     * @param fault    Fault description (empty string = no fault)
     * @param warning  Warning description (empty string = no warning)
     */
    public void publish(double primary, double target, boolean ready,
                        String state, String fault, String warning) {
        primaryPublisher.set(primary);
        targetPublisher.set(target);
        readyPublisher.set(ready);
        statePublisher.set(state);
        faultPublisher.set(fault);
        warningPublisher.set(warning);

        // Mirror tunable subscribers back to their publishers so the dashboard
        // always reflects the live value even when no overrides have been sent.
        for (var entry : tunableEntries) {
            DoubleSubscriber sub = tunableSubscribers.get(entry.key);
            DoublePublisher  pub = tunablePublishers.get(entry.key);
            if (sub != null && pub != null) {
                pub.set(sub.get(entry.defaultValue));
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Rebuilds the {@code /{root}/Tunables/Names} JSON array that the dashboard
     * reads to populate its tunables panel.
     */
    private void publishNames() {
        var nt = NetworkTableInstance.getDefault();
        var namesPub = nt.getTable(ntRoot).getSubTable("Tunables")
                         .getStringTopic("Names").publish();

        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < tunableEntries.size(); i++) {
            TunableEntry e = tunableEntries.get(i);
            if (i > 0) sb.append(",");
            sb.append("{\"key\":\"/" + ntRoot + "/Tunables/")
              .append(subsystemName).append("/").append(e.key)
              .append("\",\"label\":\"").append(e.key)
              .append("\",\"subsystem\":\"").append(subsystemName)
              .append("\"}");
        }
        sb.append("]");
        namesPub.set(sb.toString());
    }
}
