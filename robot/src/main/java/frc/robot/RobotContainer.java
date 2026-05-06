package frc.robot;

import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.DoubleArrayPublisher;
import edu.wpi.first.networktables.DoublePublisher;
import edu.wpi.first.networktables.StringArrayPublisher;
import edu.wpi.first.networktables.StringPublisher;
import edu.wpi.first.wpilibj.RobotController;
import frc.robot.subsystems.ShooterSubsystem;

public class RobotContainer {
    private final ShooterSubsystem shooter = new ShooterSubsystem();

    private final DoublePublisher batteryPublisher;
    private final DoubleArrayPublisher posePublisher;
    private final StringArrayPublisher subsystemNamesPublisher;
    private final StringPublisher healthStatusPublisher;
    private double simTime = 0.0;

    public RobotContainer() {
        var nt = NetworkTableInstance.getDefault();
        batteryPublisher = nt.getTable("3544").getSubTable("Robot")
            .getDoubleTopic("BatteryVoltage").publish();
        posePublisher = nt.getTable("3544").getSubTable("Robot")
            .getDoubleArrayTopic("Pose").publish();
        subsystemNamesPublisher = nt.getTable("3544").getSubTable("Subsystems")
            .getStringArrayTopic("Names").publish();
        healthStatusPublisher = nt.getTable("3544").getSubTable("Health")
            .getStringTopic("Status").publish();

        // Register all motors with PowerMonitor — PDH channel assignments
        PowerMonitor.register("Shooter", "TopMotor",    0);
        PowerMonitor.register("Shooter", "BottomMotor", 1);
        PowerMonitor.register("Drive",   "FrontLeft",   2);
        PowerMonitor.register("Drive",   "FrontRight",  3);
        PowerMonitor.register("Drive",   "BackLeft",    4);
        PowerMonitor.register("Drive",   "BackRight",   5);
        PowerMonitor.register("Intake",  "IntakeMotor", 6);
    }

    public void periodic() {
        batteryPublisher.set(RobotController.getBatteryVoltage());
        shooter.periodic();
        publishDashboardContract();
        PowerMonitor.update(0.02);
    }

    private void publishDashboardContract() {
        simTime += 0.02;
        double x = 8.27 + Math.cos(simTime * 0.35) * 3.4;
        double y = 4.1 + Math.sin(simTime * 0.52) * 1.8;
        double heading = (simTime * 28.0) % 360.0;
        posePublisher.set(new double[] { x, y, heading });
        subsystemNamesPublisher.set(new String[] { "Drive", "Shooter", "Intake" });

        boolean driveReady = true;
        boolean intakeReady = true;
        String shooterDetail = String.format("%.0f / %.0f RPM", shooter.getCurrentRpm(), shooter.getTargetRpm());
        String statusJson = "["
            + statusJson("Drive", driveReady, "field-relative", "sim pose publishing")
            + ","
            + statusJson("Shooter", shooter.isReady(), shooter.getState(), shooterDetail)
            + ","
            + statusJson("Intake", intakeReady, "simulated", "cycles stowed/running")
            + "]";
        healthStatusPublisher.set(statusJson);
    }

    private static String statusJson(String name, boolean ready, String state, String detail) {
        return "{\"name\":\"" + escape(name)
            + "\",\"ready\":" + ready
            + ",\"state\":\"" + escape(state)
            + "\",\"detail\":\"" + escape(detail)
            + "\"}";
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    public void simulationPeriodic() {
        shooter.simulationPeriodic();
    }
}
