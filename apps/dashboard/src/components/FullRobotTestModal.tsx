import { createPortal } from 'react-dom';
import { useState, useEffect, useCallback } from 'react';
import {
  X, Play, CheckCircle2, AlertTriangle, XCircle, SkipForward,
  Loader2, Clock, Settings2, History, FlaskConical, Save,
  Trash2, ChevronDown, ChevronRight, Download, Cpu,
} from 'lucide-react';
import SelfTestTab from './SelfTestTab';
import { NetworkTablesTypeInfos } from 'ntcore-ts-client';
import { nt, NT_KEYS } from '../nt';
import { useNTValue } from '../hooks/useNTValue';
import {
  parseJsonArray,
  type RobotTestCheck,
  type RobotTestConfig,
  type SavedTestRun,
  DEFAULT_TEST_CONFIG,
} from '../dashboardContract';
import { Badge, Button } from './ui';

// ── NT helpers ───────────────────────────────────────────────────────────────

function publishRunRequest() {
  const topic = nt.createTopic<number>(NT_KEYS.ROBOT_TEST_RUN_REQUEST, NetworkTablesTypeInfos.kDouble);
  topic.publish().then(() => topic.setValue(Date.now()));
}

function publishConfig(cfg: RobotTestConfig) {
  const topic = nt.createTopic<string>(NT_KEYS.ROBOT_TEST_CONFIG, NetworkTablesTypeInfos.kString);
  topic.publish().then(() => topic.setValue(JSON.stringify(cfg)));
}

// ── LocalStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = 'robot-test-history-v1';
const CONFIG_KEY  = 'robot-test-config-v1';

function loadHistory(): SavedTestRun[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}

function saveHistory(runs: SavedTestRun[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.slice(0, 50)));
}

function loadConfig(): RobotTestConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? { ...DEFAULT_TEST_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_TEST_CONFIG };
  } catch {
    return { ...DEFAULT_TEST_CONFIG };
  }
}

