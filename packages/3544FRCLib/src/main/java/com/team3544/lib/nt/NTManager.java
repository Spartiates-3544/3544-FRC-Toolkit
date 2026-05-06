package com.team3544.lib.nt;

import edu.wpi.first.networktables.DoubleArrayPublisher;
import edu.wpi.first.networktables.DoublePublisher;
import edu.wpi.first.networktables.DoubleSubscriber;
import edu.wpi.first.networktables.BooleanPublisher;
import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.StringArrayPublisher;
import edu.wpi.first.networktables.StringPublisher;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Centralized NetworkTables manager for Team 3544.
 * All keys are published under the /3544/ namespace.
 */
public final class NTManager {

    private static final String ROOT = "/3544/";
    private static final NetworkTableInstance inst = NetworkTableInstance.getDefault();

    // Caches to avoid re-creating publishers every call
    private static final Map<String, DoublePublisher> doublePublishers = new HashMap<>();
    private static final Map<String, StringPublisher> stringPublishers = new HashMap<>();
    private static final Map<String, BooleanPublisher> booleanPublishers = new HashMap<>();
    private static final Map<String, StringArrayPublisher> stringArrayPublishers = new HashMap<>();
    private static final Map<String, DoubleArrayPublisher> doubleArrayPublishers = new HashMap<>();

    private NTManager() {}

    /**
     * Returns the fully-qualified NT key, prefixing with /3544/ if not already prefixed.
     */
    static String qualify(String key) {
        if (key.startsWith(ROOT) || key.startsWith("3544/")) {
            return key;
        }
        return ROOT + key;
    }

    public static void logDouble(String key, double value) {
        String fullKey = qualify(key);
        doublePublishers
                .computeIfAbsent(fullKey, k -> inst.getDoubleTopic(k).publish())
                .set(value);
    }

    public static void logString(String key, String value) {
        String fullKey = qualify(key);
        stringPublishers
                .computeIfAbsent(fullKey, k -> inst.getStringTopic(k).publish())
                .set(value);
    }

    public static void logBoolean(String key, boolean value) {
        String fullKey = qualify(key);
        booleanPublishers
                .computeIfAbsent(fullKey, k -> inst.getBooleanTopic(k).publish())
                .set(value);
    }

    public static void logDoubleArray(String key, double[] value) {
        String fullKey = qualify(key);
        doubleArrayPublishers
                .computeIfAbsent(fullKey, k -> inst.getDoubleArrayTopic(k).publish())
                .set(value);
    }

    public static void logStringArray(String key, String[] value) {
        String fullKey = qualify(key);
        stringArrayPublishers
                .computeIfAbsent(fullKey, k -> inst.getStringArrayTopic(k).publish())
                .set(value);
    }

    /**
     * Subscribes to a double NT key. The callback is invoked with the latest value
     * whenever the entry changes. The caller is responsible for polling (e.g., calling
     * {@link NetworkTableInstance#getTable} listeners or using a periodic loop).
     *
     * @param key      NT key (will be prefixed with /3544/ if needed)
     * @param callback called with the new double value on change
     * @return the {@link DoubleSubscriber}; retain to keep the subscription alive
     */
    public static DoubleSubscriber subscribe(String key, Consumer<Double> callback) {
        String fullKey = qualify(key);
        DoubleSubscriber sub = inst.getDoubleTopic(fullKey).subscribe(0.0);
        // Attach a listener that fires the callback on value changes
        inst.addListener(sub,
                java.util.EnumSet.of(
                        edu.wpi.first.networktables.NetworkTableEvent.Kind.kValueAll),
                event -> callback.accept(event.valueData.value.getDouble()));
        return sub;
    }

    /** Returns the underlying NetworkTableInstance for advanced usage. */
    public static NetworkTableInstance getInstance() {
        return inst;
    }

    /** Returns a sub-table under the /3544/ root. */
    public static NetworkTable getTable(String tableName) {
        return inst.getTable("3544").getSubTable(tableName);
    }
}
