package frc.robot;

import static edu.wpi.first.units.Units.MetersPerSecond;
import static edu.wpi.first.units.Units.RadiansPerSecond;
import static edu.wpi.first.units.Units.RotationsPerSecond;

import com.ctre.phoenix6.swerve.SwerveModule.DriveRequestType;
import com.ctre.phoenix6.swerve.SwerveRequest;
import com.pathplanner.lib.auto.AutoBuilder;
//import com.pathplanner.lib.auto.NamedCommands;

import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.networktables.DoubleSubscriber;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.smartdashboard.SendableChooser;
import edu.wpi.first.wpilibj.smartdashboard.SmartDashboard;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import edu.wpi.first.wpilibj2.command.button.CommandXboxController;
import edu.wpi.first.wpilibj2.command.button.RobotModeTriggers;
import frc.robot.commands.SelfTestCommand;
import frc.robot.subsystems.IntakeSubsystem;
import frc.robot.subsystems.SpindexerHookSubsystem;
import frc.robot.subsystems.defaultSubsystems.CommandSwerveDrivetrain;
import frc.robot.subsystems.defaultSubsystems.CommandSwerveDrivetrain.DriveMode;
import frc.robot.subsystems.SpindexerFeedSubsystem;
import frc.robot.subsystems.ElevatorSubsystem;

/**
 * Robot configuration — subsystems, controllers, and command bindings only.
 * All NT publishing and power monitoring live in DashboardManager.
 */
public class RobotContainer {
    private final ElevatorSubsystem elevator = new ElevatorSubsystem();

    // =========================
    // Driver controller
    // =========================
    private final CommandXboxController joystick = new CommandXboxController(0);

    // =========================
    // Drive config
    // =========================
    private final double maxSpeed = TunerConstants.kSpeedAt12Volts.in(MetersPerSecond);
    private final double maxAngularRate = RotationsPerSecond.of(2).in(RadiansPerSecond);
    private final SwerveRequest.FieldCentric driveRequest = new SwerveRequest.FieldCentric()
            .withDeadband(maxSpeed * 0.1)
            .withRotationalDeadband(maxAngularRate * 0.1)
            .withDriveRequestType(DriveRequestType.OpenLoopVoltage);
    private final SwerveRequest.FieldCentricFacingAngle driveFaceTranslation = new SwerveRequest.FieldCentricFacingAngle()
            .withDeadband(maxSpeed * 0.1)
            .withDriveRequestType(DriveRequestType.OpenLoopVoltage);
    private Rotation2d faceTranslationHeading = Rotation2d.kZero;
    private DriveMode lastDriveMode = DriveMode.NORMAL;

    public final CommandSwerveDrivetrain drivetrain = TunerConstants.createDrivetrain();
    private final SpindexerFeedSubsystem spindexerFeed = new SpindexerFeedSubsystem();
    private final SpindexerHookSubsystem spindexerHook = new SpindexerHookSubsystem();
    private final IntakeSubsystem intake = new IntakeSubsystem();
    // ── Subsystems ────────────────────────────────────────────────────────────

    // ── Dashboard / telemetry ─────────────────────────────────────────────────
    private final DashboardManager dashboard = new DashboardManager(intake, spindexerHook, spindexerFeed, drivetrain, elevator);

    // ── Self-test command ─────────────────────────────────────────────────────
    private final SelfTestCommand selfTestCommand = new SelfTestCommand(
            intake, spindexerHook, spindexerFeed, drivetrain, dashboard.getHealthMonitor(), elevator);
    private final DoubleSubscriber selfTestRunRequest = NetworkTableInstance.getDefault()
            .getTable("3544").getSubTable("SelfTest").getDoubleTopic("RunRequest").subscribe(-1.0);
    private double lastSelfTestRunRequest = -1.0;

    // =========================
    // Autonomous
    // =========================
    private final SendableChooser<Command> autoChooser;

    private void configureNamedCommands() {
        // NamedCommands.registerCommand("run-intake",
        // (new RunIntake(intake)));
    }

    public RobotContainer() {
        configureDefaultCommands();
        configureBindings();
        configureNamedCommands();
        autoChooser = AutoBuilder.buildAutoChooser(getDefaultAutoName());
        SmartDashboard.putData("Auto Chooser", autoChooser);
    }

