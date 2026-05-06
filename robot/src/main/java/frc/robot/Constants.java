package frc.robot;

/** Robot-wide constants grouped one class per subsystem. */
public final class Constants {
    private Constants() {}


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

        // State machine
        public static final String[] STATES = new String[]{"ready", "running", "unjamming", "fault"};
    }
    // END 3544-GENERATOR SpindexerHook


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

        // State machine
        public static final String[] STATES = new String[]{"ready", "running", "fault"};
    }
    // END 3544-GENERATOR SpindexerFeed
}
