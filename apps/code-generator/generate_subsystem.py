#!/usr/bin/env python3
"""
3544 FRC Subsystem Generator — core logic
Generates clean Java subsystems that delegate NT boilerplate to SubsystemTelemetry,
and patches RobotContainer.java + DashboardManager.java.
"""

import os
import re
import sys
import json

# ─── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR      = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT       = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
SUBSYSTEMS_DIR  = os.path.join(REPO_ROOT, "robot", "src", "main", "java", "frc", "robot", "subsystems")
ROBOT_CONTAINER = os.path.join(REPO_ROOT, "robot", "src", "main", "java", "frc", "robot", "RobotContainer.java")
DASHBOARD_MANAGER = os.path.join(REPO_ROOT, "robot", "src", "main", "java", "frc", "robot", "DashboardManager.java")
CONSTANTS_FILE = os.path.join(REPO_ROOT, "robot", "src", "main", "java", "frc", "robot", "Constants.java")
SELF_TEST_COMMAND = os.path.join(REPO_ROOT, "robot", "src", "main", "java", "frc", "robot", "commands", "SelfTestCommand.java")

# ─── Motor / encoder metadata ─────────────────────────────────────────────────

MOTOR_TYPES = {
    "kraken_x60"   : ("Kraken X60",         "ctre",  "TalonFX",      6000),
    "kraken_x44"   : ("Kraken X44",         "ctre",  "TalonFX",      7530),
    "falcon_500"   : ("Falcon 500",         "ctre",  "TalonFX",      6380),
    "neo"          : ("NEO",                "rev",   "CANSparkMax",  5676),
    "neo_550"      : ("NEO 550",            "rev",   "CANSparkMax",  11000),
    "neo_vortex"   : ("NEO Vortex",         "rev",   "CANSparkFlex", 6784),
}

ENCODER_TYPES = {
    # key           : (display_name,          compatible_vendors,  is_absolute)
    "integrated"   : ("Integrated (motor)",   ["ctre", "rev"],     False),
    "cancoder"     : ("CANcoder (absolute)",  ["ctre"],            True),
    "rev_absolute" : ("REV Absolute Encoder", ["rev"],             True),
    "rev_thruborg" : ("REV Through-bore",     ["rev"],             False),
}

def is_ctre(cfg):
    return MOTOR_TYPES.get(cfg.get("motor_type", "kraken_x60"), ("","ctre","",0))[1] == "ctre"

def is_rev(cfg):
    return not is_ctre(cfg)

def hw_class(cfg):
    return MOTOR_TYPES.get(cfg.get("motor_type", "kraken_x60"), ("","","TalonFX",0))[2]

def encoder_is_absolute(enc_type):
    return ENCODER_TYPES.get(enc_type, ("","",False))[2]

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _camel(key):
    if not key: return key
    return key[0].lower() + key[1:]

def _const_ident(key):
    key = re.sub(r'[^A-Za-z0-9]+', '_', str(key)).strip('_')
    key = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', key).upper()
    if not key:
        key = "VALUE"
    if key[0].isdigit():
        key = "_" + key
    return key

def _java_string(value):
    return json.dumps(str(value))

def ask(prompt, default=None):
    hint = f" [{default}]" if default is not None else ""
    val = input(f"{prompt}{hint}: ").strip()
    return val if val else (str(default) if default is not None else "")

def ask_bool(prompt, default=True):
    hint = "Y/n" if default else "y/N"
    val = input(f"{prompt} [{hint}]: ").strip().lower()
    if val in ("y", "yes"): return True
    if val in ("n", "no"):  return False
    return default

def header(title):
    print(f"\n{'─'*60}\n  {title}\n{'─'*60}")

# ─── CLI input collection ─────────────────────────────────────────────────────

def collect_config():
    print("\n" + "═"*60 + "\n   3544 FRC Subsystem Generator\n" + "═"*60)

    name = ask("\nSubsystem name (PascalCase)", "MySubsystem")
    if name.lower().endswith("subsystem"): name = name[:-9]
    name = name[0].upper() + name[1:]

    can_bus = ask("CAN bus name (blank = default 'rio')", "")

    header("Motor Type")
    for i, (k, v) in enumerate(MOTOR_TYPES.items(), 1):
        print(f"  {i}) {v[0]} ({v[2]}) — {v[3]} RPM free speed")
    mi = int(ask("Choose", 1) or 1) - 1
    motor_type = list(MOTOR_TYPES.keys())[max(0, min(mi, len(MOTOR_TYPES)-1))]

    header("Motor Configuration")
    motors = []
    while True:
        idx = len(motors)
        role = "Leader" if idx == 0 else f"Follower {idx}"
        print(f"\n  [{role}]")
        mname    = ask("    Motor name", f"Motor{idx+1}")
        can_id   = int(ask("    CAN ID", idx) or idx)
        inverted = ask_bool("    Inverted?", False)
        pdh_ch   = int(ask("    PDH channel", idx) or idx)
        motors.append({"name": mname, "can_id": can_id, "inverted": inverted, "pdh_ch": pdh_ch})
        if not ask_bool("  Add another motor?", False): break

    header("Encoder & Gearing")
    vendor = MOTOR_TYPES[motor_type][1]
    enc_options = {k: v for k, v in ENCODER_TYPES.items() if vendor in v[1]}
    for i, (k, v) in enumerate(enc_options.items(), 1):
        print(f"  {i}) {v[0]}")
    ei = int(ask("Choose encoder", 1) or 1) - 1
    encoder_type = list(enc_options.keys())[max(0, min(ei, len(enc_options)-1))]

    cancoder_id = 0
    if encoder_type == "cancoder":
        cancoder_id = int(ask("  CANcoder CAN ID", 0) or 0)

    motor_to_encoder_ratio = float(ask("  Motor→Encoder ratio (1.0 = same shaft)", 1.0) or 1.0)
    motor_to_mech_ratio    = float(ask("  Motor→Mechanism ratio (gearbox reduction)", 1.0) or 1.0)

    header("Control Mode")
    print("  1) Velocity — RPM control  2) Position — degree control  3) Open-loop")
    mode = {"1":"velocity","2":"position","3":"open_loop"}.get(ask("Choose","1"),"velocity")

    if mode == "velocity":
        tunables = [
            {"key":"kP","label":"kP","default":0.005,"step":0.001},
            {"key":"kV","label":"kV (ff)","default":0.00018,"step":0.0001},
            {"key":"TargetRPM","label":"Target RPM","default":1000.0,"step":100.0},
        ]
    elif mode == "position":
        tunables = [
            {"key":"kP","label":"kP","default":0.1,"step":0.01},
            {"key":"kD","label":"kD","default":0.0,"step":0.001},
            {"key":"TargetDeg","label":"Target °","default":0.0,"step":5.0},
        ]
    else:
        tunables = []

    limit_fwd = {"enabled": False, "normally_open": True}
    limit_rev = {"enabled": False, "normally_open": True, "auto_zero": True}
    if mode == "position" and not encoder_is_absolute(encoder_type):
        header("Limit Switches")
        if ask_bool("  Forward (max travel) limit switch?", False):
            limit_fwd["enabled"] = True
            limit_fwd["normally_open"] = ask_bool("    Normally open?", True)
        if ask_bool("  Reverse (home) limit switch?", False):
            limit_rev["enabled"] = True
            limit_rev["normally_open"] = ask_bool("    Normally open?", True)
            limit_rev["auto_zero"] = ask_bool("    Auto-zero encoder when hit?", True)

    header("State Machine States")
    raw = input("  States (comma-separated):\n> ").strip()
    states = [x.strip() for x in raw.split(",") if x.strip()] or ["idle","running","fault"]

    return {
        "name": name, "can_bus": can_bus, "motors": motors, "motor_type": motor_type,
        "encoder_type": encoder_type, "cancoder_id": cancoder_id,
        "motor_to_encoder_ratio": motor_to_encoder_ratio,
        "motor_to_mech_ratio": motor_to_mech_ratio,
        "mode": mode, "tunables": tunables, "states": states,
        "limit_fwd": limit_fwd, "limit_rev": limit_rev,
    }

# ─── Java generation ──────────────────────────────────────────────────────────

