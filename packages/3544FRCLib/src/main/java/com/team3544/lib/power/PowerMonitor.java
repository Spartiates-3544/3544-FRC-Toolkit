package com.team3544.lib.power;

import com.team3544.lib.nt.NTManager;
import edu.wpi.first.wpilibj.PowerDistribution;
import edu.wpi.first.wpilibj.RobotController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Monitors robot power (PDH/PDP) and publishes data to NT.
 *
 * <p>Call {@link #update()} from {@code robotPeriodic()} each loop cycle.
 *
 * <p>Published keys:
 * <ul>
 *   <li>{@code /3544/Power/TotalCurrent} — sum of all channel currents (A)</li>
 *   <li>{@code /3544/Power/TotalPower}   — total power drawn (W)</li>
 *   <li>{@code /3544/Robot/BatteryVoltage} — battery voltage (V)</li>
 * </ul>
 */
public class PowerMonitor {

    private final PowerDistribution pdh;
    private final Map<String, SubsystemPower> subsystems = new LinkedHashMap<>();

    private double lastTotalCurrent = 0.0;
    private double lastBatteryVoltage = 0.0;
    private double lastTotalPower = 0.0;

    /**
     * Creates a PowerMonitor using the default PDH/PDP CAN ID (1) and
     * automatic module type detection.
     */
    public PowerMonitor() {
        this.pdh = new PowerDistribution();
    }

    /**
     * Creates a PowerMonitor with an explicit CAN ID and module type.
     *
     * @param canID      CAN ID of the PDH/PDP
     * @param moduleType {@link PowerDistribution.ModuleType#kRev} for PDH,
     *                   {@link PowerDistribution.ModuleType#kCTRE} for PDP
     */
    public PowerMonitor(int canID, PowerDistribution.ModuleType moduleType) {
        this.pdh = new PowerDistribution(canID, moduleType);
    }

    /**
     * Reads PDH/PDP and RobotController data, caches values, and publishes to NT.
     * Call this once per robot periodic loop.
     */
    public void update() {
        lastTotalCurrent = pdh.getTotalCurrent();
        lastBatteryVoltage = RobotController.getBatteryVoltage();
        lastTotalPower = pdh.getTotalPower();

        NTManager.logDouble("Power/TotalCurrent", lastTotalCurrent);
        NTManager.logDouble("Power/TotalPower", lastTotalPower);
        NTManager.logDouble("Power/Battery/Voltage", lastBatteryVoltage);
        NTManager.logDouble("Power/Battery/TotalCurrent", lastTotalCurrent);
        NTManager.logDouble("Power/Battery/TotalPower", lastTotalPower);
        NTManager.logDouble("Robot/BatteryVoltage", lastBatteryVoltage);
        publishSubsystemPower();
    }

    public void registerSubsystemChannel(String subsystemName, String motorName, int pdhChannel) {
        SubsystemPower subsystem = subsystems.computeIfAbsent(subsystemName, SubsystemPower::new);
        for (MotorChannel channel : subsystem.channels) {
            if (channel.motorName.equals(motorName)) return;
        }
        subsystem.channels.add(new MotorChannel(motorName, pdhChannel));
        NTManager.logStringArray("Power/SubsystemNames", subsystems.keySet().toArray(String[]::new));
    }

    /**
     * Returns the total current (A) read during the last {@link #update()} call.
     */
    public double getTotalCurrent() {
        return lastTotalCurrent;
    }

    /**
     * Returns the battery voltage (V) read during the last {@link #update()} call.
     */
    public double getBatteryVoltage() {
        return lastBatteryVoltage;
    }

    public double getTotalPower() {
        return lastTotalPower;
    }

    /**
     * Returns the underlying {@link PowerDistribution} instance for direct access.
     */
    public PowerDistribution getPowerDistribution() {
        return pdh;
    }

    private void publishSubsystemPower() {
        for (SubsystemPower subsystem : subsystems.values()) {
            double current = 0.0;
            double[] motorCurrents = new double[subsystem.channels.size()];
            String[] motorNames = new String[subsystem.channels.size()];

            for (int i = 0; i < subsystem.channels.size(); i++) {
                MotorChannel channel = subsystem.channels.get(i);
                double channelCurrent = pdh.getCurrent(channel.pdhChannel);
                current += channelCurrent;
                motorCurrents[i] = channelCurrent;
                motorNames[i] = channel.motorName;
            }

            double power = current * lastBatteryVoltage;
            subsystem.energyJoules += power * 0.02;
            String base = "Power/Subsystems/" + subsystem.name;
            NTManager.logDouble(base + "/Current", current);
            NTManager.logDouble(base + "/Power", power);
            NTManager.logDouble(base + "/Energy", subsystem.energyJoules);
            NTManager.logStringArray(base + "/MotorNames", motorNames);
            NTManager.logDoubleArray(base + "/MotorCurrents", motorCurrents);
        }
    }

    private static final class SubsystemPower {
        final String name;
        final List<MotorChannel> channels = new ArrayList<>();
        double energyJoules = 0.0;

        SubsystemPower(String name) {
            this.name = name;
        }
    }

    private static final class MotorChannel {
        final String motorName;
        final int pdhChannel;

        MotorChannel(String motorName, int pdhChannel) {
            this.motorName = motorName;
            this.pdhChannel = pdhChannel;
        }
    }
}
