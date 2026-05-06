import type { RobotPose, RobotMode } from '../nt/NTSchema.js';

export interface SubsystemState {
  current?: number;
  [key: string]: unknown;
}

export interface RobotState {
  pose: RobotPose;
  mode: RobotMode;
  enabled: boolean;
  batteryVoltage: number;
  subsystems: Record<string, SubsystemState>;
  faults: string[];
  warnings: string[];
}

export function createDefaultRobotState(): RobotState {
  return {
    pose: { x: 0, y: 0, rotation: 0 },
    mode: 'disabled',
    enabled: false,
    batteryVoltage: 0,
    subsystems: {},
    faults: [],
    warnings: [],
  };
}