def gen_subsystem(cfg):
    name       = cfg["name"]
    motors     = cfg["motors"]
    mode       = cfg["mode"]
    tunables   = cfg["tunables"]
    states     = cfg["states"]
    leader     = motors[0]
    followers  = motors[1:]

    motor_type  = cfg.get("motor_type", "kraken_x60")
    enc_type    = cfg.get("encoder_type", "integrated")
    cancoder_id = cfg.get("cancoder_id", 0)
    m2enc       = float(cfg.get("motor_to_encoder_ratio", 1.0))
    m2mech      = float(cfg.get("motor_to_mech_ratio", 1.0))
    can_bus     = cfg.get("can_bus", "").strip()
    limit_fwd   = cfg.get("limit_fwd", {"enabled": False, "normally_open": True})
    limit_rev   = cfg.get("limit_rev", {"enabled": False, "normally_open": True, "auto_zero": True})

    ctre      = is_ctre(cfg)
    rev       = not ctre
    hcls      = hw_class(cfg)
    is_vortex = motor_type == "neo_vortex"
    enc_abs   = encoder_is_absolute(enc_type)
    has_limits = (mode == "position" and not enc_abs
                  and (limit_fwd.get("enabled") or limit_rev.get("enabled")))

    leader_var = _camel(leader["name"])
    const_cls = f"Constants.{name}"

    def D(key):
        return f"{const_cls}.{_const_ident(key)}_DEFAULT"

    def motor_const(m, suffix):
        return f"{const_cls}.{_const_ident(m['name'])}_{suffix}"

    cancoder_const = f"{const_cls}.CANCODER_CAN_ID"

    def find_tunable(*keywords):
        for t in tunables:
            for kw in keywords:
                if kw.lower() in t["key"].lower():
                    return t["key"]
        return None

    tgt_key = (find_tunable("rpm","target","velocity") if mode == "velocity"
               else find_tunable("deg","target","pos") if mode == "position"
               else None)
    kp_key  = find_tunable("kp")
    kv_key  = find_tunable("kv","kf")
    kd_key  = find_tunable("kd")

    # ── Imports ────────────────────────────────────────────────────────────────
    imports = [
        "package frc.robot.subsystems;",
        "",
        "import frc.robot.Constants;",
        "import frc.lib.telemetry.SubsystemTelemetry;",
        "import frc.lib.monitors.RobotHealthMonitor;",
        "import edu.wpi.first.wpilibj.RobotBase;",
    ]
    if ctre:
        imports += [
            f"import com.ctre.phoenix6.hardware.{hcls};",
            "import com.ctre.phoenix6.configs.TalonFXConfiguration;",
            "import com.ctre.phoenix6.signals.InvertedValue;",
        ]
        if mode == "velocity":
            imports.append("import com.ctre.phoenix6.controls.VelocityVoltage;")
        elif mode == "position":
            imports.append("import com.ctre.phoenix6.controls.PositionVoltage;")
        else:
            imports.append("import com.ctre.phoenix6.controls.DutyCycleOut;")
        if followers:
            imports += [
                "import com.ctre.phoenix6.controls.Follower;",
                "import com.ctre.phoenix6.signals.MotorAlignmentValue;",
            ]
        if enc_type == "cancoder":
            imports += [
                "import com.ctre.phoenix6.hardware.CANcoder;",
                "import com.ctre.phoenix6.configs.CANcoderConfiguration;",
                "import com.ctre.phoenix6.signals.FeedbackSensorSourceValue;",
            ]
        if tunables and mode in ("velocity", "position"):
            imports.append("import com.ctre.phoenix6.configs.Slot0Configs;")
        if has_limits:
            imports += [
                "import com.ctre.phoenix6.signals.ForwardLimitTypeValue;",
                "import com.ctre.phoenix6.signals.ReverseLimitTypeValue;",
                "import com.ctre.phoenix6.signals.ForwardLimitValue;",
                "import com.ctre.phoenix6.signals.ReverseLimitValue;",
            ]
    else:
        spark_cls = "CANSparkFlex" if is_vortex else "CANSparkMax"
        imports += [
            f"import com.revrobotics.{spark_cls};",
            f"import com.revrobotics.{spark_cls}LowLevel.MotorType;",
            "import com.revrobotics.RelativeEncoder;",
            "import com.revrobotics.SparkPIDController;",
        ]
        if enc_type == "rev_absolute":
            imports += ["import com.revrobotics.AbsoluteEncoder;", "import com.revrobotics.SparkAbsoluteEncoder;"]
        elif enc_type == "rev_thruborg":
            imports.append("import com.revrobotics.SparkAbsoluteEncoder;")
        if has_limits:
            imports.append("import com.revrobotics.SparkLimitSwitch;")

    # ── Constants reference ────────────────────────────────────────────────────
    default_consts = [
        "    // ─── Constants ───────────────────────────────────────────────────────────────",
        f"    // Hardware IDs, ratios, states, and tunable defaults live in Constants.{name}.",
    ]

    # ── Hardware fields ────────────────────────────────────────────────────────
    hw_fields = ["    // ─── Hardware ─────────────────────────────────────────────────────────────"]
    if ctre:
        hw_fields.append(f"    private final {hcls} {leader_var};")
        for fol in followers:
            hw_fields.append(f"    private final {hcls} {_camel(fol['name'])};")
        if enc_type == "cancoder":
            hw_fields.append("    private final CANcoder cancoder;")
        if mode == "velocity":
            hw_fields.append("    private final VelocityVoltage velocityRequest = new VelocityVoltage(0);")
        elif mode == "position":
            hw_fields.append("    private final PositionVoltage positionRequest = new PositionVoltage(0);")
        else:
            hw_fields.append("    private final DutyCycleOut dutyCycleRequest = new DutyCycleOut(0);")
    else:
        spark_cls = "CANSparkFlex" if is_vortex else "CANSparkMax"
        hw_fields.append(f"    private final {spark_cls} {leader_var};")
        for fol in followers:
            hw_fields.append(f"    private final {spark_cls} {_camel(fol['name'])};")
        hw_fields += ["    private final RelativeEncoder encoder;", "    private final SparkPIDController pid;"]
        if has_limits and limit_fwd.get("enabled"):
            hw_fields.append("    private final SparkLimitSwitch fwdLimit;")
        if has_limits and limit_rev.get("enabled"):
            hw_fields.append("    private final SparkLimitSwitch revLimit;")

    # ── State fields ───────────────────────────────────────────────────────────
    state_fields = ["    // ─── State ────────────────────────────────────────────────────────────────"]
    if mode == "velocity":
        state_fields += [
            "    private double measuredVelocity = 0.0; // RPM",
            "    private double targetVelocityRpm = 0.0;",
            "    private double simVelocity       = 0.0;",
        ]
    elif mode == "position":
        state_fields += [
            "    private double measuredPosition = 0.0; // degrees",
            "    private double targetPositionDeg = 0.0;",
            "    private double simPosition      = 0.0;",
        ]
    else:
        state_fields.append("    private double outputPercent = 0.0;")
    state_fields += [
        f"    private boolean ready        = {str(mode == 'open_loop').lower()};",
        f"    private String  currentState = {const_cls}.STATES[0];",
        '    private String  fault        = "";',
        '    private String  warning      = "";',
    ]

    # ── Constructor ────────────────────────────────────────────────────────────
    ctor = [f"    public {name}Subsystem() {{"]

    def motor_ctor_expr(can_id_expr):
        return f"new {hcls}({can_id_expr}, {const_cls}.CAN_BUS)" if can_bus else f"new {hcls}({can_id_expr})"

    def cancoder_ctor_expr(cid_expr):
        return f"new CANcoder({cid_expr}, {const_cls}.CAN_BUS)" if can_bus else f"new CANcoder({cid_expr})"

    if ctre:
        leader_invert = (f"{motor_const(leader, 'INVERTED')} ? "
                         "InvertedValue.Clockwise_Positive : InvertedValue.CounterClockwise_Positive")
        ctor += [
            f"        {leader_var} = {motor_ctor_expr(motor_const(leader, 'CAN_ID'))};",
            "        var motorConfig = new TalonFXConfiguration();",
            f"        motorConfig.MotorOutput.Inverted = {leader_invert};",
        ]
        if enc_type == "cancoder":
            ctor += [
                f"        cancoder = {cancoder_ctor_expr(cancoder_const)};",
                "        motorConfig.Feedback.FeedbackSensorSource = FeedbackSensorSourceValue.RemoteCANcoder;",
                f"        motorConfig.Feedback.FeedbackRemoteSensorID = {cancoder_const};",
                f"        motorConfig.Feedback.RotorToSensorRatio = {const_cls}.MOTOR_TO_ENCODER_RATIO;",
            ]
        ctor.append(f"        motorConfig.Feedback.SensorToMechanismRatio = {const_cls}.MOTOR_TO_MECH_RATIO;")
        if mode == "velocity" and kp_key and kv_key:
            ctor += [f"        motorConfig.Slot0.kP = {D(kp_key)};", f"        motorConfig.Slot0.kV = {D(kv_key)};"]
        elif mode == "position" and kp_key:
            ctor.append(f"        motorConfig.Slot0.kP = {D(kp_key)};")
            if kd_key:
                ctor.append(f"        motorConfig.Slot0.kD = {D(kd_key)};")
        if has_limits:
            if limit_fwd.get("enabled"):
                fwd_t = "ForwardLimitTypeValue.NormallyOpen" if limit_fwd.get("normally_open") else "ForwardLimitTypeValue.NormallyClosed"
                ctor += [
                    "        motorConfig.HardwareLimitSwitch.ForwardLimitEnable = true;",
                    f"        motorConfig.HardwareLimitSwitch.ForwardLimitType   = {fwd_t};",
                ]
            if limit_rev.get("enabled"):
                rev_t = "ReverseLimitTypeValue.NormallyOpen" if limit_rev.get("normally_open") else "ReverseLimitTypeValue.NormallyClosed"
                ctor += [
                    "        motorConfig.HardwareLimitSwitch.ReverseLimitEnable = true;",
                    f"        motorConfig.HardwareLimitSwitch.ReverseLimitType   = {rev_t};",
                ]
                if limit_rev.get("auto_zero"):
                    ctor += [
                        "        motorConfig.HardwareLimitSwitch.ReverseLimitAutosetPositionEnable = true;",
                        "        motorConfig.HardwareLimitSwitch.ReverseLimitAutosetPositionValue  = 0.0;",
                    ]
        ctor.append(f"        {leader_var}.getConfigurator().apply(motorConfig);")
        for fol in followers:
            fv = _camel(fol["name"])
            align = (f"{motor_const(fol, 'INVERTED')} ? "
                     "MotorAlignmentValue.Opposed : MotorAlignmentValue.Aligned")
            ctor += [
                f"        {fv} = {motor_ctor_expr(motor_const(fol, 'CAN_ID'))};",
                f"        {fv}.setControl(new Follower({motor_const(leader, 'CAN_ID')}, {align}));",
            ]
    else:  # REV
        spark_cls = "CANSparkFlex" if is_vortex else "CANSparkMax"
        ctor += [
            f"        {leader_var} = new {spark_cls}({motor_const(leader, 'CAN_ID')}, MotorType.kBrushless);",
            f"        {leader_var}.restoreFactoryDefaults();",
            f"        {leader_var}.setInverted({motor_const(leader, 'INVERTED')});",
        ]
        if enc_type == "rev_absolute":
            ctor.append(f"        encoder = {leader_var}.getAbsoluteEncoder(SparkAbsoluteEncoder.Type.kDutyCycle);")
        elif enc_type == "rev_thruborg":
            ctor.append(f"        encoder = {leader_var}.getAbsoluteEncoder(SparkAbsoluteEncoder.Type.kDutyCycle);")
        else:
            ctor.append(f"        encoder = {leader_var}.getEncoder();")
        if mode == "velocity":
            ctor.append(f"        encoder.setVelocityConversionFactor(1.0 / {const_cls}.MOTOR_TO_MECH_RATIO);")
        elif mode == "position":
            ctor.append(f"        encoder.setPositionConversionFactor(360.0 / {const_cls}.MOTOR_TO_MECH_RATIO);")
        ctor += [f"        pid = {leader_var}.getPIDController();", "        pid.setFeedbackDevice(encoder);"]
        if kp_key: ctor.append(f"        pid.setP({D(kp_key)});")
        if mode == "velocity" and kv_key: ctor.append(f"        pid.setFF({D(kv_key)});")
        if mode == "position" and kd_key: ctor.append(f"        pid.setD({D(kd_key)});")
        if has_limits:
            if limit_fwd.get("enabled"):
                fwd_t = "SparkLimitSwitch.Type.kNormallyOpen" if limit_fwd.get("normally_open") else "SparkLimitSwitch.Type.kNormallyClosed"
                ctor += [f"        fwdLimit = {leader_var}.getForwardLimitSwitch({fwd_t});", "        fwdLimit.enableLimitSwitch(true);"]
            if limit_rev.get("enabled"):
                rev_t = "SparkLimitSwitch.Type.kNormallyOpen" if limit_rev.get("normally_open") else "SparkLimitSwitch.Type.kNormallyClosed"
                ctor += [f"        revLimit = {leader_var}.getReverseLimitSwitch({rev_t});", "        revLimit.enableLimitSwitch(true);"]
        ctor.append(f"        {leader_var}.burnFlash();")
        for fol in followers:
            fv = _camel(fol["name"])
            ctor += [
                f"        {fv} = new {spark_cls}({motor_const(fol, 'CAN_ID')}, MotorType.kBrushless);",
                f"        {fv}.restoreFactoryDefaults();",
                f"        {fv}.follow({leader_var}, {motor_const(fol, 'INVERTED')});",
                f"        {fv}.burnFlash();",
            ]

    mode_nt = "velocity" if mode == "velocity" else "position" if mode == "position" else "open_loop"
    ctor += [
        "",
        f"        telemetry = new SubsystemTelemetry({const_cls}.SUBSYSTEM_NAME, {const_cls}.CONTROL_MODE);",
    ]
    for t in tunables:
        ctor.append(f'        telemetry.registerTunable("{t["key"]}", {D(t["key"])});')
    ctor.append("    }")

    # ── periodic() ────────────────────────────────────────────────────────────
    periodic = ["    public void periodic() {"]

    target_field = "targetVelocityRpm" if mode == "velocity" else "targetPositionDeg"
    tgt_camel = target_field

    if tunables:
        periodic.append("        // ── Live tunables ────────────────────────────────────────────────────────")
        for t in tunables:
            periodic.append(f'        double {_camel(t["key"])} = telemetry.getTunable("{t["key"]}", {D(t["key"])});')
        periodic.append("")
        if ctre and mode in ("velocity", "position"):
            periodic += ["        var slot0 = new Slot0Configs();"]
            if kp_key: periodic.append(f"        slot0.kP = {_camel(kp_key)};")
            if mode == "velocity" and kv_key: periodic.append(f"        slot0.kV = {_camel(kv_key)};")
            if mode == "position" and kd_key: periodic.append(f"        slot0.kD = {_camel(kd_key)};")
            periodic.append(f"        {leader_var}.getConfigurator().apply(slot0);")
            periodic.append("")
        elif rev and mode in ("velocity", "position"):
            if kp_key: periodic.append(f"        pid.setP({_camel(kp_key)});")
            if mode == "velocity" and kv_key: periodic.append(f"        pid.setFF({_camel(kv_key)});")
            if mode == "position" and kd_key: periodic.append(f"        pid.setD({_camel(kd_key)});")
            periodic.append("")

    if tgt_key:
        periodic.append(f"        {target_field} = {_camel(tgt_key)};")
        periodic.append("")

    if has_limits and rev and limit_rev.get("enabled") and limit_rev.get("auto_zero"):
        periodic += [
            "        if (RobotBase.isReal() && revLimit.isPressed()) encoder.setPosition(0.0);",
            "",
        ]

    periodic.append("        // ── Sensors ──────────────────────────────────────────────────────────────")
    kp_c = _camel(kp_key) if kp_key and tunables else (str(next((t["default"] for t in tunables if "kp" in t["key"].lower()), 0.1)))
    kv_c = _camel(kv_key) if kv_key and tunables else "0.0"

    if mode == "velocity":
        periodic.append("        if (RobotBase.isReal()) {")
        periodic.append(f"            measuredVelocity = {leader_var}.getVelocity().getValueAsDouble() * 60.0;" if ctre else f"            measuredVelocity = encoder.getVelocity();")
        periodic += [
            "        } else {",
            f"            double err = {tgt_camel} - simVelocity;",
            f"            simVelocity += err * {kp_c} * 50.0 + {tgt_camel} * {kv_c};",
            "            simVelocity  = Math.max(0, simVelocity);",
            "            measuredVelocity = simVelocity;",
            "        }",
            f"        ready   = Math.abs({tgt_camel} - measuredVelocity) < 50.0;",
            f'        warning = (Math.abs({tgt_camel} - measuredVelocity) > 200 && measuredVelocity > 50) ? "{name}: not at target" : "";',
        ]
    elif mode == "position":
        periodic.append("        if (RobotBase.isReal()) {")
        periodic.append(f"            measuredPosition = {leader_var}.getPosition().getValueAsDouble() * 360.0;" if ctre else f"            measuredPosition = encoder.getPosition();")
        periodic += [
            "        } else {",
            f"            simPosition += ({tgt_camel} - simPosition) * {kp_c};",
            "            measuredPosition = simPosition;",
            "        }",
            f"        ready   = Math.abs({tgt_camel} - measuredPosition) < 2.0;",
            f'        warning = (Math.abs({tgt_camel} - measuredPosition) > 10.0) ? "{name}: not at target" : "";',
        ]
    else:
        periodic.append("        // open-loop — no sensor feedback")

    periodic.append("")
    if mode == "velocity":
        periodic.append(f"        telemetry.publish(measuredVelocity, {tgt_camel}, ready, currentState, fault, warning);")
    elif mode == "position":
        periodic.append(f"        telemetry.publish(measuredPosition, {tgt_camel}, ready, currentState, fault, warning);")
    else:
        periodic.append("        telemetry.publish(outputPercent, 0, ready, currentState, fault, warning);")

    periodic += [
        "    }",
        "",
        "    public void simulationPeriodic() { /* periodic() handles both real and sim */ }",
    ]

    health = [
        "",
        "    public void registerHealthDevices(RobotHealthMonitor health) {",
    ]
    if ctre:
        for motor in motors:
            mv = _camel(motor["name"])
            health += [
                "        health.registerTalonFX(",
                f"            {const_cls}.SUBSYSTEM_NAME,",
                f"            \"{motor['name']}\",",
                f"            {motor_const(motor, 'CAN_ID')},",
                f"            {const_cls}.CAN_BUS,",
                f"            {mv}",
                "        );",
            ]
    else:
        health.append("        // REV device health registration is not supported by RobotHealthMonitor yet.")
    health.append("    }")

    # ── Control API ────────────────────────────────────────────────────────────
    control = ["    // ─── Control API ──────────────────────────────────────────────────────────"]
    if mode == "velocity":
        ctrl_line = (f"        if (RobotBase.isReal()) {leader_var}.setControl(velocityRequest.withVelocity(rpm / 60.0));"
                     if ctre else
                     f"        if (RobotBase.isReal()) pid.setReference(rpm, {('CANSparkFlex' if is_vortex else 'CANSparkMax')}.ControlType.kVelocity);")
        control += [
            "    /** Command target velocity in RPM. */",
            "    public void setTargetVelocity(double rpm) {",
            "        targetVelocityRpm = rpm;",
            ctrl_line,
            "    }",
            "    public double getVelocity()       { return measuredVelocity; }",
        ]
    elif mode == "position":
        ctrl_line = (f"        if (RobotBase.isReal()) {leader_var}.setControl(positionRequest.withPosition(degrees / 360.0));"
                     if ctre else
                     f"        if (RobotBase.isReal()) pid.setReference(degrees, {('CANSparkFlex' if is_vortex else 'CANSparkMax')}.ControlType.kPosition);")
        control += [
            "    /** Command target position in degrees. */",
            "    public void setTargetPosition(double degrees) {",
            "        targetPositionDeg = degrees;",
            ctrl_line,
            "    }",
            "    public double getPosition()       { return measuredPosition; }",
        ]
        if has_limits:
            if ctre:
                if limit_fwd.get("enabled"):
                    control.append(f"    public boolean isAtForwardLimit() {{ return RobotBase.isReal() && {leader_var}.getForwardLimit().getValue() == ForwardLimitValue.ClosedToGround; }}")
                if limit_rev.get("enabled"):
                    control.append(f"    public boolean isAtReverseLimit() {{ return RobotBase.isReal() && {leader_var}.getReverseLimit().getValue() == ReverseLimitValue.ClosedToGround; }}")
            else:
                if limit_fwd.get("enabled"):
                    control.append("    public boolean isAtForwardLimit() { return RobotBase.isReal() && fwdLimit.isPressed(); }")
                if limit_rev.get("enabled"):
                    control.append("    public boolean isAtReverseLimit() { return RobotBase.isReal() && revLimit.isPressed(); }")
    else:
        out_line = (f"        if (RobotBase.isReal()) {leader_var}.setControl(dutyCycleRequest.withOutput(outputPercent));"
                    if ctre else f"        if (RobotBase.isReal()) {leader_var}.set(outputPercent);")
        control += [
            "    /** Set open-loop output (-1 to 1). */",
            "    public void setOutput(double percent) {",
            "        outputPercent = Math.max(-1.0, Math.min(1.0, percent));",
            out_line,
            "    }",
            "    public double getOutput() { return outputPercent; }",
        ]

    if mode == "velocity":
        self_test_command = "        setTargetVelocity(value);"
        sim_current = f"        return (Math.abs(targetVelocityRpm) / Math.max(1.0, {const_cls}.SELF_TEST_OUTPUT)) * 8.0;"
    elif mode == "position":
        self_test_command = "        setTargetPosition(value);"
        sim_current = f"        return Math.min(12.0, Math.abs(targetPositionDeg - measuredPosition) * 0.5 + 2.0);"
    else:
        self_test_command = "        setOutput(value);"
        sim_current = "        return Math.abs(outputPercent) * 14.0;"

    if ctre:
        current_terms = " + ".join(f"{_camel(m['name'])}.getSupplyCurrent().refresh(false).getValueAsDouble()" for m in motors)
        temp_values = [f"{_camel(m['name'])}.getDeviceTemp().refresh(false).getValueAsDouble()" for m in motors]
        temp_expr = temp_values[0]
        for value in temp_values[1:]:
            temp_expr = f"Math.max({temp_expr}, {value})"
        real_current = f"        if (RobotBase.isReal()) return {current_terms};"
        real_temp = f"        if (RobotBase.isReal()) return {temp_expr};"
    else:
        real_current = f"        if (RobotBase.isReal()) return {leader_var}.getOutputCurrent();"
        real_temp = f"        if (RobotBase.isReal()) return {leader_var}.getMotorTemperature();"

    control += [
        "",
        "    /** Runs the generated self-test movement. TODO: tune the movement to match real mechanism limits. */",
        "    public void runSelfTest(double value) {",
        self_test_command,
        "    }",
        "",
        "    /** Stops any generated self-test movement. */",
        "    public void stopSelfTest() {",
    ]
    if mode == "velocity":
        control.append("        setTargetVelocity(0.0);")
    elif mode == "position":
        control.append("        setTargetPosition(measuredPosition);")
    else:
        control.append("        setOutput(0.0);")
    control += [
        "    }",
        "",
        "    /** Supply current from this subsystem's generated motors (A). */",
        "    public double getSupplyCurrentA() {",
        real_current,
        sim_current,
        "    }",
        "",
        "    /** Highest generated motor controller temperature (C). */",
        "    public double getTemperatureC() {",
        real_temp,
        "        return 25.0;",
        "    }",
    ]

    # ── State machine ──────────────────────────────────────────────────────────
    sm = [
        "",
        "    // ─── State Machine ───────────────────────────────────────────────────────────",
        f"    // Valid states: {', '.join(repr(s) for s in states)}",
        "    public void setState(String newState) {",
        "        if (newState.equals(currentState)) return;",
        "        onExitState(currentState);",
        "        currentState = newState;",
        "        onEnterState(newState);",
        "    }",
        "",
        "    private void onEnterState(String state) {",
        "        switch (state) {",
    ]
    for s in states:
        sm += [f'            case "{s}":', f'                // Add state-specific commands for "{s}" here.', "                break;"]
    sm += [
        "            default: break;",
        "        }",
        "    }",
        "",
        "    private void onExitState(String state) { /* cleanup on state exit */ }",
        "",
        "    public String  getState()   { return currentState; }",
        "    public boolean isReady()    { return ready; }",
        "    public String  getFault()   { return fault; }",
        "    public String  getWarning() { return warning; }",
    ]

    # ── Javadoc ────────────────────────────────────────────────────────────────
    motor_doc = "\n".join(
        f" *   {m['name']} (CAN {m['can_id']}) {'[leader]' if j == 0 else '[follower]'}"
        for j, m in enumerate(motors)
    )
    can_doc = f" * CAN bus  : {can_bus if can_bus else 'default (rio)'}\n"
    lim_doc = ""
    if has_limits:
        if limit_fwd.get("enabled"): lim_doc += " *   Forward limit: enabled\n"
        if limit_rev.get("enabled"):
            lim_doc += " *   Reverse limit: enabled"
            if limit_rev.get("auto_zero"): lim_doc += " (auto-zero)"
            lim_doc += "\n"

    javadoc = (
        f"/**\n * {name}Subsystem — generated by 3544 FRC Code Generator.\n *\n"
        f" * Motor   : {MOTOR_TYPES.get(motor_type, ('?',))[0]} ({hcls})\n"
        f" * Encoder : {ENCODER_TYPES.get(enc_type, ('?',))[0]}\n"
        f" * Ratios  : Motor→Encoder {m2enc}:1  |  Motor→Mechanism {m2mech}:1\n"
        f" * Control : {mode}   States: {', '.join(states)}\n"
        + can_doc + lim_doc
        + f" *\n * Motors:\n{motor_doc}\n"
        + " *\n * Freely edit: onEnterState(), onExitState(), setTarget*(), setOutput().\n"
        + " * Do not remove the telemetry.publish() call in periodic().\n"
        + " */"
    )
    config_marker = (
        "/* 3544-GENERATOR-CONFIG\n"
        + json.dumps(cfg, indent=2, sort_keys=True)
        + "\n*/"
    )

    # ── Assemble ───────────────────────────────────────────────────────────────
    sections = [
        *imports, "",
        javadoc,
        config_marker,
        f"public class {name}Subsystem {{",
        "",
        *default_consts,
        "",
        *hw_fields,
        "",
        *state_fields,
        "",
        "    // ─── Telemetry ────────────────────────────────────────────────────────────────",
        "    private final SubsystemTelemetry telemetry;",
        "",
        "    // ─── Constructor ─────────────────────────────────────────────────────────────",
        *ctor,
        "",
        "    // ─── Periodic ────────────────────────────────────────────────────────────────",
        *periodic,
        *health,
        "",
        *control,
        *sm,
        "}",
        "",
    ]
    return "\n".join(sections)


