/**
 * SelfTestTab — interactive self-test UI driven by SelfTestCommand on the robot.
 *
 * Robot MUST be teleop-enabled for the test to run.
 * Interactive steps (Gyro, Vision) show a full-screen prompt with Confirm / Skip / Fail.
 */

import { NetworkTablesTypeInfos } from 'ntcore-ts-client';
import {
  Activity, AlertTriangle, CheckCircle2, ChevronRight, Clock,
  Loader2, OctagonX, Play, Power, SkipForward, Thermometer,
  XCircle, Zap,
} from 'lucide-react';
import { nt, NT_KEYS } from '../nt';
import { useNTValue } from '../hooks/useNTValue';
import { parseJsonArray, type SelfTestResult, type SelfTestState, type SelfTestStepType } from '../dashboardContract';
import { Badge, Button } from './ui';

// ── NT publish helpers ────────────────────────────────────────────────────────

function publishTs(key: string) {
  const topic = nt.createTopic<number>(key, NetworkTablesTypeInfos.kDouble);
  topic.publish().then(() => topic.setValue(Date.now()));
}

const startTest  = () => publishTs(NT_KEYS.SELF_TEST_RUN_REQUEST);
const abortTest  = () => publishTs(NT_KEYS.SELF_TEST_ABORT_REQUEST);
const confirmStep = () => publishTs(NT_KEYS.SELF_TEST_USER_CONFIRM);
const skipStep    = () => publishTs(NT_KEYS.SELF_TEST_USER_SKIP);
const failStep    = () => publishTs(NT_KEYS.SELF_TEST_USER_FAIL);

// ── Type helpers ──────────────────────────────────────────────────────────────

type StepStatus = SelfTestResult['status'];

