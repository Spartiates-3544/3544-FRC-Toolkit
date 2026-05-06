package frc.robot;

import frc.robot.subsystems.IntakeSubsystem;
import frc.robot.subsystems.SpindexerHookSubsystem;
import frc.robot.subsystems.SpindexerFeedSubsystem;

/**
 * Robot configuration — subsystems, controllers, and command bindings only.
 * All NT publishing and power monitoring live in DashboardManager.
 */
public class RobotContainer {
    private final SpindexerFeedSubsystem spindexerFeed = new SpindexerFeedSubsystem();
    private final SpindexerHookSubsystem spindexerHook = new SpindexerHookSubsystem();
    private final IntakeSubsystem intake = new IntakeSubsystem();
    // ── Subsystems ────────────────────────────────────────────────────────────

    // ── Dashboard / telemetry ─────────────────────────────────────────────────
    private final DashboardManager dashboard = new DashboardManager(intake, spindexerHook, spindexerFeed);

    public RobotContainer() { 
        configureBindings();
    }

    private void configureBindings() {
        // TODO: bind controller buttons to commands
        // Example:
        //   var driver = new XboxController(0);
        //   new JoystickButton(driver, XboxController.Button.kA.value)
        //       .onTrue(new InstantCommand(() -> intake.setState("running")))
        //       .onFalse(new InstantCommand(() -> intake.setState("idle")));
    }

    public void periodic() {
        intake.periodic();
        spindexerHook.periodic();
        spindexerFeed.periodic();
        dashboard.periodic();
    }

    public void simulationPeriodic() {
        spindexerFeed.simulationPeriodic();
        spindexerHook.simulationPeriodic();
        intake.simulationPeriodic();
    }
}
