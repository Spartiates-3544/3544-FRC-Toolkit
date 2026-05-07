import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Pause, Play, Trash2, Download, ScrollText, Loader2, ChevronDown, ChevronRight, RotateCcw, FlaskConical } from 'lucide-react';
import FullRobotTestModal from '../components/FullRobotTestModal';
import { NetworkTablesTypeInfos } from 'ntcore-ts-client';
import { nt, NT_KEYS } from '../nt';
import { useNTValue } from '../hooks/useNTValue';
import {
  parseJsonArray,
  parseJsonObject,
  splitNTList,
  type HealthCanBus,
  type HealthCanDevice,
  type HealthEthernetTarget,
  type HealthEvent,
  type HealthSummary,
  type SubsystemStatus,
} from '../dashboardContract';
import { Badge, Button, Card, EmptyState, Grid, Input, Row, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs } from '../components/ui';

const HEALTH_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'can', label: 'CAN Devices' },
  { id: 'ethernet', label: 'Ethernet Health' },
  { id: 'other', label: 'Other' },
] as const;

type HealthTab = typeof HEALTH_TABS[number]['id'];

const EMPTY_SUMMARY: HealthSummary = {
  overall: 'unknown',
  timestampMs: 0,
  batteryVoltage: 0,
  faultCount: 0,
  warningCount: 0,
  subsystemIssueCount: 0,
  canBusCount: 0,
  canBusFaultCount: 0,
  canDeviceCount: 0,
  canDeviceFaultCount: 0,
  ethernetTargetCount: 0,
  ethernetFaultCount: 0,
};

function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'muted' {
  const normalized = status.toLowerCase();
  if (['healthy', 'ok', 'online', 'ready', 'true'].includes(normalized)) return 'success';
  if (['warning', 'pending', 'checking', 'disabled', 'not ready'].includes(normalized)) return 'warning';
  if (['fault', 'error', 'offline', 'false'].includes(normalized)) return 'destructive';
  return 'muted';
}

function ageLabel(timestampMs: number) {
  if (!timestampMs) return 'never';
  const seconds = Math.max(0, (Date.now() - timestampMs) / 1000);
  if (seconds < 60) return `${seconds.toFixed(0)} s`;
  return `${(seconds / 60).toFixed(1)} min`;
}

function EventBadge({ level }: { level: string }) {
  return <Badge variant={statusVariant(level === 'error' ? 'fault' : level)}>{level}</Badge>;
}

function EntryList({ items, emptyLabel, danger }: { items: string[]; emptyLabel: string; danger?: boolean }) {
  if (items.length === 0) return <div className="min-h-8 border-b border-border/60 py-1.5 text-sm text-primary last:border-b-0">{emptyLabel}</div>;
  return (
    <div className="grid gap-1">
      {items.map((item, i) => (
        <div key={`${item}-${i}`} className={`min-h-8 border-b border-border/60 py-1.5 text-sm last:border-b-0 ${danger ? 'text-destructive' : 'text-secondary-foreground'}`}>
          {item}
        </div>
      ))}
    </div>
  );
}

function publishEthernetTestRequest() {
  const topic = nt.createTopic<number>(NT_KEYS.HEALTH_ETHERNET_TEST_REQUEST, NetworkTablesTypeInfos.kDouble);
  topic.publish().then(() => topic.setValue(Date.now()));
}

function publishResetStickyFaults(deviceKey: string) {
  const keyTopic = nt.createTopic<string>(NT_KEYS.HEALTH_RESET_FAULTS, NetworkTablesTypeInfos.kString);
  const seqTopic = nt.createTopic<number>(NT_KEYS.HEALTH_RESET_FAULTS_SEQ, NetworkTablesTypeInfos.kDouble);
  keyTopic.publish().then(() => keyTopic.setValue(deviceKey));
  seqTopic.publish().then(() => seqTopic.setValue(Date.now()));
}

