package frc.robot;

import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.StringPublisher;
import edu.wpi.first.networktables.BooleanPublisher;
import edu.wpi.first.wpilibj.TimedRobot;
import edu.wpi.first.wpilibj2.command.CommandScheduler;

public class Robot extends TimedRobot {
    private RobotContainer container;

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
        modePublisher.set("disabled");
        enabledPublisher.set(false);
    }

    @Override
    public void autonomousInit() {
        modePublisher.set("auto");
        enabledPublisher.set(true);
    }

    @Override
    public void teleopInit() {
        modePublisher.set("teleop");
        enabledPublisher.set(true);
    }

    @Override
    public void testInit() {
        modePublisher.set("test");
        enabledPublisher.set(true);
    }

    @Override
    public void simulationPeriodic() {
        container.simulationPeriodic();
    }
}
