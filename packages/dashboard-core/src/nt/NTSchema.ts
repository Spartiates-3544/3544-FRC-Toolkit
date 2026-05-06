export const NT_KEYS = {
  // Robot
  ROBOT_POSE: '/3544/Robot/Pose',
  ROBOT_MODE: '/3544/Robot/Mode',
  ROBOT_ENABLED: '/3544/Robot/Enabled',
  ROBOT_BATTERY_VOLTAGE: '/3544/Robot/BatteryVoltage',

  // Power
  POWER_TOTAL_CURRENT: '/3544/Power/TotalCurrent',
  POWER_TOTAL_POWER: '/3544/Power/TotalPower',
  POWER_SUBSYSTEM_NAMES: '/3544/Power/SubsystemNames',
  POWER_BATTERY_VOLTAGE: '/3544/Power/Battery/Voltage',
  POWER_BATTERY_TOTAL_CURRENT: '/3544/Power/Battery/TotalCurrent',
  POWER_BATTERY_TOTAL_POWER: '/3544/Power/Battery/TotalPower',

  // Health
  HEALTH_FAULTS: '/3544/Health/Faults',
  HEALTH_WARNINGS: '/3544/Health/Warnings',
  HEALTH_CAN_UTILIZATION: '/3544/Health/CAN/Utilization',
  HEALTH_STATUS: '/3544/Health/Status',

  // Subsystems
  SUBSYSTEM_NAMES: '/3544/Subsystems/Names',
  SUBSYSTEMS_SHOOTER_TOP_RPM: '/3544/Subsystems/Shooter/TopRPM',
  SUBSYSTEMS_SHOOTER_TARGET_RPM: '/3544/Subsystems/Shooter/TargetRPM',
  SUBSYSTEMS_SHOOTER_READY: '/3544/Subsystems/Shooter/Ready',

  // Tunables
  TUNABLE_NAMES: '/3544/Tunables/Names',
  TUNABLES_SHOOTER_KP: '/3544/Tunables/Shooter/kP',
  TUNABLES_SHOOTER_KV: '/3544/Tunables/Shooter/kV',
  TUNABLES_SHOOTER_TARGET_RPM: '/3544/Tunables/Shooter/TargetRPM',

  // Simulation
  SIMULATION_TURRET_ANGLE_DEG: '/3544/Simulation/TurretAngleDeg',
  SIMULATION_DRIVE_MODE: '/3544/Simulation/DriveMode',
  SIMULATION_INTAKE_STATE: '/3544/Simulation/IntakeState',
} as const;

export type NTKeyType = (typeof NT_KEYS)[keyof typeof NT_KEYS];

// Value types for each key

export interface RobotPose {
  x: number;
  y: number;
  rotation: number;
}

export interface SubsystemStatus {
  name: string;
  ready: boolean;
  state: string;
  detail?: string;
}

export interface TunableDefinition {
  key: string;
  label: string;
  subsystem: string;
  step: number;
  min?: number;
  max?: number;
}

export type RobotMode = 'teleop' | 'auto' | 'test' | 'disabled';

export type NTValueTypes = {
  [NT_KEYS.ROBOT_POSE]: RobotPose;
  [NT_KEYS.ROBOT_MODE]: RobotMode;
  [NT_KEYS.ROBOT_ENABLED]: boolean;
  [NT_KEYS.ROBOT_BATTERY_VOLTAGE]: number;
  [NT_KEYS.POWER_TOTAL_CURRENT]: number;
  [NT_KEYS.POWER_TOTAL_POWER]: number;
  [NT_KEYS.POWER_SUBSYSTEM_NAMES]: string[];
  [NT_KEYS.POWER_BATTERY_VOLTAGE]: number;
  [NT_KEYS.POWER_BATTERY_TOTAL_CURRENT]: number;
  [NT_KEYS.POWER_BATTERY_TOTAL_POWER]: number;
  [NT_KEYS.HEALTH_FAULTS]: string;
  [NT_KEYS.HEALTH_WARNINGS]: string;
  [NT_KEYS.HEALTH_CAN_UTILIZATION]: number;
  [NT_KEYS.HEALTH_STATUS]: string;
  [NT_KEYS.SUBSYSTEM_NAMES]: string[];
  [NT_KEYS.SUBSYSTEMS_SHOOTER_TOP_RPM]: number;
  [NT_KEYS.SUBSYSTEMS_SHOOTER_TARGET_RPM]: number;
  [NT_KEYS.SUBSYSTEMS_SHOOTER_READY]: boolean;
  [NT_KEYS.TUNABLE_NAMES]: string;
  [NT_KEYS.TUNABLES_SHOOTER_KP]: number;
  [NT_KEYS.TUNABLES_SHOOTER_KV]: number;
  [NT_KEYS.TUNABLES_SHOOTER_TARGET_RPM]: number;
  [NT_KEYS.SIMULATION_TURRET_ANGLE_DEG]: number;
  [NT_KEYS.SIMULATION_DRIVE_MODE]: string;
  [NT_KEYS.SIMULATION_INTAKE_STATE]: string;
};