# ─── File patchers ────────────────────────────────────────────────────────────

def gen_constants_class(cfg):
    name = cfg["name"]
    motors = cfg["motors"]
    tunables = cfg.get("tunables", [])
    enc_type = cfg.get("encoder_type", "integrated")
    mode = cfg.get("mode", "velocity")
    target_tunable = next((t for t in tunables if any(k in t["key"].lower() for k in ("target", "rpm", "deg", "pos"))), None)
    if mode == "open_loop":
        self_test_output = 0.2
    elif target_tunable:
        self_test_output = float(target_tunable.get("default", 0.0))
    elif mode == "velocity":
        self_test_output = 100.0
    else:
        self_test_output = 5.0

    lines = [
        f"    // BEGIN 3544-GENERATOR {name}",
        f"    public static final class {name} {{",
        f"        private {name}() {{}}",
        "",
        "        // Identity",
        f"        public static final String SUBSYSTEM_NAME = {_java_string(name)};",
        f"        public static final String CAN_BUS = {_java_string(cfg.get('can_bus', '').strip())};",
        f"        public static final String MOTOR_TYPE = {_java_string(cfg.get('motor_type', 'kraken_x60'))};",
        f"        public static final String ENCODER_TYPE = {_java_string(enc_type)};",
        f"        public static final String CONTROL_MODE = {_java_string(cfg.get('mode', 'velocity'))};",
        "",
        "        // Hardware IDs",
    ]
    for m in motors:
        prefix = _const_ident(m["name"])
        lines += [
            f"        public static final int {prefix}_CAN_ID = {int(m.get('can_id', 0))};",
            f"        public static final int {prefix}_PDH_CHANNEL = {int(m.get('pdh_ch', 0))};",
            f"        public static final boolean {prefix}_INVERTED = {str(bool(m.get('inverted', False))).lower()};",
        ]
    if enc_type == "cancoder":
        lines.append(f"        public static final int CANCODER_CAN_ID = {int(cfg.get('cancoder_id', 0))};")

    lines += [
        "",
        "        // Gear ratios",
        f"        public static final double MOTOR_TO_MECH_RATIO = {float(cfg.get('motor_to_mech_ratio', 1.0))};",
    ]
    if enc_type != "integrated":
        lines.append(f"        public static final double MOTOR_TO_ENCODER_RATIO = {float(cfg.get('motor_to_encoder_ratio', 1.0))};")

    lines += [
        "",
        "        // Live tunable defaults",
    ]
    if tunables:
        for t in tunables:
            lines.append(f"        public static final double {_const_ident(t['key'])}_DEFAULT = {float(t.get('default', 0.0))};")
            lines.append(f"        public static final double {_const_ident(t['key'])}_STEP = {float(t.get('step', 0.01))};")
    else:
        lines.append("        // No tunables for this subsystem.")

    state_literals = ", ".join(_java_string(s) for s in cfg.get("states", []))
    lines += [
        "",
        "        // Self-test defaults",
        "        public static final boolean SELF_TEST_ENABLED = true;",
        f"        public static final double SELF_TEST_OUTPUT = {self_test_output};",
        "        public static final double SELF_TEST_DURATION_SEC = 1.0;",
        f"        public static final String SELF_TEST_TODO = {_java_string('TODO: tune this self-test movement for the real ' + name + ' mechanism. The generated default is intentionally gentle.')};",
        "",
        "        // State machine",
        f"        public static final String[] STATES = new String[]{{{state_literals}}};",
        "    }",
        f"    // END 3544-GENERATOR {name}",
    ]
    return "\n".join(lines)

