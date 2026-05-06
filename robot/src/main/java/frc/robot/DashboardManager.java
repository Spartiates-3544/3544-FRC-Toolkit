package frc.robot;

import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.DoubleArrayPublisher;
import edu.wpi.first.networktables.DoublePublisher;
import edu.wpi.first.networktables.StringArrayPublisher;
import edu.wpi.first.networktables.StringPublisher;
import edu.wpi.first.wpilibj.RobotController;
import frc.robot.subsystems.IntakeSubsystem;
import frc.robot.subsystems.SpindexerHookSubsystem;
import frc.robot.subsystems.SpindexerFeedSubsystem;

/**
 * Owns all NetworkTables publishing and PowerMonitor registration.
 * RobotContainer stays clean — only controllers and command bindings go there.
 *
 * Call periodic() once per robot loop (from RobotContainer.periodic()).
 */
public class DashboardManager {

    // ── Subsystem references (read-only, passed in via constructor) ───────────
    private final IntakeSubsystem intake;
    private final SpindexerHookSubsystem spindexerHook;
    private final SpindexerFeedSubsystem spindexerFeed;

    // ── NT publishers ─────────────────────────────────────────────────────────
    private final DoublePublisher batteryPublisher;
    private final DoubleArrayPublisher posePublisher;
    private final StringArrayPublisher subsystemNamesPublisher;
    private final StringPublisher healthStatusPublisher;

    private double simTime = 0.0; 

    public DashboardManager(IntakeSubsystem intake,
                            SpindexerHookSubsystem spindexerHook,
                            SpindexerFeedSubsystem spindexerFeed) {
        this.intake = intake;
        this.spindexerHook = spindexerHook;
        this.spindexerFeed = spindexerFeed;
        // ── NT setup ─────────────────────────────────────────────────────────
        var nt = NetworkTableInstance.getDefault();
        batteryPublisher = nt.getTable("3544").getSubTable("Robot")
                .getDoubleTopic("BatteryVoltage").publish();
        posePublisher = nt.getTable("3544").getSubTable("Robot")
                .getDoubleArrayTopic("Pose").publish();
        subsystemNamesPublisher = nt.getTable("3544").getSubTable("Subsystems")
                .getStringArrayTopic("Names").publish();
        healthStatusPublisher = nt.getTable("3544").getSubTable("Health")
                .getStringTopic("Status").publish();

        // ── PowerMonitor motor registration ───────────────────────────────────
        PowerMonitor.register(Constants.Intake.SUBSYSTEM_NAME, "LeaderMotor", Constants.Intake.LEADER_MOTOR_PDH_CHANNEL);
        PowerMonitor.register(Constants.SpindexerHook.SUBSYSTEM_NAME, "LeaderMotor", Constants.SpindexerHook.LEADER_MOTOR_PDH_CHANNEL);
        PowerMonitor.register(Constants.SpindexerFeed.SUBSYSTEM_NAME, "LeaderMotor", Constants.SpindexerFeed.LEADER_MOTOR_PDH_CHANNEL);

    }

    public void periodic() {
        batteryPublisher.set(RobotController.getBatteryVoltage());
        PowerMonitor.update(0.02);
        publishDashboard();
    }

    private void publishDashboard() {
        // Simulated pose — replace with your odometry source
        simTime += 0.02;
        double x = 8.27 + Math.cos(simTime * 0.35) * 3.4;
        double y = 4.10 + Math.sin(simTime * 0.52) * 1.8;
        double heading = (simTime * 28.0) % 360.0;
        posePublisher.set(new double[] { x, y, heading });

        subsystemNamesPublisher.set(new String[]{"Intake", "SpindexerHook", "SpindexerFeed"});

        String status = "["
                
                + entry("Intake", intake.isReady(), intake.getState(), "")
                
                + ","
                + entry("SpindexerHook", spindexerHook.isReady(), spindexerHook.getState(), "")
                
                + ","
                + entry("SpindexerFeed", spindexerFeed.isReady(), spindexerFeed.getState(), "")
                + "]";
        healthStatusPublisher.set(status);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String entry(String name, boolean ready, String state, String detail) {
        return "{\"name\":\"" + esc(name)
                + "\",\"ready\":" + ready
                + ",\"state\":\"" + esc(state)
                + "\",\"detail\":\"" + esc(detail)
                + "\"}";
    }

    private static String esc(String v) {
        return v.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
