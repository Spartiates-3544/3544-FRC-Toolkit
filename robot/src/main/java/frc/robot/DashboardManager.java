package frc.robot;

import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.DoubleArrayPublisher;
import edu.wpi.first.networktables.DoublePublisher;
import edu.wpi.first.networktables.StringArrayPublisher;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.RobotController;
import frc.lib.monitors.PowerMonitor;
import frc.lib.monitors.RobotHealthMonitor;
import frc.lib.monitors.RobotTestManager;
import frc.robot.subsystems.IntakeSubsystem;
import frc.robot.subsystems.SpindexerFeedSubsystem;
import frc.robot.subsystems.SpindexerHookSubsystem;
import frc.robot.subsystems.defaultSubsystems.CommandSwerveDrivetrain;
import frc.robot.subsystems.ElevatorSubsystem;

/**
 * Owns all NetworkTables publishing, power monitoring, and health monitoring.
 *
 * RobotContainer stays clean — only controllers and command bindings live
 * there.
 * Call {@link #periodic()} once per robot loop (from
 * {@code RobotContainer.periodic()}).
 */
public class DashboardManager {

        // ── Subsystem references (read-only, passed in via constructor) ───────────
        private final ElevatorSubsystem elevator;
        private final IntakeSubsystem intake;
        private final SpindexerHookSubsystem spindexerHook;
        private final SpindexerFeedSubsystem spindexerFeed;
        private final CommandSwerveDrivetrain drivetrain;

        // ── Lib infrastructure ────────────────────────────────────────────────────
        // RobotHealthMonitor is initialised with this season's CAN bus names and
        // ethernet targets declared in Constants.Health — keeping the lib class
        // free of any robot-specific dependencies.
        private final RobotHealthMonitor healthMonitor = new RobotHealthMonitor(
                        Constants.Health.CAN_BUSES,
                        mapEthernetTargets(Constants.Health.ETHERNET_TARGETS));
        private final RobotTestManager testManager = new RobotTestManager();

        // ── NT publishers ─────────────────────────────────────────────────────────
        private final DoublePublisher batteryPublisher;
        private final DoublePublisher matchTimePublisher;
        private final DoubleArrayPublisher posePublisher;
        private final StringArrayPublisher subsystemNamesPublisher;

        // ── Constructor ───────────────────────────────────────────────────────────

        public DashboardManager(IntakeSubsystem intake,
                        SpindexerHookSubsystem spindexerHook,
                        SpindexerFeedSubsystem spindexerFeed,
                        CommandSwerveDrivetrain drivetrain,
                        ElevatorSubsystem elevator) {
                this.intake = intake;
                this.spindexerHook = spindexerHook;
                this.spindexerFeed = spindexerFeed;
                this.drivetrain = drivetrain;
                this.elevator = elevator;
                
        // ── NT setup ──────────────────────────────────────────────────────────
                var nt = NetworkTableInstance.getDefault();
                batteryPublisher = nt.getTable("3544").getSubTable("Robot")
                                .getDoubleTopic("BatteryVoltage").publish();
                matchTimePublisher = nt.getTable("3544").getSubTable("Robot")
                                .getDoubleTopic("MatchTime").publish();
                posePublisher = nt.getTable("3544").getSubTable("Robot")
                                .getDoubleArrayTopic("Pose").publish();
                subsystemNamesPublisher = nt.getTable("3544").getSubTable("Subsystems")
                                .getStringArrayTopic("Names").publish();

                // ── PowerMonitor motor registration ───────────────────────────────────
                PowerMonitor.register(Constants.Intake.SUBSYSTEM_NAME, "LeaderMotor",
                                Constants.Intake.LEADER_MOTOR_PDH_CHANNEL);
                PowerMonitor.register(Constants.SpindexerHook.SUBSYSTEM_NAME, "LeaderMotor",
                                Constants.SpindexerHook.LEADER_MOTOR_PDH_CHANNEL);
                PowerMonitor.register(Constants.SpindexerFeed.SUBSYSTEM_NAME, "LeaderMotor",
                                Constants.SpindexerFeed.LEADER_MOTOR_PDH_CHANNEL);
                PowerMonitor.register(Constants.Elevator.SUBSYSTEM_NAME, "LeaderMotor",
                                Constants.Elevator.LEADER_MOTOR_PDH_CHANNEL);
                PowerMonitor.register(Constants.Elevator.SUBSYSTEM_NAME, "FollowerMotor",
                                Constants.Elevator.FOLLOWER_MOTOR_PDH_CHANNEL);

                // ── Health device registration ─────────────────────────────────────────
                intake.registerHealthDevices(healthMonitor);
                spindexerHook.registerHealthDevices(healthMonitor);
                spindexerFeed.registerHealthDevices(healthMonitor);
                elevator.registerHealthDevices(healthMonitor);

                testManager.setHealthMonitor(healthMonitor);
        }

        // ── Accessors ─────────────────────────────────────────────────────────────

        public RobotHealthMonitor getHealthMonitor() {
                return healthMonitor;
        }

        // ── Periodic ──────────────────────────────────────────────────────────────

        public void periodic() {
                batteryPublisher.set(RobotController.getBatteryVoltage());
                matchTimePublisher.set(DriverStation.getMatchTime());
                PowerMonitor.update(0.02);
                publishDashboard();
                healthMonitor.periodic(0.02);
                testManager.periodic();
        }

        // ── Private helpers ───────────────────────────────────────────────────────

        private void publishDashboard() {
                var pose = drivetrain.getPose();
                posePublisher.set(new double[] {
                                pose.getX(),
                                pose.getY(),
                                pose.getRotation().getDegrees()
                });

                subsystemNamesPublisher.set(new String[] {
                                Constants.Intake.SUBSYSTEM_NAME,
                                Constants.SpindexerHook.SUBSYSTEM_NAME,
                                Constants.SpindexerFeed.SUBSYSTEM_NAME,
                                Constants.Elevator.SUBSYSTEM_NAME
                });

                healthMonitor.updateSubsystem(Constants.Intake.SUBSYSTEM_NAME,
                                intake.isReady(), intake.getState(), intake.getFault(), intake.getWarning());
                healthMonitor.updateSubsystem(Constants.SpindexerHook.SUBSYSTEM_NAME,
                                spindexerHook.isReady(), spindexerHook.getState(), spindexerHook.getFault(),
                                spindexerHook.getWarning());
                healthMonitor.updateSubsystem(Constants.SpindexerFeed.SUBSYSTEM_NAME,
                                spindexerFeed.isReady(), spindexerFeed.getState(), spindexerFeed.getFault(),
                                spindexerFeed.getWarning());
                healthMonitor.updateSubsystem(Constants.Elevator.SUBSYSTEM_NAME,
                                elevator.isReady(), elevator.getState(), elevator.getFault(), elevator.getWarning());
        }

        /**
         * Converts the robot's {@link Constants.Health.EthernetTarget} records into
         * the season-agnostic {@link RobotHealthMonitor.EthernetTarget} type expected
         * by the lib class.
         */
        private static RobotHealthMonitor.EthernetTarget[] mapEthernetTargets(
                        Constants.Health.EthernetTarget[] sources) {
                RobotHealthMonitor.EthernetTarget[] result = new RobotHealthMonitor.EthernetTarget[sources.length];
                for (int i = 0; i < sources.length; i++) {
                        Constants.Health.EthernetTarget s = sources[i];
                        result[i] = new RobotHealthMonitor.EthernetTarget(
                                        s.name(), s.role(), s.host(), s.port(), s.enabled());
                }
                return result;
        }
}