def patch_constants(cfg):
    name = cfg["name"]
    block = gen_constants_class(cfg)
    if not os.path.exists(CONSTANTS_FILE):
        os.makedirs(os.path.dirname(CONSTANTS_FILE), exist_ok=True)
        with open(CONSTANTS_FILE, "w") as f:
            f.write(
                "package frc.robot;\n\n"
                "/** Robot-wide constants grouped one class per subsystem. */\n"
                "public final class Constants {\n"
                "    private Constants() {}\n\n"
                f"{block}\n"
                "}\n"
            )
        return True

    def apply(src):
        begin = f"    // BEGIN 3544-GENERATOR {name}"
        end = f"    // END 3544-GENERATOR {name}"
        pattern = re.compile(re.escape(begin) + r".*?" + re.escape(end), re.DOTALL)
        if pattern.search(src):
            return pattern.sub(block, src)
        close = src.rfind("}")
        if close == -1:
            return src
        insert = ("\n\n" if not src[:close].endswith("\n\n") else "") + block + "\n"
        return src[:close] + insert + src[close:]

    return _patch_file(CONSTANTS_FILE, [("subsystem constants", apply)])

def load_subsystem_config(path):
    with open(path) as f:
        src = f.read()

    m = re.search(r'/\*\s*3544-GENERATOR-CONFIG\s*(\{.*?\})\s*\*/', src, re.DOTALL)
    if m:
        return json.loads(m.group(1))

    basename = os.path.basename(path).replace("Subsystem.java", "")
    cfg = {
        "name": basename or "MySubsystem",
        "can_bus": "",
        "motors": [],
        "motor_type": "kraken_x60",
        "encoder_type": "integrated",
        "cancoder_id": 0,
        "motor_to_encoder_ratio": 1.0,
        "motor_to_mech_ratio": 1.0,
        "mode": "velocity",
        "tunables": [],
        "states": ["idle", "running", "fault"],
        "limit_fwd": {"enabled": False, "normally_open": True},
        "limit_rev": {"enabled": False, "normally_open": True, "auto_zero": True},
    }

    motor_doc = re.search(r'\* Motor\s*: ([^(]+)\(([^)]+)\)', src)
    if motor_doc:
        hw = motor_doc.group(2).strip()
        for key, meta in MOTOR_TYPES.items():
            if meta[2] == hw or meta[0] in motor_doc.group(1):
                cfg["motor_type"] = key
                break

    enc_doc = re.search(r'\* Encoder\s*: ([^\n]+)', src)
    if enc_doc:
        enc_text = enc_doc.group(1).strip()
        for key, meta in ENCODER_TYPES.items():
            if meta[0] in enc_text:
                cfg["encoder_type"] = key
                break

    ratio_doc = re.search(r'Motor[→-]Encoder\s+([0-9.]+):1\s+\|\s+Motor[→-]Mechanism\s+([0-9.]+):1', src)
    if ratio_doc:
        cfg["motor_to_encoder_ratio"] = float(ratio_doc.group(1))
        cfg["motor_to_mech_ratio"] = float(ratio_doc.group(2))

    mode_doc = re.search(r'\* Control\s*: ([A-Za-z_]+)', src)
    if mode_doc:
        cfg["mode"] = mode_doc.group(1).strip()

    states_doc = re.search(r'States:? ([^\n]+)', src)
    if states_doc:
        states = [s.strip(" :'\",") for s in states_doc.group(1).split(",") if s.strip(" :'\",")]
        if states:
            cfg["states"] = states

    for mm in re.finditer(r'\*\s+([A-Za-z_][A-Za-z0-9_]*) \(CAN (\d+)\) \[(leader|follower)\]', src):
        cfg["motors"].append({
            "name": mm.group(1),
            "can_id": int(mm.group(2)),
            "pdh_ch": len(cfg["motors"]),
            "inverted": False,
        })
    if not cfg["motors"]:
        cfg["motors"] = [{"name": "LeaderMotor", "can_id": 0, "pdh_ch": 0, "inverted": False}]

    cancoder_m = re.search(r'new CANcoder\((\d+)', src)
    if cancoder_m:
        cfg["cancoder_id"] = int(cancoder_m.group(1))

    for tm in re.finditer(r'registerTunable\("([^"]+)",\s*Constants\.' + re.escape(cfg["name"]) + r'\.([A-Z0-9_]+)_DEFAULT\)', src):
        key = tm.group(1)
        cfg["tunables"].append({"key": key, "label": key, "default": 0.0, "step": 0.01})
    return cfg

