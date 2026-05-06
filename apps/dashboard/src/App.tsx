import { lazy, Suspense, useState } from 'react';
import { useNTConnected, useNTValue } from './hooks/useNTValue';
import { NT_KEYS } from './nt';
import { Badge, Tabs } from './components/ui';

const OverviewPage   = lazy(() => import('./pages/OverviewPage'));
const PowerPage      = lazy(() => import('./pages/PowerPage'));
const SubsystemsPage = lazy(() => import('./pages/SubsystemsPage'));
const TunablesPage   = lazy(() => import('./pages/TunablesPage'));
const HealthPage     = lazy(() => import('./pages/HealthPage'));
const FieldPage      = lazy(() => import('./pages/FieldPage'));
const ReplayPage     = lazy(() => import('./pages/ReplayPage'));
const NTViewerPage   = lazy(() => import('./pages/NTViewerPage'));

const TABS = [
  { id: 'overview',   label: 'Overview' },
  { id: 'power',      label: 'Power' },
  { id: 'subsystems', label: 'Subsystems' },
  { id: 'tunables',   label: 'Tunables' },
  { id: 'health',     label: 'Health' },
  { id: 'field',      label: 'Field' },
  { id: 'nt',         label: 'NT' },
  { id: 'replay',     label: 'Replay' },
] as const;

type TabId = typeof TABS[number]['id'];

function PageLoader() {
  return <div className="page-loader">Loading...</div>;
}

export default function App() {
  const [tab, setTab] = useState<TabId>('overview');

  const connected = useNTConnected();
  const mode      = useNTValue<string>(NT_KEYS.ROBOT_MODE, 'disabled');
  const enabled   = useNTValue<boolean>(NT_KEYS.ROBOT_ENABLED, false);
  const battery   = useNTValue<number>(NT_KEYS.ROBOT_BATTERY, 0);
  const faults    = useNTValue<string>(NT_KEYS.HEALTH_FAULTS, '');

  const statusColor = !connected ? '#6b7280' : enabled ? '#22c55e' : '#ef4444';
  const statusLabel = !connected ? 'DISCONNECTED' : enabled ? mode.toUpperCase() : 'DISABLED';
  const batteryColor = battery < 11.5 ? '#ef4444' : battery < 12.2 ? '#f59e0b' : '#22c55e';
  const hasFaults = faults.split(';').filter(Boolean).length > 0;

  return (
    <div className="app-shell">
      <div className="app-header">
        <span className="app-title">3544</span>
        <Badge color={statusColor}>{statusLabel}</Badge>
        <Badge color={batteryColor}>{battery.toFixed(2)} V</Badge>
        {hasFaults && <Badge variant="destructive">FAULT</Badge>}
        <span className="app-server">localhost:5810</span>
      </div>

      <div className="app-tabs">
        <Tabs
          items={TABS}
          value={tab}
          onValueChange={setTab}
          getBadge={(id) => id === 'health' && hasFaults ? <span className="ui-tab-dot" /> : null}
        />
      </div>

      <div className="app-page">
        <Suspense fallback={<PageLoader />}>
          {tab === 'overview'   && <OverviewPage />}
          {tab === 'power'      && <PowerPage />}
          {tab === 'subsystems' && <SubsystemsPage />}
          {tab === 'tunables'   && <TunablesPage />}
          {tab === 'health'     && <HealthPage />}
          {tab === 'field'      && <FieldPage />}
          {tab === 'nt'         && <NTViewerPage />}
          {tab === 'replay'     && <ReplayPage />}
        </Suspense>
      </div>
    </div>
  );
}
