package frc.robot;

import static edu.wpi.first.units.Units.Inches;

import com.ctre.phoenix6.CANBus;
import com.pathplanner.lib.config.RobotConfig;

import edu.wpi.first.math.geometry.Rotation3d;
import edu.wpi.first.math.geometry.Transform3d;
import edu.wpi.first.math.geometry.Translation3d;

/** Robot-wide constants grouped one class per subsystem. */
public final class Constants {
    private Constants() {
    }

    public static final class Drive {
        private Drive() {
        }

        public static RobotConfig config = null;
        public static final double TELEOP_SPEED_SCALE = 1.00;
        public static final double TELEOP_ANGULAR_RATE_SCALE = 1.00;
    }

    public static final class CAN {
        private CAN() {
        }

        public static final CANBus rio = new CANBus("rio");
        public static final CANBus canivore = new CANBus("canivore");
    }

    public static final class Health {
        private Health() {
        }

        public static final String[] CAN_BUSES = new String[] { "rio" };

        private static final boolean SIM = edu.wpi.first.wpilibj.RobotBase.isSimulation();

        public static final EthernetTarget[] ETHERNET_TARGETS = new EthernetTarget[] {
                // In sim: roboRIO is localhost (always reachable), radio doesn't exist
                new EthernetTarget("roboRIO", "controller", SIM ? "localhost" : "10.35.44.2", 0, true),
                new EthernetTarget("Radio/Switch", "network", "10.35.44.1", 0, !SIM),
                // PhotonVision — TCP port 5800. In sim: checks localhost (online if PV sim is running)
                new EthernetTarget("HeliosLeft", "camera", SIM ? "localhost" : "10.35.44.10", 5800, true),
                new EthernetTarget("HeliosRight", "camera", SIM ? "localhost" : "10.35.44.20", 5800, true),
                new EthernetTarget("HeliosFront", "camera", SIM ? "localhost" : "10.35.44.30", 5800, true),
                new EthernetTarget("HeliosBack", "camera", SIM ? "localhost" : "10.35.44.40", 5800, true),
        };

        /**
         * port = 0 → ICMP reachability; port > 0 → TCP connect check (use 5800 for
         * PhotonVision)
         */
        public record EthernetTarget(String name, String role, String host, int port, boolean enabled) {
        }
    }

    public static final class Vision {
        public static Transform3d HELIOS_LEFT_POS = new Transform3d(
                new Translation3d(Inches.of(-7.25), Inches.of(14), Inches.of(14)),
                new Rotation3d(0, -Math.toRadians(15), Math.toRadians(90)));
        public static Transform3d HELIOS_RIGHT_POS = new Transform3d(
                new Translation3d(Inches.of(-6.25), Inches.of(-14), Inches.of(14)),
                new Rotation3d(0, -Math.toRadians(15), -Math.toRadians(90)));
        public static Transform3d HELIOS_BACK_POS = new Transform3d(
                new Translation3d(Inches.of(-13), Inches.of(-2.75), Inches.of(14)),
                new Rotation3d(0, -Math.toRadians(15), Math.toRadians(180)));
        public static Transform3d HELIOS_FRONT_POS = new Transform3d(
                new Translation3d(Inches.of(2.75), Inches.of(0), Inches.of(0)),
                new Rotation3d(0, -Math.toRadians(15), Math.toRadians(0)));
    }

    // BEGIN 3544-GENERATOR Intake
    public static final class Intake {
        private Intake() {}

        // Identity
        public static final String SUBSYSTEM_NAME = "Intake";
        public static final String CAN_BUS = "";
        public static final String MOTOR_TYPE = "falcon_500";
        public static final String ENCODER_TYPE = "integrated";
        public static final String CONTROL_MODE = "open_loop";

        // Hardware IDs
        public static final int LEADER_MOTOR_CAN_ID = 10;
        public static final int LEADER_MOTOR_PDH_CHANNEL = 1;
        public static final boolean LEADER_MOTOR_INVERTED = true;

        // Gear ratios
        public static final double MOTOR_TO_MECH_RATIO = 1.0;

        // Live tunable defaults
        public static final double INTAKE_SPEED_DEFAULT = 1.0;
        public static final double INTAKE_SPEED_STEP = 0.01;