def _patch_file(path, patches):
    with open(path) as f:
        src = f.read()
    changed = False
    for _desc, fn in patches:
        new = fn(src)
        if new != src:
            src = new
            changed = True
    if changed:
        with open(path, "w") as f:
            f.write(src)
    return changed


def patch_robot_container(cfg):
    name = cfg["name"]
    var  = _camel(name)
    const_cls = f"Constants.{name}"

    rc_changed = _patch_file(ROBOT_CONTAINER, [
        ("import", lambda src: _insert_after_last_import(
            src, f"import frc.robot.subsystems.{name}Subsystem;")),
        ("field", lambda src: _insert_after_pattern(
            src, r'public class RobotContainer \{',
            f"    private final {name}Subsystem {var} = new {name}Subsystem();"
        ) if f"{name}Subsystem {var}" not in src else src),
        ("periodic", lambda src: _insert_before_pattern(
            src, r'        dashboard\.periodic\(\);',
            f"        {var}.periodic();"
        ) if f"{var}.periodic();" not in src else src),
        ("simulation-periodic", lambda src: _append_robot_sim_periodic(src, var)),
        ("dm-arg", lambda src: _append_dashboard_manager_arg(src, var)),
        ("self-test-arg", lambda src: _append_constructor_arg(src, "new SelfTestCommand", var)),
    ])

    dm_changed = False
    if os.path.exists(DASHBOARD_MANAGER):
        dm_changed = _patch_file(DASHBOARD_MANAGER, [
            ("import", lambda src: _insert_after_last_import(
                src, f"import frc.robot.subsystems.{name}Subsystem;")),
            ("field", lambda src: _append_dashboard_field(src, name, var)),
            ("ctor-param", lambda src: _append_ctor_param(src, name, var)),
            ("ctor-assign", lambda src: _insert_before_pattern(
                src, r'        // ── NT setup',
                f"        this.{var} = {var};"
            ) if f"this.{var} = {var};" not in src else src),
            ("pdh", lambda src: _append_pdh_registers(src, cfg)),
            ("health-register", lambda src: _append_health_register(src, name, var)),
            ("names", lambda src: _append_subsystem_name(src, name)),
            ("health", lambda src: _append_health_entry(src, name, var)),
        ])

    if rc_changed:  print("  ✓ Patched RobotContainer.java")
    else:           print("  ~ RobotContainer.java already up-to-date")
    if dm_changed:  print("  ✓ Patched DashboardManager.java")
    elif os.path.exists(DASHBOARD_MANAGER):
                    print("  ~ DashboardManager.java already up-to-date")
    else:           print("  ⚠ DashboardManager.java not found — skipped")

    st_changed = False
    if os.path.exists(SELF_TEST_COMMAND):
        st_changed = patch_self_test_command(cfg)
    if st_changed:  print("  ✓ Patched SelfTestCommand.java")
    elif os.path.exists(SELF_TEST_COMMAND):
                    print("  ~ SelfTestCommand.java already up-to-date")

