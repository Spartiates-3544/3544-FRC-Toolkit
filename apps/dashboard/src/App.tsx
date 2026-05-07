import { lazy, Suspense, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useNTConnected, useNTValue } from './hooks/useNTValue';
import { NT_KEYS } from './nt';
import FuturisticBackground from './components/FuturisticBackground';
import { Badge, Button, Tabs } from './components/ui';

const DashboardPage  = lazy(() => import('./pages/DashboardPage'));
const PowerPage      = lazy(() => import('./pages/PowerPage'));
const SubsystemsPage = lazy(() => import('./pages/SubsystemsPage'));
const TunablesPage   = lazy(() => import('./pages/TunablesPage'));
const HealthPage     = lazy(() => import('./pages/HealthPage'));
const ReplayPage     = lazy(() => import('./pages/ReplayPage'));
const NTViewerPage   = lazy(() => import('./pages/NTViewerPage'));

const TABS = [
  { id: 'dashboard',  label: 'Dashboard' },
  { id: 'power',      label: 'Power' },
  { id: 'subsystems', label: 'Subsystems' },
  { id: 'tunables',   label: 'Tunables' },
  { id: 'health',     label: 'Health' },
  { id: 'nt',         label: 'NT' },
  { id: 'replay',     label: 'Replay' },
] as const;

type TabId = typeof TABS[number]['id'];
type Theme = 'light' | 'dark';

function PageLoader() {
  return <div className="grid min-h-[220px] place-items-center text-sm font-medium text-muted-foreground">Loading...</div>;
}

export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('dashboard-theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const connected = useNTConnected();
  const mode      = useNTValue<string>(NT_KEYS.ROBOT_MODE, 'disabled');
  const enabled   = useNTValue<boolean>(NT_KEYS.ROBOT_ENABLED, false);
  const battery   = useNTValue<number>(NT_KEYS.ROBOT_BATTERY, 0);
  const faults    = useNTValue<string>(NT_KEYS.HEALTH_FAULTS, '');

  const statusLabel = !connected ? 'DISCONNECTED' : enabled ? mode.toUpperCase() : 'DISABLED';
  const hasFaults = faults.split(';').filter(Boolean).length > 0;
  const statusVariant = !connected || !enabled ? 'destructive' : 'success';
  const batteryVariant = battery < 11.5 ? 'destructive' : battery < 12.2 ? 'warning' : 'success';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('dashboard-theme', theme);
  }, [theme]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="sticky top-0 z-50 flex min-h-[var(--header-height)] items-center gap-2 border-b border-border bg-header/95 px-4 text-header-foreground shadow-sm supports-[backdrop-filter]:bg-header/80 supports-[backdrop-filter]:backdrop-blur-xl md:px-6">
        <span className="mr-1 text-lg font-black tracking-tight">3544</span>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
        <Badge variant={batteryVariant}>{battery.toFixed(2)} V</Badge>
        {hasFaults && <Badge variant="destructive">FAULT</Badge>}
        <span className="ml-auto hidden text-xs font-medium text-muted-foreground sm:inline">localhost:5810</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
      </div>

      <div className="sticky top-[var(--header-height)] z-40 border-b border-border bg-header/90 px-4 py-2 supports-[backdrop-filter]:bg-header/75 supports-[backdrop-filter]:backdrop-blur-xl md:px-6">
        <Tabs
          items={TABS}
          value={tab}
          onValueChange={setTab}
          getBadge={(id) => id === 'health' && hasFaults ? <span className="size-1.5 rounded-full bg-destructive" /> : null}
        />
      </div>

      <div className="relative min-h-[calc(100vh-var(--header-height)-53px)] flex-1 overflow-hidden">
        <FuturisticBackground />
        <div className="relative z-10 w-full p-3 md:p-4">
          <Suspense fallback={<PageLoader />}>
            {tab === 'dashboard'  && <DashboardPage />}
            {tab === 'power'      && <PowerPage />}
            {tab === 'subsystems' && <SubsystemsPage />}
            {tab === 'tunables'   && <TunablesPage />}
            {tab === 'health'     && <HealthPage />}
            {tab === 'nt'         && <NTViewerPage />}
            {tab === 'replay'     && <ReplayPage />}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
