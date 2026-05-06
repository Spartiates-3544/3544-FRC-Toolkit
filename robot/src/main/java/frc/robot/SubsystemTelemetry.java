package frc.robot;

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
 * Reusable telemetry helper for generated subsystems.
 *
 * Owns all NetworkTables publishers/subscribers under:
 *   /3544/Subsystems/<name>/  — live telemetry
 *   /3544/Tunables/<name>/    — live-editable gains & setpoints
 *   /3544/Tunables/Names      — JSON registry consumed by the dashboard
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

    /** Ordered list of registered tunables for the Names JSON. */
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

    // Primary-value topic names per mode
    private static String primaryTopicName(String mode) {
        return switch (mode) {
            case "velocity"  -> "Velocity";
            case "position"  -> "Position";
            default          -> "OutputPercent";
        };
    }

    private static String targetTopicName(String mode) {
        return switch (mode) {
            case "velocity"  -> "TargetVelocity";
            case "position"  -> "TargetPosition";
            default          -> "TargetOutput";
        };
    }

    /**
     * @param subsystemName PascalCase name matching the subsystem class (e.g. "Shooter")
     * @param mode          "velocity", "position", or "open_loop"
     */
    public SubsystemTelemetry(String subsystemName, String mode) {
        this.subsystemName = subsystemName;

        var nt = NetworkTableInstance.getDefault();
        subsystemTable = nt.getTable("3544").getSubTable("Subsystems").getSubTable(subsystemName);
        tunablesTable  = nt.getTable("3544").getSubTable("Tunables").getSubTable(subsystemName);

        primaryPublisher = subsystemTable.getDoubleTopic(primaryTopicName(mode)).publish();
        targetPublisher  = subsystemTable.getDoubleTopic(targetTopicName(mode)).publish();
        readyPublisher   = subsystemTable.getBooleanTopic("Ready").publish();
        statePublisher   = subsystemTable.getStringTopic("State").publish();
        faultPublisher   = subsystemTable.getStringTopic("Fault").publish();
        warningPublisher = subsystemTable.getStringTopic("Warning").publish();

        // Clear on startup
        faultPublisher.set("");
        warningPublisher.set("");
    }

    // ── Registration ─────────────────────────────────────────────────────────

    /**
     * Register a live-tunable value. Call this once during subsystem init
     * (i.e. in the subsystem constructor, after creating this object).
     *
     * @param key          NT key, also used as the Java field name (e.g. "kP")
     * @param defaultValue Value to use before the dashboard overrides it
     */
    public void registerTunable(String key, double defaultValue) {
        if (tunablePublishers.containsKey(key)) return; // idempotent

        var pub = tunablesTable.getDoubleTopic(key).publish();
        var sub = tunablesTable.getDoubleTopic(key).subscribe(defaultValue);
        pub.set(defaultValue);

        tunablePublishers.put(key, pub);
        tunableSubscribers.put(key, sub);
        tunableEntries.add(new TunableEntry(key, defaultValue));

        // Rebuild the Names JSON
        _publishNames();
    }

    // ── Read tunables ─────────────────────────────────────────────────────────

    /**
     * Read the current live value of a tunable (set on the dashboard).
     * Returns defaultValue if the tunable has not been registered yet.
     */
    public double getTunable(String key, double defaultValue) {
        DoubleSubscriber sub = tunableSubscribers.get(key);
        if (sub == null) return defaultValue;
        return sub.get(defaultValue);
    }

    // ── Publish telemetry ────────────────────────────────────────────────────

    /**
     * Publish one telemetry frame. Call once per periodic() invocation.
     *
     * @param primary  Measured value (RPM / degrees / output percent depending on mode)
     * @param target   Setpoint / commanded value
     * @param ready    True when the mechanism is at its target
     * @param state    Current state-machine state string
     * @param fault    Fault description string (empty = no fault)
     * @param warning  Warning description string (empty = no warning)
     */
    public void publish(double primary, double target, boolean ready,
                        String state, String fault, String warning) {
        primaryPublisher.set(primary);
        targetPublisher.set(target);
        readyPublisher.set(ready);
        statePublisher.set(state);
        faultPublisher.set(fault);
        warningPublisher.set(warning);

        // Keep tunable publishers in sync so the dashboard reflects live values
        for (var entry : tunableEntries) {
            DoubleSubscriber sub = tunableSubscribers.get(entry.key);
            DoublePublisher  pub = tunablePublishers.get(entry.key);
            if (sub != null && pub != null) {
                pub.set(sub.get(entry.defaultValue));
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Rebuild the /3544/Tunables/Names JSON array that the dashboard reads. */
    private void _publishNames() {
        var nt = NetworkTableInstance.getDefault();
        var namesPub = nt.getTable("3544").getSubTable("Tunables")
                         .getStringTopic("Names").publish();

        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < tunableEntries.size(); i++) {
            TunableEntry e = tunableEntries.get(i);
            if (i > 0) sb.append(",");
            sb.append("{\"key\":\"/3544/Tunables/")
              .append(subsystemName).append("/").append(e.key)
              .append("\",\"label\":\"").append(e.key)
              .append("\",\"subsystem\":\"").append(subsystemName)
              .append("\"}");
        }
        sb.append("]");
        namesPub.set(sb.toString());
    }
}
