export interface ReplayFrame {
  timestamp: number;
  key: string;
  value: unknown;
}

export interface ReplayTimeline {
  frames: ReplayFrame[];
  startTime: number;
  endTime: number;
  metadata?: {
    matchNumber?: number;
    eventName?: string;
    robot?: string;
  };
}