function OverviewView({
  summary,
  statuses,
  canBuses,
  canDevices,
  ethernetTargets,
  faults,
  warnings,
  events,
}: {
  summary: HealthSummary;
  statuses: SubsystemStatus[];
  canBuses: HealthCanBus[];
  canDevices: HealthCanDevice[];
  ethernetTargets: HealthEthernetTarget[];
  faults: string[];
  warnings: string[];
  events: HealthEvent[];
}) {
  const healthyDevices = canDevices.filter(device => device.online && device.activeFaults.length === 0).length;
  const onlineEthernet = ethernetTargets.filter(target => target.status === 'online').length;

  return (
    <Grid>
      <Card title="Robot Health">
        <Row label="Overall" value={summary.overall.toUpperCase()} tone={summary.overall === 'fault' ? 'destructive' : summary.overall === 'warning' ? 'warning' : 'success'} />
        <Row label="Battery" value={`${summary.batteryVoltage.toFixed(2)} V`} />
        <Row label="Last Update" value={ageLabel(summary.timestampMs)} />
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant={summary.faultCount ? 'destructive' : 'success'}>{summary.faultCount} faults</Badge>
          <Badge variant={summary.warningCount ? 'warning' : 'success'}>{summary.warningCount} warnings</Badge>
        </div>
      </Card>

      <Card title="CAN">
        <Row label="Buses" value={`${canBuses.filter(bus => bus.ok).length}/${summary.canBusCount || canBuses.length} OK`} />
        <Row label="Devices" value={`${healthyDevices}/${summary.canDeviceCount || canDevices.length} OK`} />
        <Row label="Device Faults" value={`${summary.canDeviceFaultCount}`} tone={summary.canDeviceFaultCount ? 'destructive' : 'success'} />
      </Card>

      <Card title="Ethernet">
        <Row label="Targets" value={`${onlineEthernet}/${summary.ethernetTargetCount || ethernetTargets.length} online`} />
        <Row label="Issues" value={`${summary.ethernetFaultCount}`} tone={summary.ethernetFaultCount ? 'warning' : 'success'} />
        <Button type="button" variant="outline" size="sm" onClick={publishEthernetTestRequest}>Test all</Button>
      </Card>

      <Card title="Active Issues" wide>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-black uppercase text-muted-foreground">Faults</h3>
            <EntryList items={faults} emptyLabel="No active faults" danger />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-black uppercase text-muted-foreground">Warnings</h3>
            <EntryList items={warnings} emptyLabel="No active warnings" />
          </div>
        </div>
      </Card>

      <Card title="Subsystem Readiness" wide>
        {statuses.length === 0 ? (
          <EmptyState label="Waiting for subsystem status" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subsystem</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Ready</TableHead>
                <TableHead>Issue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statuses.map(status => (
                <TableRow key={status.name}>
                  <TableCell>{status.name}</TableCell>
                  <TableCell className="text-muted-foreground">{status.state}</TableCell>
                  <TableCell><Badge variant={status.ready ? 'success' : 'warning'}>{status.ready ? 'Ready' : 'Not ready'}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{status.fault || status.warning || status.detail || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card title="Recent Events" wide>
        {events.length === 0 ? (
          <div className="py-3 text-sm text-muted-foreground">No health events this session</div>
        ) : (
          <div className="grid gap-2">
            {events.slice(0, 5).map(event => (
              <div className="grid min-h-9 grid-cols-1 items-center gap-2 rounded-xl border border-border/70 bg-background/45 px-3 py-2 text-xs text-muted-foreground md:grid-cols-[auto_minmax(90px,0.35fr)_minmax(0,1fr)]" key={`${event.timestamp}-${event.message}`}>
                <EventBadge level={event.level} />
                <span>{event.source}</span>
                <strong className="min-w-0 truncate text-xs font-semibold text-foreground">{event.message}</strong>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Grid>
  );
}

function CanDevicesView({ buses, devices }: { buses: HealthCanBus[]; devices: HealthCanDevice[] }) {
  const [query, setQuery] = useState('');
  const [busFilter, setBusFilter] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const busNames = useMemo(() => [...new Set(devices.map(d => d.bus))].sort(), [devices]);
  const filtered = devices.filter(device => {
    const q = query.trim().toLowerCase();
    const matchesBus = busFilter === 'all' || device.bus === busFilter;
    const haystack = `${device.name} ${device.subsystem} ${device.type} ${device.canId} ${device.bus}`.toLowerCase();
    return matchesBus && (!q || haystack.includes(q));
  });

  const anyStickyFaults = devices.some(d => d.stickyFaults.length > 0);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <Grid>
      <Card title="CAN Buses" wide>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {buses.length === 0 ? <EmptyState label="No CAN buses" /> : buses.map(bus => (
            <div className="grid gap-2 rounded-xl border border-border/70 bg-background/45 p-3" key={bus.name}>
              <div className="flex items-center justify-between gap-3">
                <strong className="text-sm">{bus.name}</strong>
                <Badge variant={bus.ok ? 'success' : 'destructive'}>{bus.status}</Badge>
              </div>
              <Row label="Utilization" value={`${(bus.utilization * 100).toFixed(1)} %`} />
              <Row label="FD mode" value={bus.fd ? 'yes' : 'no'} />
              <Row label="Bus-off / TX full" value={`${bus.busOffCount} / ${bus.txFullCount}`} />
              <Row label="REC / TEC" value={`${bus.rec} / ${bus.tec}`} />
            </div>
          ))}
        </div>
      </Card>

      <Card title="CAN Devices" wide>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, subsystem, type…" className="max-w-xs" />
          <select
            className="h-9 min-w-36 rounded-md border border-input bg-background/70 px-3 py-1 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={busFilter}
            onChange={e => setBusFilter(e.target.value)}
            aria-label="Filter CAN bus"
          >
            <option value="all">All buses</option>
            {busNames.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {anyStickyFaults && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto gap-1.5"
              onClick={() => publishResetStickyFaults('__all__')}
            >
              <RotateCcw className="size-3.5" />
              Reset all sticky faults
            </Button>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState label="No CAN devices found" />
        ) : (
          <div className="grid gap-2">
            {filtered.map(device => {
              const id = `${device.bus}-${device.canId}-${device.name}`;
              const isExpanded = expanded.has(id);
              const healthy = device.online && device.activeFaults.length === 0;
              const hasStickyFaults = device.stickyFaults.length > 0;

              return (
                <div key={id} className={`overflow-hidden rounded-xl border transition-colors ${isExpanded ? 'border-border bg-background/50' : 'border-border/60 bg-background/30 hover:border-border hover:bg-background/45'}`}>
                  {/* Clickable header */}
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    onClick={() => toggleExpand(id)}
                  >
                    {isExpanded
                      ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    }
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{device.subsystem}</span>
                        <span className="text-xs text-muted-foreground/60">/</span>
                        <span className="text-sm text-foreground">{device.name}</span>
                        <Badge variant={healthy ? 'success' : 'destructive'}>{device.online ? 'online' : 'offline'}</Badge>
                        {device.activeFaults.length > 0 && (
                          <Badge variant="destructive">{device.activeFaults.length} fault{device.activeFaults.length > 1 ? 's' : ''}</Badge>
                        )}
                        {hasStickyFaults && (
                          <Badge variant="warning">{device.stickyFaults.length} sticky</Badge>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {device.type} · ID {device.canId} · bus: {device.bus}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      <div>{device.supplyVoltage.toFixed(1)} V</div>
                      <div>{device.temperatureC.toFixed(0)} °C</div>
                    </div>
                  </button>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div className="space-y-4 border-t border-border/60 bg-background/20 px-4 py-4">
                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 md:grid-cols-4">
                        <Row label="Firmware" value={device.firmware || '—'} />
                        <Row label="Supply Voltage" value={`${device.supplyVoltage.toFixed(2)} V`} />
                        <Row label="Temperature" value={`${device.temperatureC.toFixed(1)} °C`} />
                        <Row label="Last Update" value={ageLabel(device.lastUpdateMs)} />
                      </div>

                      {/* Active faults */}
                      {device.activeFaults.length > 0 && (
                        <div>
                          <h4 className="mb-2 text-xs font-black uppercase tracking-wide text-destructive">Active Faults</h4>
                          <div className="grid gap-1.5">
                            {device.activeFaults.map((fault, i) => (
                              <div key={i} className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive">
                                <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
                                {fault}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sticky faults */}
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <h4 className="text-xs font-black uppercase tracking-wide text-muted-foreground">Sticky Faults</h4>
                          {hasStickyFaults && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="ml-auto h-6 gap-1 px-2 text-xs"
                              onClick={e => {
                                e.stopPropagation();
                                publishResetStickyFaults(`${device.subsystem}/${device.name}`);
                              }}
                            >
                              <RotateCcw className="size-3" />
                              Reset
                            </Button>
                          )}
                        </div>
                        {device.stickyFaults.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No sticky faults</p>
                        ) : (
                          <div className="grid gap-1.5">
                            {device.stickyFaults.map((fault, i) => (
                              <div key={i} className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-400">
                                <span className="size-1.5 shrink-0 rounded-full bg-yellow-400" />
                                {fault}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </Grid>
  );
}

function EthernetView({ targets }: { targets: HealthEthernetTarget[] }) {
  const checking = targets.some(t => t.status === 'checking');

  function runTest() {
    publishEthernetTestRequest();
  }

  return (
    <Grid>
      <Card title="Ethernet Targets" wide>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={runTest} disabled={checking} className="gap-2">
            {checking && <Loader2 className="size-3.5 animate-spin" />}
            {checking ? 'Testing…' : 'Test all'}
          </Button>
          {checking && <span className="text-xs text-muted-foreground">Checking targets one by one…</span>}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Host</TableHead>
              <TableHead>Latency</TableHead>
              <TableHead>Last Checked</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.map(target => (
              <TableRow key={`${target.role}-${target.host}`}>
                <TableCell>
                  {target.status === 'checking'
                    ? <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />checking</span>
                    : <Badge variant={statusVariant(target.status)}>{target.status}</Badge>
                  }
                </TableCell>
                <TableCell className="font-medium">{target.name}</TableCell>
                <TableCell className="text-muted-foreground">{target.role}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{target.host}</TableCell>
                <TableCell className="text-muted-foreground">
                  {target.status === 'checking' ? '…' : target.latencyMs >= 0 ? `${target.latencyMs.toFixed(1)} ms` : '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">{ageLabel(target.lastCheckedMs)}</TableCell>
                <TableCell className="text-muted-foreground">{target.error || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Grid>
  );
}

function OtherView({
  faults,
  warnings,
  statuses,
  summaryJson,
  busesJson,
  devicesJson,
  ethernetJson,
}: {
  faults: string[];
  warnings: string[];
  statuses: SubsystemStatus[];
  summaryJson: string;
  busesJson: string;
  devicesJson: string;
  ethernetJson: string;
}) {
  return (
    <Grid>
      <Card title="Faults" wide><EntryList items={faults} emptyLabel="No active faults" danger /></Card>
      <Card title="Warnings" wide><EntryList items={warnings} emptyLabel="No active warnings" /></Card>
      <Card title="Subsystem Errors" wide>
        <EntryList
          items={statuses.flatMap(status => [status.fault, status.warning].filter(Boolean) as string[])}
          emptyLabel="No subsystem errors"
        />
      </Card>
      <Card title="Raw Health JSON" wide>
        <pre className="max-h-[420px] overflow-auto rounded-xl border border-border bg-background/60 p-3 text-xs leading-relaxed text-muted-foreground">{JSON.stringify({
          summary: parseJsonObject(summaryJson, {}),
          buses: parseJsonArray(busesJson, []),
          devices: parseJsonArray(devicesJson, []),
          ethernet: parseJsonArray(ethernetJson, []),
        }, null, 2)}</pre>
      </Card>
    </Grid>
  );
}

const LEVEL_COLORS: Record<string, string> = {
  info:    'border-blue-500/30 bg-blue-500/8 text-blue-400',
  warning: 'border-yellow-500/30 bg-yellow-500/8 text-yellow-400',
  error:   'border-red-500/30 bg-red-500/8 text-red-400',
};
const LEVEL_DOT: Record<string, string> = {
  info:    'bg-blue-400',
  warning: 'bg-yellow-400',
  error:   'bg-red-500',
};

function LogDrawer({
  open,
  onClose,
  events,
  paused,
  unread,
  onTogglePause,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  events: HealthEvent[];
  paused: boolean;
  unread: number;
  onTogglePause: () => void;
  onClear: () => void;
}) {
  const [level, setLevel] = useState('all');
  const [search, setSearch] = useState('');
  const levels = ['all', 'info', 'warning', 'error'] as const;

  const filtered = events.filter(event => {
    if (level !== 'all' && event.level !== level) return false;
    if (search) {
      const q = search.toLowerCase();
      return `${event.message} ${event.source} ${event.category} ${event.detail ?? ''}`.toLowerCase().includes(q);
    }
    return true;
  });

  function exportEvents() {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `robot-health-events-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const counts = useMemo(() => ({
    info:    events.filter(e => e.level === 'info').length,
    warning: events.filter(e => e.level === 'warning').length,
    error:   events.filter(e => e.level === 'error').length,
  }), [events]);

  const drawer = (
    <div
      className={`fixed inset-0 z-[200] flex justify-end transition-colors duration-300 ${open ? 'pointer-events-auto bg-background/60 backdrop-blur-sm' : 'pointer-events-none bg-transparent'}`}
      aria-hidden={!open}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`flex h-full w-full max-w-[480px] flex-col border-l border-border bg-card/95 shadow-2xl transition-transform duration-300 supports-[backdrop-filter]:bg-card/85 supports-[backdrop-filter]:backdrop-blur-2xl ${open ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border/70 px-4 py-3">
          <ScrollText className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-foreground">Health Logs</div>
            <div className="text-[11px] text-muted-foreground">
              {events.length} events{unread > 0 ? ` · ${unread} new` : ''}
              {paused && <span className="ml-1 font-semibold text-yellow-400">· paused</span>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onTogglePause}
              title={paused ? 'Resume' : 'Pause'}
              className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={exportEvents}
              title="Export JSON"
              className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Download className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onClear}
              title="Clear"
              className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Trash2 className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="shrink-0 space-y-2 border-b border-border/60 px-4 py-3">
          <input
            type="search"
            placeholder="Search events…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background/60 px-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/40"
          />
          <div className="flex gap-1.5">
            {levels.map(l => {
              const count = l === 'all' ? events.length : counts[l];
              const active = level === l;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize transition-colors ${
                    active
                      ? l === 'all'
                        ? 'border-foreground/20 bg-foreground/10 text-foreground'
                        : LEVEL_COLORS[l]
                      : 'border-border/60 bg-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {l !== 'all' && <span className={`size-1.5 rounded-full ${active ? LEVEL_DOT[l] : 'bg-muted-foreground/40'}`} />}
                  {l} <span className="opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Event list */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="grid h-32 place-items-center text-sm text-muted-foreground">No events</div>
          ) : (
            <div className="grid gap-px bg-border/40 p-0">
              {filtered.map(event => (
                <div
                  key={`${event.timestamp}-${event.source}-${event.message}`}
                  className={`grid grid-cols-[3px_minmax(0,1fr)] bg-card/90 transition-colors hover:bg-accent/30`}
                >
                  <div className={`rounded-l-sm ${LEVEL_DOT[event.level] ?? 'bg-muted-foreground/30'}`} />
                  <div className="grid gap-0.5 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${LEVEL_COLORS[event.level] ?? 'border border-border text-muted-foreground'}`}>
                        {event.level}
                      </span>
                      <span className="truncate text-xs font-semibold text-foreground">{event.message}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                      <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                      <span className="opacity-40">·</span>
                      <span>{event.source}</span>
                      {event.category && event.category !== event.source && (
                        <><span className="opacity-40">·</span><span>{event.category}</span></>
                      )}
                    </div>
                    {event.detail && (
                      <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{event.detail}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}

export default function HealthPage() {
  const [tab, setTab] = useState<HealthTab>('overview');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [pendingEvents, setPendingEvents] = useState<HealthEvent[]>([]);
  const lastEventSeq = useRef(0);

  const faultsRaw = useNTValue<string>(NT_KEYS.HEALTH_FAULTS, '');
  const warningsRaw = useNTValue<string>(NT_KEYS.HEALTH_WARNINGS, '');
  const statusJson = useNTValue<string>(NT_KEYS.HEALTH_STATUS, '[]');
  const summaryJson = useNTValue<string>(NT_KEYS.HEALTH_SUMMARY, '');
  const busesJson = useNTValue<string>(NT_KEYS.HEALTH_CAN_BUSES, '[]');
  const devicesJson = useNTValue<string>(NT_KEYS.HEALTH_CAN_DEVICES, '[]');
  const ethernetJson = useNTValue<string>(NT_KEYS.HEALTH_ETHERNET_TARGETS, '[]');
  const latestEventJson = useNTValue<string>(NT_KEYS.HEALTH_EVENT_LATEST, '');
  const eventSeq = useNTValue<number>(NT_KEYS.HEALTH_EVENT_SEQ, 0);

  const faults = splitNTList(faultsRaw);
  const warnings = splitNTList(warningsRaw);
  const statuses = parseJsonArray<SubsystemStatus>(statusJson, []);
  const summary = parseJsonObject<HealthSummary>(summaryJson, EMPTY_SUMMARY);
  const canBuses = parseJsonArray<HealthCanBus>(busesJson, []);
  const canDevices = parseJsonArray<HealthCanDevice>(devicesJson, []);
  const ethernetTargets = parseJsonArray<HealthEthernetTarget>(ethernetJson, []);

  useEffect(() => {
    const event = parseJsonObject<HealthEvent | null>(latestEventJson, null);
    if (!event || !event.message || eventSeq <= 0 || eventSeq <= lastEventSeq.current) return;
    lastEventSeq.current = eventSeq;
    if (paused) {
      setPendingEvents(prev => [event, ...prev].slice(0, 300));
    } else {
      setEvents(prev => [event, ...prev].slice(0, 300));
    }
  }, [eventSeq, latestEventJson, paused]);

  function togglePause() {
    if (paused) {
      setEvents(prev => [...pendingEvents, ...prev].slice(0, 300));
      setPendingEvents([]);
    }
    setPaused(value => !value);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs items={HEALTH_TABS} value={tab} onValueChange={setTab} />
        <Button type="button" onClick={() => setTestModalOpen(true)} className="gap-2">
          <FlaskConical className="size-4" />
          Full Robot Test
        </Button>
        <Button type="button" variant="outline" onClick={() => setDrawerOpen(true)} className="relative gap-2">
          <ScrollText className="size-4" />
          Logs
          {pendingEvents.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-black text-black">
              {pendingEvents.length > 9 ? '9+' : pendingEvents.length}
            </span>
          )}
        </Button>
      </div>

      <div className="mt-4">
        {tab === 'overview' && (
          <OverviewView
            summary={summary}
            statuses={statuses}
            canBuses={canBuses}
            canDevices={canDevices}
            ethernetTargets={ethernetTargets}
            faults={faults}
            warnings={warnings}
            events={events}
          />
        )}
        {tab === 'can' && <CanDevicesView buses={canBuses} devices={canDevices} />}
        {tab === 'ethernet' && <EthernetView targets={ethernetTargets} />}
        {tab === 'other' && (
          <OtherView
            faults={faults}
            warnings={warnings}
            statuses={statuses}
            summaryJson={summaryJson}
            busesJson={busesJson}
            devicesJson={devicesJson}
            ethernetJson={ethernetJson}
          />
        )}
      </div>

      <FullRobotTestModal open={testModalOpen} onClose={() => setTestModalOpen(false)} />
      <LogDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        events={events}
        paused={paused}
        unread={pendingEvents.length}
        onTogglePause={togglePause}
        onClear={() => {
          setEvents([]);
          setPendingEvents([]);
        }}
      />
    </div>
  );
}
