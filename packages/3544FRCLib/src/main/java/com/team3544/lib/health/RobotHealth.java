package com.team3544.lib.health;

import com.team3544.lib.nt.NTManager;
import edu.wpi.first.wpilibj.RobotController;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Robot health monitoring utilities.
 * Publishes faults and warnings to /3544/Health/.
 */
public final class RobotHealth {

    private static final double LOW_BATTERY_THRESHOLD = 12.0;

    private static final List<String> faults = new ArrayList<>();
    private static final List<String> warnings = new ArrayList<>();

    private RobotHealth() {}

    /**
     * Reads battery voltage and logs it. Adds a warning if voltage is below 12.0 V.
     */
    public static void checkBattery() {
        double voltage = RobotController.getBatteryVoltage();
        NTManager.logDouble("Robot/BatteryVoltage", voltage);
        if (voltage < LOW_BATTERY_THRESHOLD) {
            addWarning(String.format("Low battery voltage: %.2f V", voltage));
        }
    }

    /**
     * Checks a motor controller for faults.
     * The {@code motor} parameter accepts {@code Object} to avoid a hard compile-time
     * dependency on TalonFX or any specific vendor library.
     *
     * <p>Usage: cast {@code motor} to your specific type (e.g., {@code com.ctre.phoenix6.hardware.TalonFX})
     * and call the vendor-specific fault API. Example:
     * <pre>
     *   TalonFX fx = (TalonFX) motor;
     *   if (fx.getFault_Hardware().getValue()) addFault(name + ": hardware fault");
     * </pre>
     *
     * @param name  a human-readable motor name, used as the NT key suffix
     * @param motor the motor controller instance (cast inside as needed)
     */
    public static void checkTalonFX(String name, Object motor) {
        // Cast motor to your vendor type here and inspect vendor-specific fault flags.
        // This method intentionally accepts Object to avoid a hard TalonFX compile dependency.
        // Example (CTRE Phoenix 6):
        //   com.ctre.phoenix6.hardware.TalonFX fx = (com.ctre.phoenix6.hardware.TalonFX) motor;
        //   boolean hasHwFault = fx.getFault_Hardware().getValue();
        //   if (hasHwFault) addFault(name + ": hardware fault");
        NTManager.logString("Health/Motors/" + name, "checked");
    }

    /**
     * Reads and logs the CAN bus utilization percentage (0–1).
     * Adds a warning if utilization exceeds 90%.
     */
    public static void checkCANUtilization() {
        double utilization = RobotController.getCANStatus().percentBusUtilization;
        NTManager.logDouble("Health/CAN/Utilization", utilization);
        if (utilization > 0.90f) {
            addWarning(String.format("High CAN bus utilization: %.1f%%", utilization * 100));
        }
    }

    /** Adds a fault string and publishes the updated list to NT. */
    public static void addFault(String fault) {
        if (faults.contains(fault)) return;
        faults.add(fault);
        publishFaults();
    }

    /** Adds a warning string and publishes the updated list to NT. */
    public static void addWarning(String warning) {
        if (warnings.contains(warning)) return;
        warnings.add(warning);
        publishWarnings();
    }

    public static void setFault(String fault, boolean active) {
        if (active) {
            addFault(fault);
        } else if (faults.remove(fault)) {
            publishFaults();
        }
    }

    public static void setWarning(String warning, boolean active) {
        if (active) {
            addWarning(warning);
        } else if (warnings.remove(warning)) {
            publishWarnings();
        }
    }

    /** Clears all recorded faults and updates NT. */
    public static void clearFaults() {
        faults.clear();
        publishFaults();
    }

    /** Clears all recorded warnings and updates NT. */
    public static void clearWarnings() {
        warnings.clear();
        publishWarnings();
    }

    /** Returns an unmodifiable view of the current fault list. */
    public static List<String> getFaults() {
        return Collections.unmodifiableList(faults);
    }

    /** Returns an unmodifiable view of the current warning list. */
    public static List<String> getWarnings() {
        return Collections.unmodifiableList(warnings);
    }

    private static void publishFaults() {
        NTManager.logString("Health/Faults", String.join("; ", faults));
    }

    private static void publishWarnings() {
        NTManager.logString("Health/Warnings", String.join("; ", warnings));
    }
}
