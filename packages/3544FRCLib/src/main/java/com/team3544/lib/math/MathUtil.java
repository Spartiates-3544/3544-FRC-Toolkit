package com.team3544.lib.math;

/**
 * Common FRC math utility methods.
 */
public final class MathUtil {

    private MathUtil() {}

    /**
     * Clamps {@code value} to the range [{@code min}, {@code max}].
     *
     * @param value the value to clamp
     * @param min   inclusive lower bound
     * @param max   inclusive upper bound
     * @return {@code value} clamped to [{@code min}, {@code max}]
     */
    public static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Applies a deadband to {@code value}. If the absolute value of {@code value} is
     * less than or equal to {@code threshold}, returns {@code 0.0}; otherwise scales
     * the remaining range linearly back to [-1, 1] to avoid a step discontinuity.
     *
     * @param value     the raw input (typically in [-1, 1])
     * @param threshold the deadband threshold (must be in [0, 1))
     * @return the deadbanded value
     */
    public static double deadband(double value, double threshold) {
        if (Math.abs(value) <= threshold) {
            return 0.0;
        }
        // Scale so output is continuous from 0 at the edge of the deadband to ±1 at max input
        double sign = Math.signum(value);
        return sign * (Math.abs(value) - threshold) / (1.0 - threshold);
    }

    /**
     * Linearly interpolates between {@code a} and {@code b} by {@code t}.
     *
     * @param a start value (t = 0)
     * @param b end value   (t = 1)
     * @param t interpolation factor; typically in [0, 1] but not clamped
     * @return {@code a + t * (b - a)}
     */
    public static double lerp(double a, double b, double t) {
        return a + t * (b - a);
    }

    /**
     * Converts rotations-per-minute to radians-per-second.
     *
     * @param rpm rotational speed in RPM
     * @return equivalent speed in rad/s
     */
    public static double rpmToRadPerSec(double rpm) {
        return rpm * (2.0 * Math.PI) / 60.0;
    }

    /**
     * Converts radians-per-second to rotations-per-minute.
     *
     * @param radPerSec rotational speed in rad/s
     * @return equivalent speed in RPM
     */
    public static double radPerSecToRPM(double radPerSec) {
        return radPerSec * 60.0 / (2.0 * Math.PI);
    }
}
