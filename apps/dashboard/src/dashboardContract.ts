export const NT_ROOT = '/3544';

export const NT_KEYS = {
  ROBOT_MODE: `${NT_ROOT}/Robot/Mode`,
  ROBOT_ENABLED: `${NT_ROOT}/Robot/Enabled`,
  ROBOT_BATTERY: `${NT_ROOT}/Robot/BatteryVoltage`,
  ROBOT_MATCH_TIME: `${NT_ROOT}/Robot/MatchTime`,
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
  HEALTH_SUMMARY: `${NT_ROOT}/Health/Summary`,
  HEALTH_CAN_BUSES: `${NT_ROOT}/Health/CAN/Buses`,
  HEALTH_CAN_DEVICES: `${NT_ROOT}/Health/CAN/Devices`,
  HEALTH_ETHERNET_TARGETS: `${NT_ROOT}/Health/Ethernet/Targets`,
  HEALTH_ETHERNET_TEST_REQUEST: `${NT_ROOT}/Health/Ethernet/TestRequest`,
  HEALTH_EVENT_LATEST: `${NT_ROOT}/Health/Events/Latest`,
  HEALTH_EVENT_SEQ: `${NT_ROOT}/Health/Events/Seq`,
  HEALTH_RESET_FAULTS: `${NT_ROOT}/Health/CAN/ResetFaults`,
  HEALTH_RESET_FAULTS_SEQ: `${NT_ROOT}/Health/CAN/ResetFaultsSeq`,

  ROBOT_TEST_RESULTS: `${NT_ROOT}/RobotTest/Results`,
  ROBOT_TEST_STATE: `${NT_ROOT}/RobotTest/State`,
  ROBOT_TEST_RUN_REQUEST: `${NT_ROOT}/RobotTest/RunRequest`,
  ROBOT_TEST_CONFIG: `${NT_ROOT}/RobotTest/Config`,

  SELF_TEST_STATE:           `${NT_ROOT}/SelfTest/State`,
  SELF_TEST_STEP_INDEX:      `${NT_ROOT}/SelfTest/StepIndex`,
  SELF_TEST_STEP_COUNT:      `${NT_ROOT}/SelfTest/StepCount`,
  SELF_TEST_STEP_NAME:       `${NT_ROOT}/SelfTest/StepName`,
  SELF_TEST_STEP_TYPE:       `${NT_ROOT}/SelfTest/StepType`,
  SELF_TEST_STEP_STATUS:     `${NT_ROOT}/SelfTest/StepStatus`,
  SELF_TEST_STEP_DETAIL:     `${NT_ROOT}/SelfTest/StepDetail`,
  SELF_TEST_TIME_REMAIN:     `${NT_ROOT}/SelfTest/StepTimeRemainSec`,
  SELF_TEST_LIVE_CURRENT:    `${NT_ROOT}/SelfTest/LiveCurrentA`,
  SELF_TEST_LIVE_TEMP:       `${NT_ROOT}/SelfTest/LiveTempC`,
  SELF_TEST_LIVE_BATTERY:    `${NT_ROOT}/SelfTest/LiveBatteryV`,
  SELF_TEST_PROMPT:          `${NT_ROOT}/SelfTest/PromptText`,
  SELF_TEST_RESULTS:         `${NT_ROOT}/SelfTest/Results`,
  SELF_TEST_IS_SIM:          `${NT_ROOT}/SelfTest/IsSimulation`,
  SELF_TEST_RUN_REQUEST:     `${NT_ROOT}/SelfTest/RunRequest`,
  SELF_TEST_ABORT_REQUEST:   `${NT_ROOT}/SelfTest/AbortRequest`,
  SELF_TEST_USER_CONFIRM:    `${NT_ROOT}/SelfTest/UserConfirm`,
  SELF_TEST_USER_SKIP:       `${NT_ROOT}/SelfTest/UserSkip`,
  SELF_TEST_USER_FAIL:       `${NT_ROOT}/SelfTest/UserFail`,

  SUBSYSTEM_NAMES: `${NT_ROOT}/Subsystems/Names`,

  TUNABLE_NAMES: `${NT_ROOT}/Tunables/Names`,
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
  fault?: string;
  warning?: string;
};

export type HealthSummary = {
  overall: 'healthy' | 'warning' | 'fault' | string;
  timestampMs: number;
  batteryVoltage: number;
  faultCount: number;
  warningCount: number;
  subsystemIssueCount: number;
  canBusCount: number;
  canBusFaultCount: number;
  canDeviceCount: number;
  canDeviceFaultCount: number;
  ethernetTargetCount: number;
  ethernetFaultCount: number;
};

export type HealthCanBus = {
  name: string;
  status: string;
  ok: boolean;
  fd: boolean;
  utilization: number;
  busOffCount: number;
  txFullCount: number;
  rec: number;
  tec: number;
};

export type HealthCanDevice = {
  name: string;
  subsystem: string;
  type: string;
  canId: number;
  bus: string;
  online: boolean;
  firmware: string;
  supplyVoltage: number;
  temperatureC: number;
  lastUpdateMs: number;
  activeFaults: string[];
  stickyFaults: string[];
};

export type HealthEthernetTarget = {
  name: string;
  role: string;
  host: string;
  enabled: boolean;
  status: 'pending' | 'online' | 'offline' | 'error' | 'disabled' | string;
  latencyMs: number;
  lastCheckedMs: number;
  error: string;
};

export type HealthEvent = {
  timestamp: number;
  level: 'info' | 'warning' | 'error' | string;
  source: string;
  category: string;
  message: string;
  detail?: string;
  related?: string;
};

export type RobotTestCheck = {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'running' | 'pass' | 'warning' | 'fail' | 'skipped';
  detail: string;
};

export type RobotTestConfig = {
  batteryWarnV: number;
  batteryCritV: number;
  tempWarnC: number;
  tempFailC: number;
  currentWarnA: number;
  currentFailA: number;
};

export const DEFAULT_TEST_CONFIG: RobotTestConfig = {
  batteryWarnV: 12.0,
  batteryCritV: 10.5,
  tempWarnC: 70,
  tempFailC: 85,
  currentWarnA: 120,
  currentFailA: 200,
};

export type SavedTestRun = {
  id: string;
  timestamp: number;
  label: string;
  checks: RobotTestCheck[];
  config: RobotTestConfig;
};

export type SelfTestState = 'idle' | 'running' | 'done' | 'aborted' | 'waiting_user' | string;

export type SelfTestStepType =
  | 'HEALTH_CHECK' | 'MOTOR_RUN' | 'WAIT' | 'GYRO_CHECK' | 'VISION_CHECK' | string;

export type SelfTestResult = {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'running' | 'pass' | 'warning' | 'fail' | 'skipped';
  detail: string;
  peakCurrentA: number;
  peakTempC: number;
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

export function parseJsonObject<T>(value: string, fallback: T): T {
  if (!value.trim()) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : fallback;
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
