package com.team3544.lib.tuning;

import com.team3544.lib.dashboard.DashboardPublisher;
import edu.wpi.first.networktables.DoubleEntry;
import edu.wpi.first.networktables.NetworkTableInstance;

/**
 * A double value that can be updated live over NetworkTables.
 * Keys are published under /3544/Tunables/.
 *
 * <p>Example:
 * <pre>
 *   TunableNumber kP = new TunableNumber("Drive/kP", 0.5);
 *   // In periodic:
 *   controller.setP(kP.get());
 * </pre>
 */
public class TunableNumber {

    private static final String NT_PREFIX = "/3544/Tunables/";

    private final DoubleEntry entry;
    private final double defaultValue;

    /**
     * Creates a TunableNumber.
     *
     * @param key          short key name (e.g. "Drive/kP"); published under /3544/Tunables/
     * @param defaultValue value to use when not connected or before first NT update
     */
    public TunableNumber(String key, double defaultValue) {
        this(key, defaultValue, inferLabel(key), inferSubsystem(key), 0.001);
    }

    public TunableNumber(String key, double defaultValue, String label, String subsystem, double step) {
        this.defaultValue = defaultValue;
        String fullKey = key.startsWith(NT_PREFIX) ? key : NT_PREFIX + key;
        entry = NetworkTableInstance.getDefault()
                .getDoubleTopic(fullKey)
                .getEntry(defaultValue);
        // Publish the default so it is visible in dashboards before being set
        entry.setDefault(defaultValue);
        DashboardPublisher.registerTunable(fullKey, label, subsystem, step);
    }

    /**
     * Returns the current value. If NT is connected and the entry has been updated,
     * returns the live NT value; otherwise returns the default.
     */
    public double get() {
        return entry.get(defaultValue);
    }

    /**
     * Pushes a new value to NT.
     *
     * @param value the new value to set
     */
    public void set(double value) {
        entry.set(value);
    }

    /** Returns the default value supplied at construction. */
    public double getDefault() {
        return defaultValue;
    }

    private static String inferLabel(String key) {
        String normalized = key.startsWith(NT_PREFIX) ? key.substring(NT_PREFIX.length()) : key;
        int slash = normalized.lastIndexOf('/');
        return slash >= 0 ? normalized.substring(slash + 1) : normalized;
    }

    private static String inferSubsystem(String key) {
        String normalized = key.startsWith(NT_PREFIX) ? key.substring(NT_PREFIX.length()) : key;
        int slash = normalized.indexOf('/');
        return slash >= 0 ? normalized.substring(0, slash) : "Robot";
    }
}
