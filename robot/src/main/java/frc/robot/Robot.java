package frc.robot;

import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.StringPublisher;
import edu.wpi.first.networktables.BooleanPublisher;
import edu.wpi.first.wpilibj.TimedRobot;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.CommandScheduler;

public class Robot extends TimedRobot {
    private RobotContainer container;
    private Command autonomousCommand;

    // Top-level robot state keys
    private StringPublisher modePublisher;
    private BooleanPublisher enabledPublisher;

    @Override
    public void robotInit() {
        container = new RobotContainer();
        var nt = NetworkTableInstance.getDefault();
        var robotTable = nt.getTable("3544").getSubTable("Robot");
        modePublisher    = robotTable.getStringTopic("Mode").publish();
        enabledPublisher = robotTable.getBooleanTopic("Enabled").publish();
    }

    @Override
    public void robotPeriodic() {
        CommandScheduler.getInstance().run();
        container.periodic();
    }

    @Override
    public void disabledInit() {
        cancelAutonomousCommand();
        modePublisher.set("disabled");
        enabledPublisher.set(false);
    }

    @Override
    public void autonomousInit() {
        modePublisher.set("auto");
        enabledPublisher.set(true);
        autonomousCommand = container.getAutonomousCommand();
        if (autonomousCommand != null) {
            autonomousCommand.schedule();
        } else {
            DriverStation.reportWarning("No autonomous command selected.", false);
        }
    }

    @Override
    public void teleopInit() {
        cancelAutonomousCommand();
        modePublisher.set("teleop");
        enabledPublisher.set(true);
    }

    @Override
    public void testInit() {
        cancelAutonomousCommand();
        CommandScheduler.getInstance().cancelAll();
        modePublisher.set("test");
        enabledPublisher.set(true);
    }

    @Override
    public void simulationPeriodic() {
        container.simulationPeriodic();
    }

    private void cancelAutonomousCommand() {
        if (autonomousCommand != null) {
            autonomousCommand.cancel();
            autonomousCommand = null;
        }
    }
}
