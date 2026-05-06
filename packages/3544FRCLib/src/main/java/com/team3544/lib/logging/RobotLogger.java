package com.team3544.lib.logging;

import com.team3544.lib.nt.NTManager;

/**
 * Structured robot logger that wraps {@link NTManager}.
 *
 * <p>All keys are published under {@code /3544/Subsystems/<subsystem>/<key>}
 * or {@code /3544/Tunables/<subsystem>/<key>}.
 */
public final class RobotLogger {

    private RobotLogger() {}

    /**
     * Publishes a subsystem metric to {@code /3544/Subsystems/<subsystem>/<key>}.
     *
     * @param subsystem subsystem name (e.g., "Drive", "Arm")
     * @param key       metric name (e.g., "VelocityMetersPerSec")
     * @param value     the double value to log
     */
    public static void log(String subsystem, String key, double value) {
        NTManager.logDouble("Subsystems/" + subsystem + "/" + key, value);
    }

    /**
     * Publishes a tunable metric to {@code /3544/Tunables/<subsystem>/<key>}.
     * Useful for logging live-tunable values alongside their actual applied effect.
     *
     * @param subsystem subsystem name (e.g., "Drive", "Arm")
     * @param key       tunable name (e.g., "kP", "kD")
     * @param value     the double value to log
     */
    public static void logTunable(String subsystem, String key, double value) {
        NTManager.logDouble("Tunables/" + subsystem + "/" + key, value);
    }

    /**
     * Publishes a string metric to {@code /3544/Subsystems/<subsystem>/<key>}.
     *
     * @param subsystem subsystem name
     * @param key       metric name
     * @param value     the string value to log
     */
    public static void logString(String subsystem, String key, String value) {
        NTManager.logString("Subsystems/" + subsystem + "/" + key, value);
    }

    /**
     * Publishes a boolean metric to {@code /3544/Subsystems/<subsystem>/<key>}.
     *
     * @param subsystem subsystem name
     * @param key       metric name
     * @param value     the boolean value to log
     */
    public static void logBoolean(String subsystem, String key, boolean value) {
        NTManager.logBoolean("Subsystems/" + subsystem + "/" + key, value);
    }
}