def validate_robot_wiring(cfg):
    name = cfg["name"]
    var = _camel(name)
    cls = f"{name}Subsystem"
    const_cls = f"Constants.{name}"
    errors = []

    if os.path.exists(ROBOT_CONTAINER):
        with open(ROBOT_CONTAINER) as f:
            rc = f.read()
        if f"import frc.robot.subsystems.{cls};" not in rc:
            errors.append(f"RobotContainer.java is missing import for {cls}")
        if f"{cls} {var}" not in rc:
            errors.append(f"RobotContainer.java is missing field for {var}")
        dm_call = re.search(r'new DashboardManager\(([^)]*)\)', rc, re.DOTALL)
        if not dm_call or not re.search(rf'\b{re.escape(var)}\b', dm_call.group(1)):
            errors.append(f"RobotContainer.java does not pass {var} to DashboardManager")
        if f"{var}.periodic();" not in rc:
            errors.append(f"RobotContainer.java does not call {var}.periodic()")

    if os.path.exists(DASHBOARD_MANAGER):
        with open(DASHBOARD_MANAGER) as f:
            dm = f.read()
        if f"import frc.robot.subsystems.{cls};" not in dm:
            errors.append(f"DashboardManager.java is missing import for {cls}")
        if not re.search(rf'\b{re.escape(cls)}\s+{re.escape(var)}\b', dm):
            errors.append(f"DashboardManager.java is missing field or constructor parameter for {var}")
        ctor = re.search(r'public DashboardManager\(([^)]*)\)', dm, re.DOTALL)
        if not ctor or not re.search(rf'\b{re.escape(cls)}\s+{re.escape(var)}\b', ctor.group(1)):
            errors.append(f"DashboardManager constructor is missing parameter {cls} {var}")
        if not re.search(rf'\bthis\.{re.escape(var)}\s*=\s*{re.escape(var)};', dm):
            errors.append(f"DashboardManager constructor does not assign {var}")
        if f"healthMonitor.updateSubsystem({const_cls}.SUBSYSTEM_NAME" not in dm:
            errors.append(f"DashboardManager health status is missing {name}")

    if os.path.exists(SELF_TEST_COMMAND):
        with open(SELF_TEST_COMMAND) as f:
            st = f.read()
        if f"import frc.robot.subsystems.{cls};" not in st:
            errors.append(f"SelfTestCommand.java is missing import for {cls}")
        if not re.search(rf'\b{re.escape(cls)}\s+{re.escape(var)}\b', st):
            errors.append(f"SelfTestCommand.java is missing field or constructor parameter for {var}")
        if not re.search(rf'\bthis\.{re.escape(var)}\s*=\s*{re.escape(var)};', st):
            errors.append(f"SelfTestCommand constructor does not assign {var}")
        if f'Constants.{name}.SELF_TEST_ENABLED' not in st and not _self_test_has_manual_step(st, name):
            errors.append(f"SelfTestCommand steps are missing {name}")

    if errors:
        raise RuntimeError("\n".join(errors))


# ── Patch helpers ──────────────────────────────────────────────────────────────

def _insert_after_last_import(src, line):
    if line in src: return src
    last = list(re.finditer(r'^import .*;', src, re.MULTILINE))
    if not last:
        m = re.search(r'^package [^;]+;', src, re.MULTILINE)
        if not m:
            return src
        return src[:m.end()] + "\n\n" + line + src[m.end():]
    p = last[-1].end()
    return src[:p] + "\n" + line + src[p:]

def _insert_after_pattern(src, pattern, line):
    m = re.search(pattern, src)
    if not m: return src
    p = src.index('\n', m.end()) + 1
    return src[:p] + line + "\n" + src[p:]

def _insert_before_pattern(src, pattern, line):
    m = re.search(pattern, src)
    if not m: return src
    return src[:m.start()] + line + "\n" + src[m.start():]

def _append_dashboard_manager_arg(src, var):
    return _append_constructor_arg(src, "new DashboardManager", var)

def _append_constructor_arg(src, call_name, var):
    loc = _find_call_span(src, call_name)
    if not loc: return src
    start, close = loc
    call = src[start:close + 1]
    if re.search(rf'\b{re.escape(var)}\b', call): return src
    prefix = src[start:close]
    sep = "" if prefix.rstrip().endswith("(") else ", "
    return src[:start] + prefix + f"{sep}{var})" + src[close + 1:]

def _find_call_span(src, call_name):
    start = src.find(call_name + "(")
    if start == -1:
        return None
    depth = 0
    in_string = False
    escaped = False
    for i in range(start + len(call_name), len(src)):
        ch = src[i]
        if in_string:
            escaped = (ch == "\\" and not escaped)
            if ch == '"' and not escaped:
                in_string = False
            elif ch != "\\":
                escaped = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return start, i
    return None

