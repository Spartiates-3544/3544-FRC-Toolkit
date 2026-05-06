package com.team3544.lib.dashboard;

import com.team3544.lib.nt.NTManager;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Reusable publishers for the Team 3544 dashboard NetworkTables contract.
 */
public final class DashboardPublisher {

    private static final List<SubsystemStatus> subsystemStatuses = new ArrayList<>();
    private static final List<TunableDefinition> tunables = new ArrayList<>();

    private DashboardPublisher() {}

    public static void publishRobotState(String mode, boolean enabled, double batteryVoltage) {
        NTManager.logString("Robot/Mode", mode);
        NTManager.logBoolean("Robot/Enabled", enabled);
        NTManager.logDouble("Robot/BatteryVoltage", batteryVoltage);
    }

    public static void publishRobotPose(double xMeters, double yMeters, double headingDeg) {
        NTManager.logDoubleArray("Robot/Pose", new double[] { xMeters, yMeters, headingDeg });
    }

    public static void publishSubsystemStatus(String name, boolean ready, String state, String detail) {
        subsystemStatuses.removeIf(status -> status.name.equals(name));
        subsystemStatuses.add(new SubsystemStatus(name, ready, state, detail));
        NTManager.logStringArray("Subsystems/Names", subsystemStatuses.stream()
                .map(status -> status.name)
                .toArray(String[]::new));
        NTManager.logString("Health/Status", subsystemStatusJson());
    }

    public static void registerTunable(String key, String label, String subsystem, double step) {
        String fullKey = key.startsWith("/3544/Tunables/") ? key : "/3544/Tunables/" + key;
        tunables.removeIf(tunable -> tunable.key.equals(fullKey));
        tunables.add(new TunableDefinition(fullKey, label, subsystem, step));
        NTManager.logString("Tunables/Names", tunableJson());
    }

    public static void publishSimulation(double turretAngleDeg, String driveMode, String intakeState) {
        NTManager.logDouble("Simulation/TurretAngleDeg", turretAngleDeg);
        NTManager.logString("Simulation/DriveMode", driveMode);
        NTManager.logString("Simulation/IntakeState", intakeState);
    }

    private static String subsystemStatusJson() {
        StringBuilder builder = new StringBuilder("[");
        for (int i = 0; i < subsystemStatuses.size(); i++) {
            if (i > 0) builder.append(',');
            SubsystemStatus status = subsystemStatuses.get(i);
            builder.append('{')
                    .append("\"name\":\"").append(escape(status.name)).append("\",")
                    .append("\"ready\":").append(status.ready).append(',')
                    .append("\"state\":\"").append(escape(status.state)).append("\",")
                    .append("\"detail\":\"").append(escape(status.detail)).append("\"")
                    .append('}');
        }
        return builder.append(']').toString();
    }

    private static String tunableJson() {
        StringBuilder builder = new StringBuilder("[");
        for (int i = 0; i < tunables.size(); i++) {
            if (i > 0) builder.append(',');
            TunableDefinition tunable = tunables.get(i);
            builder.append('{')
                    .append("\"key\":\"").append(escape(tunable.key)).append("\",")
                    .append("\"label\":\"").append(escape(tunable.label)).append("\",")
                    .append("\"subsystem\":\"").append(escape(tunable.subsystem)).append("\",")
                    .append("\"step\":").append(String.format(Locale.US, "%.6f", tunable.step))
                    .append('}');
        }
        return builder.append(']').toString();
    }

    private static String escape(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static final class SubsystemStatus {
        final String name;
        final boolean ready;
        final String state;
        final String detail;

        SubsystemStatus(String name, boolean ready, String state, String detail) {
            this.name = name;
            this.ready = ready;
            this.state = state;
            this.detail = detail == null ? "" : detail;
        }
    }

    private static final class TunableDefinition {
        final String key;
        final String label;
        final String subsystem;
        final double step;

        TunableDefinition(String key, String label, String subsystem, double step) {
            this.key = key;
            this.label = label;
            this.subsystem = subsystem;
            this.step = step;
        }
    }
}