function persistConfig(cfg: RobotTestConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

// ── Status helpers ────────────────────────────────────────────────────────────

function CheckIcon({ status, size = 'md' }: { status: RobotTestCheck['status']; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'size-3.5 shrink-0' : 'size-5 shrink-0';
  switch (status) {
    case 'pass':    return <CheckCircle2  className={`${cls} text-emerald-400`} />;
    case 'warning': return <AlertTriangle className={`${cls} text-yellow-400`} />;
    case 'fail':    return <XCircle       className={`${cls} text-red-400`} />;
    case 'running': return <Loader2       className={`${cls} animate-spin text-blue-400`} />;
    case 'skipped': return <SkipForward   className={`${cls} text-muted-foreground`} />;
    default:        return <Clock         className={`${cls} text-muted-foreground/40`} />;
  }
}

function statusBadgeVariant(status: RobotTestCheck['status']): 'success' | 'warning' | 'destructive' | 'muted' | 'secondary' {
  switch (status) {
    case 'pass':    return 'success';
    case 'warning': return 'warning';
    case 'fail':    return 'destructive';
    case 'running': return 'secondary';
    default:        return 'muted';
  }
}

function statusLabel(status: RobotTestCheck['status']) {
  if (status === 'running') return 'Running…';
  if (status === 'skipped') return 'Skipped';
  if (status === 'pending') return 'Pending';
  return status.toUpperCase();
}

function runScore(checks: RobotTestCheck[]) {
  const total   = checks.filter(c => c.status !== 'skipped' && c.status !== 'pending' && c.status !== 'running').length;
  const pass    = checks.filter(c => c.status === 'pass').length;
  const warn    = checks.filter(c => c.status === 'warning').length;
  const fail    = checks.filter(c => c.status === 'fail').length;
  const skipped = checks.filter(c => c.status === 'skipped').length;
  const pct     = total > 0 ? Math.round((pass / total) * 100) : null;
  return { total, pass, warn, fail, skipped, pct };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryBar({ checks, state }: { checks: RobotTestCheck[]; state: string }) {
  if (state === 'idle' && checks.every(c => c.status === 'pending')) return null;
  const { pass, warn, fail, skipped, pct } = runScore(checks);
  const running = state === 'running';

  const overall = running ? 'running' : fail > 0 ? 'fail' : warn > 0 ? 'warning' : 'pass';
  const bgCls = running ? 'border-blue-500/30 bg-blue-500/8' :
    overall === 'fail'    ? 'border-red-500/30 bg-red-500/8' :
    overall === 'warning' ? 'border-yellow-500/30 bg-yellow-500/8' :
    'border-emerald-500/30 bg-emerald-500/8';

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${bgCls}`}>
      <div className="flex items-center gap-3">
        {running
          ? <span className="text-sm font-semibold text-blue-300">Running tests…</span>
          : <>
              {pct !== null && (
                <span className={`text-2xl font-black tabular-nums ${fail > 0 ? 'text-red-300' : warn > 0 ? 'text-yellow-300' : 'text-emerald-300'}`}>
                  {pct}%
                </span>
              )}
              <span className={`text-sm font-semibold ${fail > 0 ? 'text-red-300' : warn > 0 ? 'text-yellow-300' : 'text-emerald-300'}`}>
                {fail > 0 ? 'Issues found' : warn > 0 ? 'Warnings found' : 'All checks passed'}
              </span>
            </>
        }
      </div>
      <div className="flex flex-wrap gap-2">
        {pass    > 0 && <Badge variant="success">{pass} passed</Badge>}
        {warn    > 0 && <Badge variant="warning">{warn} warnings</Badge>}
        {fail    > 0 && <Badge variant="destructive">{fail} failed</Badge>}
        {skipped > 0 && <Badge variant="muted">{skipped} skipped</Badge>}
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: RobotTestCheck }) {
  const isActive = check.status === 'running';
  return (
    <div className={`flex items-start gap-4 rounded-xl border px-4 py-3.5 transition-colors ${
      isActive            ? 'border-blue-500/40 bg-blue-500/8' :
      check.status === 'fail'    ? 'border-red-500/30 bg-red-500/5' :
      check.status === 'pass'    ? 'border-emerald-500/20 bg-emerald-500/5' :
      check.status === 'warning' ? 'border-yellow-500/20 bg-yellow-500/5' :
      'border-border/50 bg-background/30'
    }`}>
      <CheckIcon status={check.status} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{check.label}</span>
          {check.status !== 'pending' && (
            <Badge variant={statusBadgeVariant(check.status)} className="text-[10px]">
              {statusLabel(check.status)}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{check.description}</p>
        {check.detail && check.status !== 'pending' && (
          <p className={`mt-1 text-xs font-medium ${
            check.status === 'fail'    ? 'text-red-400' :
            check.status === 'warning' ? 'text-yellow-400' :
            check.status === 'pass'    ? 'text-emerald-400' :
            'text-muted-foreground'
          }`}>{check.detail}</p>
        )}
      </div>
    </div>
  );
}

// ── Settings view ─────────────────────────────────────────────────────────────

function ThresholdField({ label, value, onChange, unit, step = 0.5 }: {
  label: string; value: number; onChange: (v: number) => void; unit: string; step?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm text-foreground">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          step={step}
          onChange={e => onChange(Number(e.target.value))}
          className="h-8 w-24 rounded-md border border-input bg-background/60 px-2 text-right text-sm tabular-nums text-foreground outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/40"
        />
        <span className="w-6 text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function SettingsView({ config, onChange }: { config: RobotTestConfig; onChange: (c: RobotTestConfig) => void }) {
  function set<K extends keyof RobotTestConfig>(key: K, val: number) {
    onChange({ ...config, [key]: val });
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-border/60 bg-background/30 p-4">
        <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-muted-foreground">Battery Voltage</h3>
        <div className="grid gap-3">
          <ThresholdField label="Warn below" value={config.batteryWarnV} onChange={v => set('batteryWarnV', v)} unit="V" />
          <ThresholdField label="Fail below" value={config.batteryCritV} onChange={v => set('batteryCritV', v)} unit="V" />
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background/30 p-4">
        <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-muted-foreground">Motor Temperature</h3>
        <div className="grid gap-3">
          <ThresholdField label="Warn above" value={config.tempWarnC} onChange={v => set('tempWarnC', v)} unit="°C" step={5} />
          <ThresholdField label="Fail above" value={config.tempFailC} onChange={v => set('tempFailC', v)} unit="°C" step={5} />
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background/30 p-4">
        <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-muted-foreground">Current Draw</h3>
        <div className="grid gap-3">
          <ThresholdField label="Warn above" value={config.currentWarnA} onChange={v => set('currentWarnA', v)} unit="A" step={10} />
          <ThresholdField label="Fail above" value={config.currentFailA} onChange={v => set('currentFailA', v)} unit="A" step={10} />
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Settings are saved locally and sent to the robot automatically before each test run.
      </p>

      <Button type="button" variant="outline" size="sm" className="mx-auto"
        onClick={() => onChange({ ...DEFAULT_TEST_CONFIG })}>
        Reset to defaults
      </Button>
    </div>
  );
}

// ── History view ──────────────────────────────────────────────────────────────

function MiniCheckBadge({ check }: { check: RobotTestCheck }) {
  return (
    <div className="flex items-center gap-1" title={`${check.label}: ${check.detail}`}>
      <CheckIcon status={check.status} size="sm" />
      <span className="text-[10px] text-muted-foreground">{check.label}</span>
    </div>
  );
}

function HistoryRunCard({
  run,
  onDelete,
  compareWith,
}: {
  run: SavedTestRun;
  onDelete: () => void;
  compareWith: SavedTestRun | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const { pass, warn, fail, skipped, pct } = runScore(run.checks);

  function exportRun() {
    const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `robot-test-${new Date(run.timestamp).toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const overallCls = fail > 0 ? 'text-red-400' : warn > 0 ? 'text-yellow-400' : 'text-emerald-400';

  return (
    <div className={`overflow-hidden rounded-xl border transition-colors ${expanded ? 'border-border bg-background/50' : 'border-border/60 bg-background/30 hover:border-border'}`}>
      <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setExpanded(v => !v)}>
        {expanded ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{run.label || 'Unnamed run'}</span>
            {pct !== null && <span className={`text-xs font-black ${overallCls}`}>{pct}%</span>}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{new Date(run.timestamp).toLocaleString()}</div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {pass    > 0 && <Badge variant="success"    className="text-[10px] py-0">{pass}P</Badge>}
          {warn    > 0 && <Badge variant="warning"    className="text-[10px] py-0">{warn}W</Badge>}
          {fail    > 0 && <Badge variant="destructive" className="text-[10px] py-0">{fail}F</Badge>}
          {skipped > 0 && <Badge variant="muted"      className="text-[10px] py-0">{skipped}S</Badge>}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/60 bg-background/20 px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {run.checks.map(check => {
              const prev = compareWith?.checks.find(c => c.id === check.id);
              const changed = prev && prev.status !== check.status;
              return (
                <div key={check.id} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
                  changed ? 'border-blue-500/40 bg-blue-500/8' : 'border-border/50 bg-background/30'
                }`}>
                  <CheckIcon status={check.status} size="sm" />
                  <span className="truncate text-foreground">{check.label}</span>
                  {changed && prev && (
                    <span className="ml-auto shrink-0 text-[10px] text-blue-400">
                      was {prev.status}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 border-t border-border/50 pt-2">
            <span className="text-[11px] text-muted-foreground">
              Battery warn: {run.config.batteryWarnV}V · Temp warn: {run.config.tempWarnC}°C · Current warn: {run.config.currentWarnA}A
            </span>
            <div className="ml-auto flex gap-1.5">
              <button type="button" onClick={exportRun} title="Export JSON"
                className="grid size-6 place-items-center rounded text-muted-foreground hover:text-foreground">
                <Download className="size-3.5" />
              </button>
              <button type="button" onClick={onDelete} title="Delete"
                className="grid size-6 place-items-center rounded text-muted-foreground hover:text-destructive">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryView({ history, onDelete }: { history: SavedTestRun[]; onDelete: (id: string) => void }) {
  const [compareId, setCompareId] = useState<string>('');
  const compareRun = history.find(r => r.id === compareId) ?? null;

  if (history.length === 0) {
    return (
      <div className="grid h-40 place-items-center text-sm text-muted-foreground">
        <div className="text-center">
          <p>No saved runs yet.</p>
          <p className="mt-1 text-xs">Run a test and click <strong>Save Results</strong> to record it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {history.length >= 2 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Compare against:</span>
          <select
            className="h-7 flex-1 rounded-md border border-input bg-background/70 px-2 text-xs text-foreground outline-none focus:border-ring"
            value={compareId}
            onChange={e => setCompareId(e.target.value)}
          >
            <option value="">None</option>
            {history.map(r => (
              <option key={r.id} value={r.id}>
                {r.label || 'Unnamed'} — {new Date(r.timestamp).toLocaleString()}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-2">
        {history.map(run => (
          <HistoryRunCard
            key={run.id}
            run={run}
            onDelete={() => onDelete(run.id)}
            compareWith={compareRun && compareRun.id !== run.id ? compareRun : null}
          />
        ))}
      </div>
    </div>
  );
}

// ── Save dialog ───────────────────────────────────────────────────────────────

function SaveDialog({ checks, config, onSave, onCancel }: {
  checks: RobotTestCheck[];
  config: RobotTestConfig;
  onSave: (label: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState('');
  const defaultLabel = `Run ${new Date().toLocaleString()}`;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card/95 p-5 shadow-2xl">
        <h3 className="mb-1 text-sm font-black text-foreground">Save Test Results</h3>
        <p className="mb-4 text-xs text-muted-foreground">Give this run a label so you can identify it later.</p>
        <input
          autoFocus
          type="text"
          placeholder={defaultLabel}
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(label || defaultLabel); if (e.key === 'Escape') onCancel(); }}
          className="mb-4 h-9 w-full rounded-md border border-input bg-background/60 px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/40"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="button" size="sm" onClick={() => onSave(label || defaultLabel)}>
            <Save className="mr-1.5 size-3.5" />Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

type ModalTab = 'selftest' | 'results' | 'settings' | 'history';

export default function FullRobotTestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<ModalTab>('selftest');
  const [config, setConfig] = useState<RobotTestConfig>(loadConfig);
  const [history, setHistory] = useState<SavedTestRun[]>(loadHistory);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const resultsRaw = useNTValue<string>(NT_KEYS.ROBOT_TEST_RESULTS, '[]');
  const state      = useNTValue<string>(NT_KEYS.ROBOT_TEST_STATE, 'idle');
  const checks     = parseJsonArray<RobotTestCheck>(resultsRaw, []);
  const running    = state === 'running';

  const isDone = state === 'done' && checks.some(c => c.status !== 'pending');

  // Persist config changes and push to robot
  const handleConfigChange = useCallback((cfg: RobotTestConfig) => {
    setConfig(cfg);
    persistConfig(cfg);
    publishConfig(cfg);
  }, []);

  // Push config to robot whenever modal opens
  useEffect(() => {
    if (open) publishConfig(config);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRunAll() {
    publishConfig(config); // always send latest thresholds before running
    publishRunRequest();
  }

  function handleSave(label: string) {
    const run: SavedTestRun = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      label,
      checks,
      config,
    };
    const next = [run, ...history];
    setHistory(next);
    saveHistory(next);
    setShowSaveDialog(false);
  }

  function handleDeleteRun(id: string) {
    const next = history.filter(r => r.id !== id);
    setHistory(next);
    saveHistory(next);
  }

  const TABS: { id: ModalTab; label: string; icon: React.ReactNode }[] = [
    { id: 'selftest', label: 'Self Test',  icon: <Cpu className="size-3.5" /> },
    { id: 'results',  label: 'Quick Check', icon: <FlaskConical className="size-3.5" /> },
    { id: 'settings', label: 'Settings',  icon: <Settings2 className="size-3.5" /> },
    { id: 'history',  label: `History${history.length > 0 ? ` (${history.length})` : ''}`, icon: <History className="size-3.5" /> },
  ];

  const modal = (
    <div
      className={`fixed inset-0 z-[300] flex items-center justify-center p-4 transition-colors duration-300 ${
        open ? 'pointer-events-auto bg-background/70 backdrop-blur-sm' : 'pointer-events-none bg-transparent'
      }`}
      aria-hidden={!open}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`flex w-full max-w-2xl flex-col rounded-2xl border border-border bg-card/95 shadow-2xl transition-all duration-300 supports-[backdrop-filter]:bg-card/85 supports-[backdrop-filter]:backdrop-blur-2xl ${
        open ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
      }`} style={{ maxHeight: 'min(92vh, 760px)' }}>

        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border/70 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-foreground">Full Robot Test</h2>
            <p className="text-xs text-muted-foreground">Preflight check — verify all systems before enabling</p>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'results' && isDone && (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setShowSaveDialog(true)}>
                <Save className="size-3.5" />Save
              </Button>
            )}
            {tab === 'results' && (
              <Button type="button" onClick={handleRunAll} disabled={running} size="sm" className="gap-1.5">
                {running ? <><Loader2 className="size-3.5 animate-spin" />Running…</> : <><Play className="size-3.5" />Run All</>}
              </Button>
            )}
            {tab === 'selftest' && (
              <span className="rounded-full border border-border/50 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                Requires teleop enabled
              </span>
            )}
            <button type="button" onClick={onClose}
              className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex shrink-0 gap-0 border-b border-border/60 px-5">
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors ${
                tab === t.id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tab === 'selftest' && <SelfTestTab />}

          {tab === 'results' && (
            checks.length === 0 ? (
              <div className="grid h-40 place-items-center text-sm text-muted-foreground">
                <div className="text-center">
                  <p>No test results yet.</p>
                  <p className="mt-1 text-xs">Click <strong>Run All</strong> to start.</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <SummaryBar checks={checks} state={state ?? 'idle'} />
                {checks.map(check => <CheckRow key={check.id} check={check} />)}
              </div>
            )
          )}

          {tab === 'settings' && (
            <SettingsView config={config} onChange={handleConfigChange} />
          )}

          {tab === 'history' && (
            <HistoryView history={history} onDelete={handleDeleteRun} />
          )}
        </div>
      </div>

      {showSaveDialog && (
        <SaveDialog
          checks={checks}
          config={config}
          onSave={handleSave}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  );

  return createPortal(modal, document.body);
}
