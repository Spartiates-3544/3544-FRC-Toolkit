package frc.robot.subsystems;

import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.DoublePublisher;
import edu.wpi.first.networktables.DoubleSubscriber;
import edu.wpi.first.networktables.BooleanPublisher;
import edu.wpi.first.networktables.StringPublisher;

/**
 * Simulated shooter subsystem.
 *
 * Publishes to:
 *   /3544/Subsystems/Shooter/TopRPM
 *   /3544/Subsystems/Shooter/TargetRPM
 *   /3544/Subsystems/Shooter/Ready
 *   /3544/Tunables/Shooter/kP
 *   /3544/Health/Faults
 *   /3544/Health/Warnings
 *   /3544/Health/CAN/Utilization
 *   /3544/Simulation/TurretAngleDeg
 *   /3544/Simulation/DriveMode
 */
public class ShooterSubsystem {
    // Sim state
    private double simRpm = 0.0;
    private double targetRpm = 3000.0;
    private double kP = 0.005;
    private double kV = 0.00018;
    private double turretAngleDeg = 0.0;
    private double turretVelocity = 1.2; // degrees per periodic tick
    private int faultTimer = 0;
    private boolean ready = false;
    private String warning = "";
    private String fault = "";

    // NT publishers
    private final DoublePublisher rpmPublisher;
    private final DoublePublisher targetRpmPublisher;
    private final BooleanPublisher readyPublisher;
    private final DoublePublisher kpPublisher;
    private final DoublePublisher kvPublisher;
    private final DoublePublisher targetRpmTunablePublisher;
    private final StringPublisher faultsPublisher;
    private final StringPublisher warningsPublisher;
    private final DoublePublisher canUtilPublisher;
    private final DoublePublisher turretAnglePublisher;
    private final StringPublisher driveModePublisher;
    private final StringPublisher intakeStatePublisher;
    private final StringPublisher tunableNamesPublisher;

    // NT subscriber — dashboard can push a new kP value
    private final DoubleSubscriber kpSubscriber;
    private final DoubleSubscriber kvSubscriber;
    private final DoubleSubscriber targetRpmSubscriber;

    public ShooterSubsystem() {
        var nt = NetworkTableInstance.getDefault();

        var shooterTable  = nt.getTable("3544").getSubTable("Subsystems").getSubTable("Shooter");
        var tunablesTable = nt.getTable("3544").getSubTable("Tunables").getSubTable("Shooter");
        var healthTable   = nt.getTable("3544").getSubTable("Health");
        var simTable      = nt.getTable("3544").getSubTable("Simulation");

        rpmPublisher       = shooterTable.getDoubleTopic("TopRPM").publish();
        targetRpmPublisher = shooterTable.getDoubleTopic("TargetRPM").publish();
        readyPublisher     = shooterTable.getBooleanTopic("Ready").publish();
        kpPublisher        = tunablesTable.getDoubleTopic("kP").publish();
        kvPublisher        = tunablesTable.getDoubleTopic("kV").publish();
        targetRpmTunablePublisher = tunablesTable.getDoubleTopic("TargetRPM").publish();
        faultsPublisher    = healthTable.getStringTopic("Faults").publish();
        warningsPublisher  = healthTable.getStringTopic("Warnings").publish();
        canUtilPublisher   = healthTable.getSubTable("CAN").getDoubleTopic("Utilization").publish();
        turretAnglePublisher = simTable.getDoubleTopic("TurretAngleDeg").publish();
        driveModePublisher   = simTable.getStringTopic("DriveMode").publish();
        intakeStatePublisher = simTable.getStringTopic("IntakeState").publish();
        tunableNamesPublisher = nt.getTable("3544").getSubTable("Tunables").getStringTopic("Names").publish();

        // Subscribe so the dashboard can push new values back
        kpSubscriber         = tunablesTable.getDoubleTopic("kP").subscribe(kP);
        kvSubscriber         = tunablesTable.getDoubleTopic("kV").subscribe(kV);
        targetRpmSubscriber  = tunablesTable.getDoubleTopic("TargetRPM").subscribe(targetRpm);

        // Publish initial tunable values so the dashboard sees them immediately
        kpPublisher.set(kP);
        kvPublisher.set(kV);
        targetRpmPublisher.set(targetRpm);
        targetRpmTunablePublisher.set(targetRpm);
        driveModePublisher.set("field-relative");
        intakeStatePublisher.set("stowed");
        faultsPublisher.set("");
        warningsPublisher.set("");
        tunableNamesPublisher.set("["
            + "{\"key\":\"/3544/Tunables/Shooter/kP\",\"label\":\"kP\",\"subsystem\":\"Shooter\",\"step\":0.0001},"
            + "{\"key\":\"/3544/Tunables/Shooter/kV\",\"label\":\"kV\",\"subsystem\":\"Shooter\",\"step\":0.0001},"
            + "{\"key\":\"/3544/Tunables/Shooter/TargetRPM\",\"label\":\"Target RPM\",\"subsystem\":\"Shooter\",\"step\":100}"
            + "]");
    }

    public void periodic() {
        // Pick up any tunable changes from the dashboard
        kP        = kpSubscriber.get(kP);
        kV        = kvSubscriber.get(kV);
        targetRpm = targetRpmSubscriber.get(targetRpm);

        // Simple P controller simulation: RPM ramps toward target
        double error = targetRpm - simRpm;
        simRpm += error * kP * 50 + targetRpm * kV; // 50 = 1/0.02s loop
        simRpm = Math.max(0, simRpm);

        ready = Math.abs(error) < 50.0;

        rpmPublisher.set(simRpm);
        targetRpmPublisher.set(targetRpm);
        targetRpmTunablePublisher.set(targetRpm);
        readyPublisher.set(ready);
        kpPublisher.set(kP);
        kvPublisher.set(kV);

        // Warn if shooter is very far from target while not at zero
        if (Math.abs(error) > 500 && simRpm > 100) {
            warning = "Shooter not at target";
        } else {
            warning = "";
        }
        warningsPublisher.set(warning);

        // Simulate a transient fault every ~10 seconds
        faultTimer++;
        if (faultTimer == 500) {
            fault = "Shooter/HighTemp";
        } else if (faultTimer == 550) {
            fault = "";
            faultTimer = 0;
        }
        faultsPublisher.set(fault);

        // Sweep turret angle for visual feedback
        turretAngleDeg += turretVelocity;
        if (turretAngleDeg > 90 || turretAngleDeg < -90) turretVelocity *= -1;
        turretAnglePublisher.set(turretAngleDeg);
        intakeStatePublisher.set(faultTimer % 260 < 130 ? "stowed" : "running");

        // Simulated CAN utilization (~30%)
        canUtilPublisher.set(0.30 + Math.sin(faultTimer * 0.01) * 0.05);
    }

    public boolean isReady() {
        return ready;
    }

    public double getCurrentRpm() {
        return simRpm;
    }

    public double getTargetRpm() {
        return targetRpm;
    }

    public String getState() {
        if (!fault.isEmpty()) return "fault";
        if (!warning.isEmpty()) return "spinning-up";
        return ready ? "ready" : "tracking";
    }

    public void simulationPeriodic() {
        // Nothing extra needed — periodic() handles the simulation logic
    }
}