function CheckIcon({ status, size = 'md' }: { status: StepStatus; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'lg' ? 'size-7' : size === 'sm' ? 'size-3.5' : 'size-5';
  const cls = `${s} shrink-0`;
  switch (status) {
    case 'pass':    return <CheckCircle2  className={`${cls} text-emerald-400`} />;
    case 'warning': return <AlertTriangle className={`${cls} text-yellow-400`} />;
    case 'fail':    return <XCircle       className={`${cls} text-red-400`} />;
    case 'running': return <Loader2       className={`${cls} animate-spin text-blue-400`} />;
    case 'skipped': return <SkipForward   className={`${cls} text-muted-foreground/60`} />;
    default:        return <Clock         className={`${cls} text-muted-foreground/30`} />;
  }
}

function stepTypeBadge(type: SelfTestStepType) {
  switch (type) {
    case 'MOTOR_RUN':    return <Badge variant="secondary" className="text-[10px]">Motor</Badge>;
    case 'WAIT':         return <Badge variant="muted"     className="text-[10px]">Wait</Badge>;
    case 'HEALTH_CHECK': return <Badge variant="outline"   className="text-[10px]">Health</Badge>;
    case 'GYRO_CHECK':   return <Badge variant="secondary" className="text-[10px]">Gyro</Badge>;
    case 'VISION_CHECK': return <Badge variant="secondary" className="text-[10px]">Vision</Badge>;
    default: return null;
  }
}

function badgeVariant(status: StepStatus): 'success' | 'warning' | 'destructive' | 'muted' | 'secondary' {
  switch (status) {
    case 'pass':    return 'success';
    case 'warning': return 'warning';
    case 'fail':    return 'destructive';
    case 'running': return 'secondary';
    default:        return 'muted';
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricPill({ icon, value, label, warn }: {
  icon: React.ReactNode; value: string; label: string; warn?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs tabular-nums ${
      warn ? 'border-yellow-500/40 bg-yellow-500/8 text-yellow-300' : 'border-border/60 bg-background/40 text-muted-foreground'
    }`}>
      {icon}
      <span className="font-semibold text-foreground">{value}</span>
      <span className="opacity-60">{label}</span>
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/50">
        <div
          className="h-full rounded-full bg-blue-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{current}/{total}</span>
    </div>
  );
}

function StepRow({
  result,
  isCurrent,
  stepType,
  timeRemain,
}: {
  result: SelfTestResult;
  isCurrent: boolean;
  stepType: SelfTestStepType;
  timeRemain: number;
}) {
  const isActive = result.status === 'running';
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-all ${
      isActive
        ? 'border-blue-500/50 bg-blue-500/8 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
        : result.status === 'fail'    ? 'border-red-500/25 bg-red-500/5'
        : result.status === 'pass'    ? 'border-emerald-500/20 bg-emerald-500/4'
        : result.status === 'warning' ? 'border-yellow-500/20 bg-yellow-500/5'
        : 'border-border/40 bg-background/20'
    }`}>
      <CheckIcon status={result.status} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-foreground">{result.label}</span>
          {stepTypeBadge(stepType)}
          {result.status !== 'pending' && result.status !== 'running' && (
            <Badge variant={badgeVariant(result.status)} className="text-[10px]">
              {result.status.toUpperCase()}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{result.description}</p>
        {result.detail && result.status !== 'pending' && (
          <p className={`mt-1 text-xs font-medium ${
            result.status === 'fail'    ? 'text-red-400' :
            result.status === 'warning' ? 'text-yellow-400' :
            result.status === 'running' ? 'text-blue-300' :
            result.status === 'pass'    ? 'text-emerald-400/80' :
            'text-muted-foreground'
          }`}>{result.detail}</p>
        )}
        {result.status === 'pass' && (result.peakCurrentA > 0 || result.peakTempC > 0) && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {result.peakCurrentA > 0 && (
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground bg-background/60 border border-border/40">
                <Zap className="size-2.5" />{result.peakCurrentA.toFixed(1)} A peak
              </span>
            )}
            {result.peakTempC > 0 && (
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground bg-background/60 border border-border/40">
                <Thermometer className="size-2.5" />{result.peakTempC.toFixed(0)} °C peak
              </span>
            )}
          </div>
        )}
      </div>
      {isActive && timeRemain > 0 && (
        <div className="shrink-0 text-right text-xs tabular-nums text-blue-300">
          {timeRemain.toFixed(1)} s
        </div>
      )}
    </div>
  );
}

/** Full-screen interactive prompt for gyro / vision steps. */
function InteractivePrompt({
  stepName,
  stepType,
  promptText,
  timeRemain,
  isSim,
}: {
  stepName: string;
  stepType: SelfTestStepType;
  promptText: string;
  timeRemain: number;
  isSim: boolean;
}) {
  if (isSim) return null; // auto-passed in simulation

  const isGyro   = stepType === 'GYRO_CHECK';
  const isVision = stepType === 'VISION_CHECK';

  if (!isGyro && !isVision) return null;

  const accentCls = isGyro
    ? 'border-violet-500/40 bg-violet-500/8'
    : 'border-cyan-500/40 bg-cyan-500/8';
  const Icon = isGyro ? Activity : ChevronRight;

  return (
    <div className={`rounded-2xl border-2 p-5 ${accentCls}`}>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Icon className={`size-5 ${isGyro ? 'text-violet-400' : 'text-cyan-400'}`} />
        <span className="text-sm font-black text-foreground">{stepName}</span>
        {timeRemain > 0 && (
          <span className="ml-auto tabular-nums text-xs text-muted-foreground">
            {timeRemain.toFixed(0)} s left
          </span>
        )}
      </div>

      {/* Timeout bar */}
      {timeRemain > 0 && (
        <div className="mb-4 h-1 overflow-hidden rounded-full bg-border/50">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${isGyro ? 'bg-violet-400' : 'bg-cyan-400'}`}
            style={{ width: `${(timeRemain / (isGyro ? 30 : 30)) * 100}%` }}
          />
        </div>
      )}

      {/* Instruction */}
      <p className="mb-4 text-sm leading-relaxed text-foreground/90">{promptText}</p>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={confirmStep} className="gap-1.5 bg-emerald-600 hover:bg-emerald-500">
          <CheckCircle2 className="size-4" />
          Confirm
        </Button>
        <Button type="button" variant="outline" onClick={skipStep} className="gap-1.5">
          <SkipForward className="size-4" />
          Skip
        </Button>
        <Button type="button" variant="outline" onClick={failStep}
          className="gap-1.5 border-red-500/40 text-red-400 hover:bg-red-500/10">
          <XCircle className="size-4" />
          Mark Failed
        </Button>
      </div>
    </div>
  );
}

function SummaryBanner({ results, state }: { results: SelfTestResult[]; state: SelfTestState }) {
  if (!results.length || state === 'idle') return null;

  const pass    = results.filter(r => r.status === 'pass').length;
  const warn    = results.filter(r => r.status === 'warning').length;
  const fail    = results.filter(r => r.status === 'fail').length;
  const skip    = results.filter(r => r.status === 'skipped').length;
  const done    = results.filter(r => !['pending', 'running'].includes(r.status)).length;
  const total   = results.filter(r => r.status !== 'pending').length;
  const pct     = total > 0 ? Math.round((pass / Math.max(1, total - skip)) * 100) : null;

  if (state === 'running') return null; // live metrics strip handles this

  const bgCls = state === 'aborted'
    ? 'border-orange-500/30 bg-orange-500/8'
    : fail > 0 ? 'border-red-500/30 bg-red-500/8'
    : warn > 0 ? 'border-yellow-500/30 bg-yellow-500/8'
    : 'border-emerald-500/30 bg-emerald-500/8';

  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${bgCls}`}>
      {pct !== null && (
        <span className={`text-3xl font-black tabular-nums ${
          fail > 0 ? 'text-red-300' : warn > 0 ? 'text-yellow-300' : 'text-emerald-300'
        }`}>{pct}%</span>
      )}
      <div className="flex-1">
        <div className={`text-sm font-semibold ${
          state === 'aborted' ? 'text-orange-300' :
          fail > 0 ? 'text-red-300' : warn > 0 ? 'text-yellow-300' : 'text-emerald-300'
        }`}>
          {state === 'aborted' ? 'Test aborted' :
           fail > 0 ? 'Issues found' : warn > 0 ? 'Warnings found' : 'All checks passed'}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{done} of {results.length} steps completed</div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {pass > 0 && <Badge variant="success">{pass} passed</Badge>}
        {warn > 0 && <Badge variant="warning">{warn} warnings</Badge>}
        {fail > 0 && <Badge variant="destructive">{fail} failed</Badge>}
        {skip > 0 && <Badge variant="muted">{skip} skipped</Badge>}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function SelfTestTab() {
  // Robot state
  const robotEnabled = useNTValue<boolean>(NT_KEYS.ROBOT_ENABLED, false);
  const robotMode    = useNTValue<string>(NT_KEYS.ROBOT_MODE, 'disabled');

  // Self-test state
  const state       = useNTValue<SelfTestState>(NT_KEYS.SELF_TEST_STATE, 'idle');
  const stepIndex   = useNTValue<number>(NT_KEYS.SELF_TEST_STEP_INDEX, -1);
  const stepCount   = useNTValue<number>(NT_KEYS.SELF_TEST_STEP_COUNT, 0);
  const stepName    = useNTValue<string>(NT_KEYS.SELF_TEST_STEP_NAME, '');
  const stepType    = useNTValue<SelfTestStepType>(NT_KEYS.SELF_TEST_STEP_TYPE, '');
  const timeRemain  = useNTValue<number>(NT_KEYS.SELF_TEST_TIME_REMAIN, 0);
  const liveCurrentA = useNTValue<number>(NT_KEYS.SELF_TEST_LIVE_CURRENT, 0);
  const liveTempC    = useNTValue<number>(NT_KEYS.SELF_TEST_LIVE_TEMP, 0);
  const liveBattV    = useNTValue<number>(NT_KEYS.SELF_TEST_LIVE_BATTERY, 0);
  const promptText   = useNTValue<string>(NT_KEYS.SELF_TEST_PROMPT, '');
  const resultsRaw   = useNTValue<string>(NT_KEYS.SELF_TEST_RESULTS, '[]');
  const isSim        = useNTValue<boolean>(NT_KEYS.SELF_TEST_IS_SIM, false);

  const results = parseJsonArray<SelfTestResult>(resultsRaw, []);

  const isRunning     = state === 'running' || state === 'waiting_user';
  const isDone        = state === 'done' || state === 'aborted';
  const canStart      = !!robotEnabled && robotMode === 'teleop' && !isRunning;
  const isWaitingUser = state === 'waiting_user';

  return (
    <div className="grid gap-4">
      {/* ── Status / action row ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Robot enabled pill */}
        <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
          canStart
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
            : 'border-border/50 bg-background/30 text-muted-foreground'
        }`}>
          <Power className="size-3" />
          {canStart ? 'Robot enabled (Teleop)' : robotEnabled ? `Enabled (${robotMode})` : 'Robot disabled'}
        </div>

        {isSim && (
          <Badge variant="secondary" className="gap-1 text-[11px]">
            Simulation — gyro & vision auto-confirmed
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isRunning && (
            <Button type="button" variant="outline" size="sm" onClick={abortTest}
              className="gap-1.5 border-red-500/40 text-red-400 hover:bg-red-500/10">
              <OctagonX className="size-3.5" />Abort
            </Button>
          )}
          <Button type="button" onClick={startTest} disabled={!canStart} size="sm" className="gap-1.5">
            {isRunning
              ? <><Loader2 className="size-3.5 animate-spin" />Running…</>
              : <><Play className="size-3.5" />Start Self Test</>
            }
          </Button>
        </div>
      </div>

      {/* ── Enabled reminder ─────────────────────────────────────────────── */}
      {!canStart && !isRunning && !isDone && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/8 px-4 py-3">
          <p className="text-sm font-semibold text-yellow-300">Robot must be teleop-enabled to run</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Enable the robot in teleop mode on the Driver Station, then press Start Self Test.
            The test controls motors — keep the robot on blocks or in a clear area.
          </p>
        </div>
      )}

      {/* ── Live metrics strip (only while running) ───────────────────────── */}
      {isRunning && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/8 px-4 py-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-blue-300">
              {isWaitingUser ? `Waiting: ${stepName}` : `Running: ${stepName}`}
            </span>
            {stepCount > 0 && <ProgressBar current={Math.max(0, stepIndex ?? 0)} total={stepCount} />}
          </div>
          <div className="flex flex-wrap gap-2">
            <MetricPill icon={<Zap className="size-3" />} value={`${liveBattV?.toFixed(2) ?? '—'} V`} label="battery"
              warn={(liveBattV ?? 0) > 0 && (liveBattV ?? 12) < 11.0} />
            <MetricPill icon={<Activity className="size-3" />} value={`${liveCurrentA?.toFixed(1) ?? '—'} A`} label="current"
              warn={(liveCurrentA ?? 0) > 20} />
            <MetricPill icon={<Thermometer className="size-3" />} value={`${liveTempC?.toFixed(0) ?? '—'} °C`} label="temp"
              warn={(liveTempC ?? 0) > 65} />
          </div>
        </div>
      )}

      {/* ── Interactive prompt (gyro / vision) ───────────────────────────── */}
      {isWaitingUser && promptText && (
        <InteractivePrompt
          stepName={stepName ?? ''}
          stepType={stepType ?? ''}
          promptText={promptText}
          timeRemain={timeRemain ?? 0}
          isSim={isSim ?? false}
        />
      )}

      {/* ── Summary banner (when done) ────────────────────────────────────── */}
      <SummaryBanner results={results} state={state ?? 'idle'} />

      {/* ── Step list ─────────────────────────────────────────────────────── */}
      {results.length > 0 && (
        <div className="grid gap-1.5">
          {results.map((result, i) => (
            <StepRow
              key={result.id}
              result={result}
              isCurrent={i === stepIndex}
              stepType={i === stepIndex ? (stepType ?? '') : guessStepType(result)}
              timeRemain={i === stepIndex ? (timeRemain ?? 0) : 0}
            />
          ))}
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {results.length === 0 && !isRunning && (
        <div className="grid h-36 place-items-center text-sm text-muted-foreground">
          <div className="text-center">
            <p>No test results yet.</p>
            <p className="mt-1 text-xs">
              {canStart
                ? 'Press Start Self Test to begin.'
                : 'Enable the robot in teleop mode, then press Start Self Test.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Infer step type from label when the live stepType NT isn't current for that row. */
function guessStepType(result: SelfTestResult): SelfTestStepType {
  const id = result.id ?? '';
  if (id.startsWith('health')) return 'HEALTH_CHECK';
  if (id === 'gyro')           return 'GYRO_CHECK';
  if (id === 'vision')         return 'VISION_CHECK';
  if (id.includes('pause') || id.includes('stop')) return 'WAIT';
  return 'MOTOR_RUN';
}
