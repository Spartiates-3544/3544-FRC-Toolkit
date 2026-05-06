export const NT_ROOT = '/3544';

export const NT_KEYS = {
  ROBOT_MODE: `${NT_ROOT}/Robot/Mode`,
  ROBOT_ENABLED: `${NT_ROOT}/Robot/Enabled`,
  ROBOT_BATTERY: `${NT_ROOT}/Robot/BatteryVoltage`,
  ROBOT_POSE: `${NT_ROOT}/Robot/Pose`,

  POWER_CURRENT: `${NT_ROOT}/Power/TotalCurrent`,
  POWER_POWER: `${NT_ROOT}/Power/TotalPower`,
  POWER_SUBSYSTEM_NAMES: `${NT_ROOT}/Power/SubsystemNames`,
  POWER_BATTERY_VOLTAGE: `${NT_ROOT}/Power/Battery/Voltage`,
  POWER_BATTERY_CURRENT: `${NT_ROOT}/Power/Battery/TotalCurrent`,
  POWER_BATTERY_POWER: `${NT_ROOT}/Power/Battery/TotalPower`,

  HEALTH_FAULTS: `${NT_ROOT}/Health/Faults`,
  HEALTH_WARNINGS: `${NT_ROOT}/Health/Warnings`,
  HEALTH_CAN_UTILIZATION: `${NT_ROOT}/Health/CAN/Utilization`,
  HEALTH_STATUS: `${NT_ROOT}/Health/Status`,

  SUBSYSTEM_NAMES: `${NT_ROOT}/Subsystems/Names`,

  TUNABLE_NAMES: `${NT_ROOT}/Tunables/Names`,
  TUNABLES_KP: `${NT_ROOT}/Tunables/Shooter/kP`,
  TUNABLES_KV: `${NT_ROOT}/Tunables/Shooter/kV`,
  TUNABLES_TARGET_RPM: `${NT_ROOT}/Tunables/Shooter/TargetRPM`,

  SHOOTER_RPM: `${NT_ROOT}/Subsystems/Shooter/TopRPM`,
  SHOOTER_TARGET: `${NT_ROOT}/Subsystems/Shooter/TargetRPM`,
  SHOOTER_READY: `${NT_ROOT}/Subsystems/Shooter/Ready`,

  SIM_TURRET_ANGLE: `${NT_ROOT}/Simulation/TurretAngleDeg`,
  SIM_DRIVE_MODE: `${NT_ROOT}/Simulation/DriveMode`,
  SIM_ROBOT_PATH: `${NT_ROOT}/Simulation/Path`,
  SIM_INTAKE_STATE: `${NT_ROOT}/Simulation/IntakeState`,
} as const;

export type RobotMode = 'disabled' | 'auto' | 'teleop' | 'test';

export type RobotPose = {
  x: number;
  y: number;
  rotation: number;
};

export type SubsystemStatus = {
  name: string;
  ready: boolean;
  state: string;
  detail?: string;
};

export type TunableDefinition = {
  key: string;
  label: string;
  subsystem: string;
  step: number;
  min?: number;
  max?: number;
};

export type ReplayFrame = {
  timestamp: number;
  key: string;
  value: unknown;
};

export type ReplayTimeline = {
  frames: ReplayFrame[];
  startTime: number;
  endTime: number;
  metadata?: {
    eventName?: string;
    matchNumber?: number;
    robot?: string;
  };
};

export function splitNTList(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  if (!value) return [];
  return value.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
}

export function parseJsonArray<T>(value: string, fallback: T[]): T[] {
  if (!value.trim()) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

export function parsePose(value: number[] | string | RobotPose | null | undefined): RobotPose {
  if (Array.isArray(value)) {
    return { x: value[0] ?? 0, y: value[1] ?? 0, rotation: value[2] ?? 0 };
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as Partial<RobotPose> | number[];
      return parsePose(parsed as RobotPose | number[]);
    } catch {
      return { x: 0, y: 0, rotation: 0 };
    }
  }
  if (value && typeof value === 'object') {
    return {
      x: Number(value.x) || 0,
      y: Number(value.y) || 0,
      rotation: Number(value.rotation) || 0,
    };
  }
  return { x: 0, y: 0, rotation: 0 };
}

export function formatValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(formatValue).join(', ')}]`;
  if (typeof value === 'number') return Number.isInteger(value) ? `${value}` : value.toFixed(3);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
