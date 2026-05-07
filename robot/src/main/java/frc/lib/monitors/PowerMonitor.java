package frc.lib.monitors;

import edu.wpi.first.networktables.DoubleArrayPublisher;
import edu.wpi.first.networktables.DoublePublisher;
import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.StringArrayPublisher;
import edu.wpi.first.wpilibj.PowerDistribution;
import edu.wpi.first.wpilibj.RobotBase;
import edu.wpi.first.wpilibj.RobotController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Static power monitor. Register motors by subsystem once at startup,
 * then call {@link #update(double)} every periodic loop.
 *
 * Publishes live current, power, and cumulative energy for every registered
 * motor and subsystem under {@code /{root}/Power/} in NetworkTables.
 *
 * In simulation, motor currents are synthesised with a realistic Falcon-style
 * idle + load pattern so the dashboard stays populated during development.
 *
 * Usage:
 *   PowerMonitor.register("Shooter", "TopMotor", 0);  // PDH channel 0
 *   PowerMonitor.register("Shooter", "BotMotor", 1);
 *   PowerMonitor.register("Drive",   "FrontLeft", 2);
 *   // in robotPeriodic():
 *   PowerMonitor.update(0.02);
 */
public final class PowerMonitor {

    // ── Internal types ───────────────────────────────────────────────────────

    private static class MotorEntry {
        final String name;
        final int    pdhChannel;
        @SuppressWarnings("unused")
        double       currentAmps = 0;

        MotorEntry(String name, int pdhChannel) {
            this.name = name;
            this.pdhChannel = pdhChannel;
        }
    }

    private static class SubsystemEntry {
        @SuppressWarnings("unused")
        final String              name;
        final List<MotorEntry>    motors = new ArrayList<>();
        double                    cumulativeEnergyJ = 0;

        // NT publishers
        final DoublePublisher      currentPub;
        final DoublePublisher      powerPub;
        final DoublePublisher      energyPub;
        final StringArrayPublisher motorNamesPub;
        final DoubleArrayPublisher motorCurrentsPub;

        SubsystemEntry(String name, NetworkTable subsystemsTable) {
            this.name = name;
            NetworkTable t = subsystemsTable.getSubTable(name);
            currentPub       = t.getDoubleTopic("Current").publish();
            powerPub         = t.getDoubleTopic("Power").publish();
            energyPub        = t.getDoubleTopic("Energy").publish();
            motorNamesPub    = t.getStringArrayTopic("MotorNames").publish();
            motorCurrentsPub = t.getDoubleArrayTopic("MotorCurrents").publish();
        }
    }

    // ── Static state ─────────────────────────────────────────────────────────

    private static final Map<String, SubsystemEntry> subsystems = new LinkedHashMap<>();
    private static PowerDistribution pdh;

    // NT publishers (initialised once in the static block below)
    @SuppressWarnings("unused")
    private static final NetworkTable powerTable;
    private static final NetworkTable subsystemsTable;
    private static final StringArrayPublisher subsystemNamesPub;
    private static final DoublePublisher      batteryVoltagePub;
    private static final DoublePublisher      totalCurrentPub;
    private static final DoublePublisher      totalPowerPub;
    // Legacy flat-path publishers kept for dashboard backwards compatibility
    private static final DoublePublisher      legacyTotalCurrentPub;
    private static final DoublePublisher      legacyTotalPowerPub;

    /** Simulation tick counter — gives each motor a unique phase offset. */
    private static int tick = 0;

    static {
        NetworkTable root = NetworkTableInstance.getDefault().getTable("3544").getSubTable("Power");
        powerTable        = root;
        subsystemsTable   = root.getSubTable("Subsystems");

        subsystemNamesPub     = root.getStringArrayTopic("SubsystemNames").publish();
        batteryVoltagePub     = root.getSubTable("Battery").getDoubleTopic("Voltage").publish();
        totalCurrentPub       = root.getSubTable("Battery").getDoubleTopic("TotalCurrent").publish();
        totalPowerPub         = root.getSubTable("Battery").getDoubleTopic("TotalPower").publish();
        legacyTotalCurrentPub = root.getDoubleTopic("TotalCurrent").publish();
        legacyTotalPowerPub   = root.getDoubleTopic("TotalPower").publish();
    }

    // Static-only class — no instances
    private PowerMonitor() {}

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Registers a motor with a named subsystem. Call once per motor at robot init.
     * Duplicate registrations (same subsystem + motor name) are silently ignored.
     *
     * @param subsystemName Human-readable subsystem name (e.g. "Shooter")
     * @param motorName     Human-readable motor name within the subsystem (e.g. "TopMotor")
     * @param pdhChannel    PDH channel number for this motor (0-based)
     */
    public static void register(String subsystemName, String motorName, int pdhChannel) {
        SubsystemEntry entry = subsystems.computeIfAbsent(
            subsystemName, n -> new SubsystemEntry(n, subsystemsTable)
        );

        // Guard against duplicate registrations
        for (MotorEntry m : entry.motors) {
            if (m.name.equals(motorName)) return;
        }

        entry.motors.add(new MotorEntry(motorName, pdhChannel));

        // Keep NT motor-names list in sync with the new motor
        entry.motorNamesPub.set(entry.motors.stream()
            .map(m -> m.name).toArray(String[]::new));

        // Keep top-level subsystem names list in sync
        subsystemNamesPub.set(subsystems.keySet().toArray(new String[0]));
    }

    /**
     * Updates all power measurements and publishes to NetworkTables.
     * Call once per robot loop from {@code robotPeriodic()}.
     *
     * @param dt Loop period in seconds (typically 0.02)
     */
    public static void update(double dt) {
        // Lazy PDH init — only attempt on real hardware
        if (pdh == null && !RobotBase.isSimulation()) {
            pdh = new PowerDistribution();
        }

        double voltage     = RobotController.getBatteryVoltage();
        double totalCurrent = 0;

        for (SubsystemEntry subsystem : subsystems.values()) {
            double   subsysCurrent = 0;
            double[] motorCurrents = new double[subsystem.motors.size()];

            for (int i = 0; i < subsystem.motors.size(); i++) {
                MotorEntry motor = subsystem.motors.get(i);
                double amps;

                if (RobotBase.isSimulation()) {
                    // Simulate Falcon-style current: ~3 A idle + up to 37 A load
                    // Phase offset per channel so motors don't all peak simultaneously
                    double phase = motor.pdhChannel * 1.3;
                    amps = 3.0 + 37.0 * Math.abs(Math.sin(tick * 0.04 + phase));
                } else {
                    amps = pdh.getCurrent(motor.pdhChannel);
                }

                motor.currentAmps = amps;
                motorCurrents[i]  = amps;
                subsysCurrent    += amps;
            }

            double subsysPower = subsysCurrent * voltage;
            subsystem.cumulativeEnergyJ += subsysPower * dt;
            totalCurrent += subsysCurrent;

            subsystem.currentPub.set(subsysCurrent);
            subsystem.powerPub.set(subsysPower);
            subsystem.energyPub.set(subsystem.cumulativeEnergyJ);
            subsystem.motorCurrentsPub.set(motorCurrents);
        }

        batteryVoltagePub.set(voltage);
        totalCurrentPub.set(totalCurrent);
        totalPowerPub.set(totalCurrent * voltage);
        legacyTotalCurrentPub.set(totalCurrent);
        legacyTotalPowerPub.set(totalCurrent * voltage);

        tick++;
    }
}