def _append_ctor_param(src, name, var):
    cls = f"{name}Subsystem"
    m = re.search(r'(public DashboardManager\([^)]*)\)', src)
    if not m: return src
    if re.search(rf'public DashboardManager\([^)]*\b{re.escape(cls)}\s+{re.escape(var)}\b', m.group(0), re.DOTALL):
        return src
    prefix = m.group(1)
    sep = "" if prefix.rstrip().endswith("(") else ",\n                            "
    return src[:m.start(1)] + prefix + f"{sep}{cls} {var}" + ")" + src[m.end():]

def _append_robot_sim_periodic(src, var):
    line = f"        {var}.simulationPeriodic();"
    if line in src:
        return src
    m = re.search(r'(public void simulationPeriodic\(\) \{\n)(.*?)(    \})', src, re.DOTALL)
    if not m:
        return src
    return src[:m.end(1)] + line + "\n" + src[m.end(1):]

def _append_dashboard_field(src, name, var):
    if f"{name}Subsystem {var}" in src:
        return src
    field = f"    private final {name}Subsystem {var};"
    matches = list(re.finditer(r'^    private final \w+Subsystem \w+;', src, re.MULTILINE))
    if matches:
        p = matches[-1].end()
        return src[:p] + "\n" + field + src[p:]
    return _insert_after_pattern(
        src,
        r'    // ── Subsystem references \(read-only, passed in via constructor\) ───────────',
        field
    )

def _append_pdh_registers(src, cfg):
    name, motors = cfg["name"], cfg["motors"]
    const_cls = f"Constants.{name}"
    if f'PowerMonitor.register("{name}"' in src or f"PowerMonitor.register({const_cls}.SUBSYSTEM_NAME" in src:
        return src
    block = "\n".join(
        f'        PowerMonitor.register({const_cls}.SUBSYSTEM_NAME, "{m["name"]}", {const_cls}.{_const_ident(m["name"])}_PDH_CHANNEL);'
        for m in motors
    )
    last = list(re.finditer(r'PowerMonitor\.register\([^)]+\);', src))
    if not last:
        return _insert_after_pattern(
            src,
            r'        // ── PowerMonitor motor registration ───────────────────────────────────',
            block
        )
    p = last[-1].end()
    return src[:p] + "\n" + block + src[p:]

def _append_health_register(src, name, var):
    line = f"        {var}.registerHealthDevices(healthMonitor);"
    if line in src:
        return src
    matches = list(re.finditer(r'^        \w+\.registerHealthDevices\(healthMonitor\);', src, re.MULTILINE))
    if matches:
        p = matches[-1].end()
        return src[:p] + "\n" + line + src[p:]
    return _insert_after_pattern(
        src,
        r'        // ── Health device registration ─────────────────────────────────────────',
        line
    )

def _append_subsystem_name(src, name):
    const_name = f"Constants.{name}.SUBSYSTEM_NAME"
    m = re.search(r'(subsystemNamesPublisher\.set\(new String\[\]\s*\{)(.*?)(\n\s*\}\);)', src, re.DOTALL)
    if not m:
        return src
    if const_name in m.group(2):
        return src
    body = m.group(2).rstrip()
    comma = "," if body.strip() else ""
    addition = f"{comma}\n                {const_name}"
    return src[:m.start(2)] + body + addition + src[m.end(2):]

def _append_health_entry(src, name, var):
    const_name = f"Constants.{name}.SUBSYSTEM_NAME"
    if f"healthMonitor.updateSubsystem({const_name}" in src:
        return src
    entry = (
        f"        healthMonitor.updateSubsystem({const_name},\n"
        f"                {var}.isReady(), {var}.getState(), {var}.getFault(), {var}.getWarning());"
    )
    matches = list(re.finditer(r'^\s*healthMonitor\.updateSubsystem\([^;]+;\n?', src, re.MULTILINE))
    if matches:
        p = matches[-1].end()
        return src[:p] + entry + "\n" + src[p:]
    return _insert_before_pattern(src, r'    \}', entry)

def patch_self_test_command(cfg):
    name = cfg["name"]
    var = _camel(name)
    cls = f"{name}Subsystem"
    const_cls = f"Constants.{name}"

    return _patch_file(SELF_TEST_COMMAND, [
        ("import", lambda src: _insert_after_last_import(
            src, f"import frc.robot.subsystems.{cls};")),
        ("field", lambda src: _append_self_test_field(src, name, var)),
        ("ctor-param", lambda src: _append_ctor_param_for_class(src, "SelfTestCommand", cls, var)),
        ("ctor-assign", lambda src: _append_self_test_assignment(src, var)),
        ("steps", lambda src: _append_self_test_steps(src, name)),
        ("stop", lambda src: _append_switchless_line(src, "private void stopAllMotors()", f"        {var}.stopSelfTest();")),
        ("command", lambda src: _append_switch_case(src, "private void commandMotor", name, f"                {var}.runSelfTest(value);")),
        ("current", lambda src: _append_switch_case(src, "private double getSubsystemCurrent", name, f"                return {var}.getSupplyCurrentA();")),
        ("temp", lambda src: _append_switch_case(src, "private double getSubsystemTemp", name, f"                return {var}.getTemperatureC();")),
    ])

def _append_self_test_field(src, name, var):
    if re.search(rf'\b{name}Subsystem\s+{re.escape(var)};', src):
        return src
    field = f"    private final {name}Subsystem {var};"
    matches = list(re.finditer(r'^    private final \w+Subsystem \w+;', src, re.MULTILINE))
    if matches:
        p = matches[-1].end()
        return src[:p] + "\n" + field + src[p:]
    return _insert_after_pattern(src, r'    // ── Subsystems & services ─────────────────────────────────────────────────', field)

def _append_ctor_param_for_class(src, ctor_name, cls, var):
    m = re.search(rf'(public {re.escape(ctor_name)}\([^)]*)\)', src, re.DOTALL)
    if not m: return src
    if re.search(rf'\b{re.escape(cls)}\s+{re.escape(var)}\b', m.group(0), re.DOTALL):
        return src
    prefix = m.group(1)
    sep = "" if prefix.rstrip().endswith("(") else ",\n            "
    return src[:m.start(1)] + prefix + f"{sep}{cls} {var}" + ")" + src[m.end():]

def _append_self_test_assignment(src, var):
    if re.search(rf'\bthis\.{re.escape(var)}\s*=\s*{re.escape(var)};', src):
        return src
    line = f"        this.{var} = {var};"
    m = re.search(r'(\n\s*addRequirements\()', src)
    if m:
        return src[:m.start()] + "\n" + line + src[m.start():]
    matches = list(re.finditer(r'^        this\.\w+\s*=\s*\w+;\n?', src, re.MULTILINE))
    if matches:
        p = matches[-1].end()
        return src[:p] + line + "\n" + src[p:]
    return src

def _append_self_test_steps(src, name):
    marker = f"Constants.{name}.SELF_TEST_ENABLED"
    if marker in src:
        return src
    if _self_test_has_manual_step(src, name):
        return src
    block = (
        f"        // Generated {name} self-test. TODO: replace the generated movement with the real mechanism-safe action.\n"
        f"        if ({marker}) {{\n"
        f"            stepDefs.add(new StepDef(\"{_const_ident(name).lower()}_run\", \"{name}: Generated Movement\",\n"
        f"                    {const_step_desc(name)},\n"
        f"                    StepType.MOTOR_RUN, \"{name}\",\n"
        f"                    Constants.{name}.SELF_TEST_OUTPUT, Constants.{name}.SELF_TEST_DURATION_SEC, \"\"));\n"
        f"            stepDefs.add(new StepDef(\"{_const_ident(name).lower()}_stop\", \"{name}: Stop\",\n"
        f"                    \"Stop generated self-test movement and settle\",\n"
        f"                    StepType.WAIT, \"{name}\", 0, Constants.SelfTest.COAST_DOWN_SEC, \"\"));\n"
        f"        }}\n"
    )
    m = re.search(r'        // 5\. Post-run temperature snapshot', src)
    if m:
        return src[:m.start()] + block + "\n" + src[m.start():]
    return _insert_before_pattern(src, r'        // 6\. Gyro check', block)

def _self_test_has_manual_step(src, name):
    generated = re.search(rf'// Generated {re.escape(name)} self-test\..*?Constants\.{re.escape(name)}\.SELF_TEST_ENABLED', src, re.DOTALL)
    if generated:
        return False
    return re.search(rf'StepType\.MOTOR_RUN,\s*"{re.escape(name)}"', src) is not None

def const_step_desc(name):
    return (f"String.format(\"Generated default: %s Run %.2f for %.1f s\", "
            f"Constants.{name}.SELF_TEST_TODO, Constants.{name}.SELF_TEST_OUTPUT, Constants.{name}.SELF_TEST_DURATION_SEC)")