    private String getDefaultAutoName() {
        var autoNames = AutoBuilder.getAllAutoNames();
        if (autoNames.contains("New Auto")) {
            return "New Auto";
        }
        return autoNames.isEmpty() ? "" : autoNames.get(0);
    }

    private void configureBindings() {
        // TODO: bind controller buttons to commands
        // Example:
        // var driver = new XboxController(0);
        // new JoystickButton(driver, XboxController.Button.kA.value)
        // .onTrue(new InstantCommand(() -> intake.setState("running")))
        // .onFalse(new InstantCommand(() -> intake.setState("idle")));
    }

    // =========================
    // Setup
    // =========================
    private void configureDefaultCommands() {
        driveFaceTranslation.HeadingController.setPID(8.0, 0.0, 0.2);
        driveFaceTranslation.HeadingController.enableContinuousInput(-Math.PI, Math.PI);

        drivetrain.setDefaultCommand(
                drivetrain.applyRequest(() -> {
                    double vx = getDriveX();
                    double vy = getDriveY();
                    double omega = getDriveOmega();

                    vx *= Constants.Drive.TELEOP_SPEED_SCALE;
                    vy *= Constants.Drive.TELEOP_SPEED_SCALE;
                    omega *= Constants.Drive.TELEOP_ANGULAR_RATE_SCALE;

                    DriveMode mode = drivetrain.getDriveMode();

                    if (mode != lastDriveMode) {
                        if (mode == DriveMode.FACE_TRANSLATION) {
                            faceTranslationHeading = drivetrain.getState().Pose
                                    .getRotation();
                        }
                        lastDriveMode = mode;
                    }

                    SwerveRequest request;
                    if (mode == DriveMode.FACE_TRANSLATION) {
                        double translationMag = Math.hypot(vx, vy);

                        if (translationMag > 0.05 * maxSpeed) {
                            faceTranslationHeading = Rotation2d
                                    .fromRadians(Math.atan2(vy, vx));
                        }

                        request = driveFaceTranslation
                                .withVelocityX(vx)
                                .withVelocityY(vy)
                                .withTargetDirection(faceTranslationHeading);
                    } else {
                        request = driveRequest
                                .withVelocityX(vx)
                                .withVelocityY(vy)
                                .withRotationalRate(omega);
                    }

                    return request;
                }));

        final var idle = new SwerveRequest.Idle();
        RobotModeTriggers.disabled().whileTrue(
                drivetrain.applyRequest(() -> idle).ignoringDisable(true));
    }

    // =========================
    // Driver input shaping
    // =========================
    private double getDriveX() {
        return -Math.copySign(Math.pow(joystick.getLeftY(), 2), joystick.getLeftY()) * maxSpeed;
    }

    private double getDriveY() {
        return -Math.copySign(Math.pow(joystick.getLeftX(), 2), joystick.getLeftX()) * maxSpeed;
    }

    private double getDriveOmega() {
        return -(joystick.getRightTriggerAxis() - joystick.getLeftTriggerAxis()) * maxAngularRate;
    }

    // =========================
    // Public hooks
    // =========================
    public Command getAutonomousCommand() {
        return autoChooser.getSelected();
    }

    public CommandSwerveDrivetrain getDrivetrain() {
        return drivetrain;
    }

    public void periodic() {
        intake.periodic();
        spindexerHook.periodic();
        spindexerFeed.periodic();
        elevator.periodic();
        dashboard.periodic();

        // Schedule self-test when the dashboard requests it AND robot is teleop-enabled
        double req = selfTestRunRequest.get(-1.0);
        if (req > 0 && req != lastSelfTestRunRequest
                && DriverStation.isTeleopEnabled()
                && !selfTestCommand.isScheduled()) {
            lastSelfTestRunRequest = req;
            CommandScheduler.getInstance().schedule(selfTestCommand);
        }
    }

    public void simulationPeriodic() {
        elevator.simulationPeriodic();
        spindexerFeed.simulationPeriodic();
        spindexerHook.simulationPeriodic();
        intake.simulationPeriodic();
    }
}
