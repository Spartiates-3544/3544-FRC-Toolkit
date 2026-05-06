const STORAGE_KEY = '3544-dashboard-config';

export interface PanelConfig {
  id: string;
  type: string;
  title?: string;
  position?: { x: number; y: number; w: number; h: number };
  [key: string]: unknown;
}

export interface DashboardConfig {
  layout: PanelConfig[];
  theme: 'light' | 'dark';
  serverUrl: string;
}

const defaultConfig: DashboardConfig = {
  layout: [],
  theme: 'dark',
  serverUrl: 'ws://10.35.44.2:5810',
};

export function loadConfig(): DashboardConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultConfig };
    return { ...defaultConfig, ...JSON.parse(raw) } as DashboardConfig;
  } catch {
    return { ...defaultConfig };
  }
}

export function saveConfig(config: DashboardConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
