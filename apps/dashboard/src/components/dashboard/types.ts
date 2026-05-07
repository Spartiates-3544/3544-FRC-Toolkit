export type DashboardWidgetKind = 'value' | 'path' | 'subsystem' | 'field' | 'autoChooser' | 'matchTimer';

export type DashboardWidget = {
  id: string;
  title: string;
  kind: DashboardWidgetKind;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  subsystem?: string;
  topicKeys?: string[];
  path?: string;
  display?: 'large' | 'rows';
  fontSize?: number;
  color?: string;
  timerLowColor?: string;
  timerMidColor?: string;
  timerHighColor?: string;
  timerLowMax?: number;
  timerMidMax?: number;
};

export const DASHBOARD_GRID = 20;
export const DASHBOARD_STORAGE_KEY = 'dashboard-widgets-v3';
export const NO_TOPICS = '__none__';

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function snap(n: number, grid = DASHBOARD_GRID) {
  return Math.round(n / grid) * grid;
}