        // Self-test defaults
        public static final boolean SELF_TEST_ENABLED = true;
        public static final double SELF_TEST_OUTPUT = 0.2;
        public static final double SELF_TEST_DURATION_SEC = 1.0;
        public static final String SELF_TEST_TODO = "TODO: tune this self-test movement for the real Intake mechanism. The generated default is intentionally gentle.";

        // State machine
        public static final String[] STATES = new String[]{"ready", "running", "fault"};
    }
    // END 3544-GENERATOR Intake

    // BEGIN 3544-GENERATOR SpindexerHook
    public static final class SpindexerHook {
        private SpindexerHook() {}

        // Identity
        public static final String SUBSYSTEM_NAME = "SpindexerHook";
        public static final String CAN_BUS = "";
        public static final String MOTOR_TYPE = "kraken_x44";
        public static final String ENCODER_TYPE = "integrated";
        public static final String CONTROL_MODE = "velocity";

        // Hardware IDs
        public static final int LEADER_MOTOR_CAN_ID = 20;
        public static final int LEADER_MOTOR_PDH_CHANNEL = 2;
        public static final boolean LEADER_MOTOR_INVERTED = false;

        // Gear ratios
        public static final double MOTOR_TO_MECH_RATIO = 12.0;

        // Live tunable defaults
        public static final double K_P_DEFAULT = 0.005;
        public static final double K_P_STEP = 0.001;
        public static final double K_V_DEFAULT = 0.00018;
        public static final double K_V_STEP = 0.0001;
        public static final double TARGET_RPM_DEFAULT = 250.0;
        public static final double TARGET_RPM_STEP = 50.0;

        // Self-test defaults
        public static final boolean SELF_TEST_ENABLED = true;
        public static final double SELF_TEST_OUTPUT = 250.0;
        public static final double SELF_TEST_DURATION_SEC = 1.0;
        public static final String SELF_TEST_TODO = "TODO: tune this self-test movement for the real SpindexerHook mechanism. The generated default is intentionally gentle.";

        // State machine
        public static final String[] STATES = new String[]{"ready", "running", "unjamming", "fault"};
    }
    // END 3544-GENERATOR SpindexerHook

    // ── Self-Test ─────────────────────────────────────────────────────────────
    /**
     * Per-subsystem self-test parameters. Keep test outputs low — the robot
     * runs this in a pit with people nearby. All values are configurable here.
     */
    public static final class SelfTest {
        private SelfTest() {
        }

        // ── Intake ──────────────────────────────────────────────────────────
        /** Duty cycle for the intake forward run (0–1). */
        public static final double INTAKE_FWD_OUTPUT = 0.25;
        /** Duty cycle magnitude for the intake reverse run (will be negated). */
        public static final double INTAKE_REV_OUTPUT = 0.20;
        /** Duration of each intake run phase in seconds. */
        public static final double INTAKE_RUN_SEC = 2.0;
        /** Pause between forward and reverse in seconds. */
        public static final double INTAKE_PAUSE_SEC = 0.5;

        // ── SpindexerHook ────────────────────────────────────────────────────
        /** Test velocity target in RPM for SpindexerHook spin test. */
        public static final double HOOK_TEST_RPM = 100.0;
        /** Duration to hold the test velocity in seconds. */
        public static final double HOOK_RUN_SEC = 2.5;

        // ── SpindexerFeed ────────────────────────────────────────────────────
        /** Duty cycle for the feed forward run. */
        public static final double FEED_FWD_OUTPUT = 0.25;
        /** Duty cycle magnitude for the feed reverse run. */
        public static final double FEED_REV_OUTPUT = 0.20;
        /** Duration of each feed run phase in seconds. */
        public static final double FEED_RUN_SEC = 2.0;
        /** Pause between forward and reverse in seconds. */
        public static final double FEED_PAUSE_SEC = 0.5;

        // ── Coast-down shared ───────────────────────────────────────────────
        /** Time to wait (zero output) after each motor test. */
        public static final double COAST_DOWN_SEC = 1.0;

        // ── Safety cutoffs (immediate step fail + all-stop) ─────────────────
        /** Per-motor supply current above which the step is immediately failed. */
        public static final double CURRENT_ABORT_A = 40.0;
        /** Device temperature above which the step is immediately failed. */
        public static final double TEMP_ABORT_C = 85.0;