def _append_switchless_line(src, method_signature, line):
    if line in src:
        return src
    m = re.search(rf'({re.escape(method_signature)}\s*\{{\n)', src)
    if not m:
        return src
    return src[:m.end(1)] + line + "\n" + src[m.end(1):]

def _append_switch_case(src, method_signature, name, action_line):
    if f'case "{name}":' in _method_body(src, method_signature):
        return src
    m = re.search(rf'({re.escape(method_signature)}[^\{{]*\{{.*?switch \(subsystem\) \{{)(.*?)(\n\s*default:)', src, re.DOTALL)
    if not m:
        return src
    block = f'\n            case "{name}":\n{action_line}\n                break;'
    if action_line.strip().startswith("return "):
        block = f'\n            case "{name}":\n{action_line}'
    return src[:m.end(2)] + block + src[m.end(2):]

def _method_body(src, method_signature):
    m = re.search(rf'{re.escape(method_signature)}.*?\n    \}}', src, re.DOTALL)
    return m.group(0) if m else ""

def delete_subsystem(target):
    """Remove a generated subsystem and every wiring block the generator added."""
    path = target
    if not path.endswith(".java"):
        name = target[:-9] if target.lower().endswith("subsystem") else target
        path = os.path.join(SUBSYSTEMS_DIR, f"{name}Subsystem.java")
    else:
        name = os.path.basename(path).replace("Subsystem.java", "")

    cfg = load_subsystem_config(path) if os.path.exists(path) else {"name": name, "motors": []}
    name = cfg["name"]
    var = _camel(name)
    cls = f"{name}Subsystem"
    const_cls = f"Constants.{name}"
    changed = []

    if os.path.exists(path):
        os.remove(path)
        changed.append(path)

    if os.path.exists(CONSTANTS_FILE):
        def remove_constants(src):
            begin = f"    // BEGIN 3544-GENERATOR {name}"
            end = f"    // END 3544-GENERATOR {name}"
            return re.sub(r'\n*' + re.escape(begin) + r'.*?' + re.escape(end) + r'\n*', "\n\n", src, flags=re.DOTALL)
        if _patch_file(CONSTANTS_FILE, [("remove constants", remove_constants)]):
            changed.append(CONSTANTS_FILE)

    if os.path.exists(ROBOT_CONTAINER):
        def remove_rc(src):
            src = re.sub(rf'^import frc\.robot\.subsystems\.{re.escape(cls)};\n', "", src, flags=re.MULTILINE)
            src = re.sub(rf'^    private final {re.escape(cls)} {re.escape(var)} = new {re.escape(cls)}\(\);\n', "", src, flags=re.MULTILINE)
            src = re.sub(rf'^        {re.escape(var)}\.periodic\(\);\n', "", src, flags=re.MULTILINE)
            src = re.sub(rf'^        {re.escape(var)}\.simulationPeriodic\(\);\n', "", src, flags=re.MULTILINE)
            src = _remove_call_arg(src, "new SelfTestCommand", var)
            return _remove_call_arg(src, "new DashboardManager", var)
        if _patch_file(ROBOT_CONTAINER, [("remove robot container wiring", remove_rc)]):
            changed.append(ROBOT_CONTAINER)

    if os.path.exists(DASHBOARD_MANAGER):
        def remove_dm(src):
            src = re.sub(rf'^import frc\.robot\.subsystems\.{re.escape(cls)};\n', "", src, flags=re.MULTILINE)
            src = re.sub(rf'^    private final {re.escape(cls)}\s+{re.escape(var)};\n', "", src, flags=re.MULTILINE)
            src = _remove_call_arg(src, "public DashboardManager", var)
            src = re.sub(rf'^        this\.{re.escape(var)} = {re.escape(var)};\n', "", src, flags=re.MULTILINE)
            src = re.sub(rf'^        PowerMonitor\.register\({re.escape(const_cls)}\.SUBSYSTEM_NAME, [^;]+;\n', "", src, flags=re.MULTILINE)
            src = re.sub(rf'^        {re.escape(var)}\.registerHealthDevices\(healthMonitor\);\n', "", src, flags=re.MULTILINE)
            src = re.sub(rf',?\n\s*{re.escape(const_cls)}\.SUBSYSTEM_NAME', "", src)
            src = re.sub(rf'\n\s*healthMonitor\.updateSubsystem\({re.escape(const_cls)}\.SUBSYSTEM_NAME,\n\s*{re.escape(var)}\.isReady\(\), {re.escape(var)}\.getState\(\), {re.escape(var)}\.getFault\(\), {re.escape(var)}\.getWarning\(\)\);', "", src)
            return src
        if _patch_file(DASHBOARD_MANAGER, [("remove dashboard wiring", remove_dm)]):
            changed.append(DASHBOARD_MANAGER)

    if os.path.exists(SELF_TEST_COMMAND):
        def remove_st(src):
            src = re.sub(rf'^import frc\.robot\.subsystems\.{re.escape(cls)};\n', "", src, flags=re.MULTILINE)
            src = re.sub(rf'^    private final {re.escape(cls)}\s+{re.escape(var)};\n', "", src, flags=re.MULTILINE)
            src = _remove_call_arg(src, "public SelfTestCommand", var)
            src = re.sub(rf'^        this\.{re.escape(var)} = {re.escape(var)};\n', "", src, flags=re.MULTILINE)
            src = re.sub(rf'\n        // Generated {re.escape(name)} self-test\..*?\n        \}}\n', "\n", src, flags=re.DOTALL)
            src = re.sub(rf'^        {re.escape(var)}\.stopSelfTest\(\);\n', "", src, flags=re.MULTILINE)
            src = re.sub(rf'\n            case "{re.escape(name)}":\n\s*{re.escape(var)}\.runSelfTest\(value\);\n\s*break;', "", src)
            src = re.sub(rf'\n            case "{re.escape(name)}":\n\s*return {re.escape(var)}\.getSupplyCurrentA\(\);', "", src)
            src = re.sub(rf'\n            case "{re.escape(name)}":\n\s*return {re.escape(var)}\.getTemperatureC\(\);', "", src)
            return src
        if _patch_file(SELF_TEST_COMMAND, [("remove self-test wiring", remove_st)]):
            changed.append(SELF_TEST_COMMAND)

    return changed

def _remove_call_arg(src, call_name, arg_name):
    loc = _find_call_span(src, call_name)
    if not loc:
        return src
    start, close = loc
    open_paren = src.find("(", start, close)
    args_src = src[open_paren + 1:close]
    if not re.search(rf'\b{re.escape(arg_name)}\b', args_src):
        return src
    args = [a for a in _split_java_args(args_src) if not re.search(rf'\b{re.escape(arg_name)}\b', a)]
    if "\n" in args_src:
        indent = re.search(r'\n(\s*)', args_src)
        sep = ",\n" + (indent.group(1) if indent else "                            ")
        new_args = sep.join(a.strip() for a in args)
    else:
        new_args = ", ".join(a.strip() for a in args)
    return src[:open_paren + 1] + new_args + src[close:]

def _split_java_args(args_src):
    args = []
    start = 0
    depth = 0
    in_string = False
    escaped = False
    for i, ch in enumerate(args_src):
        if in_string:
            escaped = (ch == "\\" and not escaped)
            if ch == '"' and not escaped:
                in_string = False
            elif ch != "\\":
                escaped = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        elif ch == "," and depth == 0:
            args.append(args_src[start:i])
            start = i + 1
    tail = args_src[start:]
    if tail.strip():
        args.append(tail)
    return args


# ─── CLI entry point ──────────────────────────────────────────────────────────

def main():
    cfg = collect_config()
    print("\n" + "─"*60 + "\n  Generating...\n" + "─"*60)

    os.makedirs(SUBSYSTEMS_DIR, exist_ok=True)
    out = os.path.join(SUBSYSTEMS_DIR, f"{cfg['name']}Subsystem.java")
    with open(out, "w") as f:
        f.write(gen_subsystem(cfg))
    print(f"  ✓ Wrote {out}")
    if patch_constants(cfg):
        print("  ✓ Patched Constants.java")
    else:
        print("  ~ Constants.java already up-to-date")

    if os.path.exists(ROBOT_CONTAINER):
        patch_robot_container(cfg)
        validate_robot_wiring(cfg)
    else:
        print(f"  ✗ RobotContainer.java not found")

    print(f"\n{'═'*60}\n  Done! '{cfg['name']}' subsystem generated.\n{'═'*60}\n")


if __name__ == "__main__":
    main()