        // ── Warning thresholds ───────────────────────────────────────────────
        /** Peak current above which the step is marked WARNING instead of PASS. */
        public static final double CURRENT_WARN_A = 20.0;
        /** Temperature above which the step is marked WARNING. */
        public static final double TEMP_WARN_C = 65.0;
        /** Battery voltage below which the initial health check fails. */
        public static final double BATTERY_MIN_V = 10.5;

        // ── Interactive step timeouts ────────────────────────────────────────
        /** Seconds before gyro-check auto-advances as WARNING on timeout. */
        public static final double GYRO_TIMEOUT_SEC = 30.0;
        /** Minimum gyro heading delta (degrees) to count as a confirmed rotation. */
        public static final double GYRO_MIN_DELTA_DEG = 30.0;
        /** Seconds before vision-check auto-advances as WARNING on timeout. */
        public static final double VISION_TIMEOUT_SEC = 30.0;
    }

    // BEGIN 3544-GENERATOR SpindexerFeed
    public static final class SpindexerFeed {
        private SpindexerFeed() {}

        // Identity
        public static final String SUBSYSTEM_NAME = "SpindexerFeed";
        public static final String CAN_BUS = "";
        public static final String MOTOR_TYPE = "kraken_x44";
        public static final String ENCODER_TYPE = "integrated";
        public static final String CONTROL_MODE = "open_loop";

        // Hardware IDs
        public static final int LEADER_MOTOR_CAN_ID = 21;
        public static final int LEADER_MOTOR_PDH_CHANNEL = 3;
        public static final boolean LEADER_MOTOR_INVERTED = false;

        // Gear ratios
        public static final double MOTOR_TO_MECH_RATIO = 3.0;

        // Live tunable defaults
        public static final double FEED_SPEED_DEFAULT = 1.0;
        public static final double FEED_SPEED_STEP = 0.1;

        // Self-test defaults
        public static final boolean SELF_TEST_ENABLED = true;
        public static final double SELF_TEST_OUTPUT = 0.2;
        public static final double SELF_TEST_DURATION_SEC = 1.0;
        public static final String SELF_TEST_TODO = "TODO: tune this self-test movement for the real SpindexerFeed mechanism. The generated default is intentionally gentle.";

        // State machine
        public static final String[] STATES = new String[]{"ready", "running", "fault"};
    }
    // END 3544-GENERATOR SpindexerFeed


    // BEGIN 3544-GENERATOR Elevator
    public static final class Elevator {
        private Elevator() {}

        // Identity
        public static final String SUBSYSTEM_NAME = "Elevator";
        public static final String CAN_BUS = "";
        public static final String MOTOR_TYPE = "kraken_x60";
        public static final String ENCODER_TYPE = "integrated";
        public static final String CONTROL_MODE = "position";

        // Hardware IDs
        public static final int LEADER_MOTOR_CAN_ID = 30;
        public static final int LEADER_MOTOR_PDH_CHANNEL = 13;
        public static final boolean LEADER_MOTOR_INVERTED = true;
        public static final int FOLLOWER_MOTOR_CAN_ID = 31;
        public static final int FOLLOWER_MOTOR_PDH_CHANNEL = 12;
        public static final boolean FOLLOWER_MOTOR_INVERTED = false;

        // Gear ratios
        public static final double MOTOR_TO_MECH_RATIO = 12.0;

        // Live tunable defaults
        public static final double K_P_DEFAULT = 0.2;
        public static final double K_P_STEP = 0.01;
        public static final double GFGGRE_DEFAULT = 21.0;
        public static final double GFGGRE_STEP = 0.01;

        // Self-test defaults
        public static final boolean SELF_TEST_ENABLED = true;
        public static final double SELF_TEST_OUTPUT = 5.0;
        public static final double SELF_TEST_DURATION_SEC = 1.0;
        public static final String SELF_TEST_TODO = "TODO: tune this self-test movement for the real Elevator mechanism. The generated default is intentionally gentle.";

        // State machine
        public static final String[] STATES = new String[]{"ready", "atHome", "fault", "homing", "L1", "L2", "L3", "L4"};
    }
    // END 3544-GENERATOR Elevator

}
