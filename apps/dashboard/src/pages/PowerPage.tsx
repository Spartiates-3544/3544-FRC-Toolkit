import { useEffect, useRef, useState } from 'react';
import { NT_KEYS } from '../nt';
import { useNTValue } from '../hooks/useNTValue';
import { usePowerSubsystem, type SubsystemPowerData } from '../hooks/usePowerSubsystem';
import {
  Button,
  Card,
  EmptyState,
  Row,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
} from '../components/ui';

// ── theme chart colors ───────────────────────────────────────────────────────

const PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const color = (i: number) => PALETTE[i % PALETTE.length];

// ── sub-view types ────────────────────────────────────────────────────────────

type SubView = 'summary' | 'timeline' | 'detail';

// ── SubsystemReader: reads NT hooks for one subsystem, reports data up ────────
// This component exists so we can call hooks dynamically per discovered subsystem
// without violating rules of hooks in the parent.

function SubsystemReader({
  name,
  onData,
}: {
  name: string;
  onData: (data: SubsystemPowerData) => void;
}) {
  const data = usePowerSubsystem(name);
  useEffect(() => { onData(data); });
  return null;
}

// ── energy formatter ─────────────────────────────────────────────────────────

function fmtEnergy(j: number) {
  return j >= 1000 ? `${(j / 1000).toFixed(2)} kJ` : `${j.toFixed(1)} J`;
}

function fmtPower(w: number) {
  return w >= 1000 ? `${(w / 1000).toFixed(1)} kW` : `${w.toFixed(0)} W`;
}

function nicePowerScale(maxW: number) {
  if (maxW <= 120) return 120;
  if (maxW <= 300) return 300;
  if (maxW <= 600) return 600;
  if (maxW <= 1200) return 1200;
  return Math.ceil(maxW / 500) * 500;
}

// ── Summary view ──────────────────────────────────────────────────────────────

type SummaryMode = 'subsystem' | 'motor';

interface SummaryRow {
  label: string;
  sublabel?: string;
  energy: number;
  power: number;
  current: number;
  colorIndex: number;
}

function SummaryView({ data }: { data: SubsystemPowerData[] }) {
  const [mode, setMode] = useState<SummaryMode>('subsystem');

  const rows: SummaryRow[] = mode === 'subsystem'
    ? data.map((d, i) => ({ label: d.name, energy: d.energy, power: d.power, current: d.current, colorIndex: i }))
    : data.flatMap((d, subsysIdx) =>
        d.motorNames.map((motorName, mi) => {
          const motorCurrent = d.motorCurrents[mi] ?? 0;
          const share = d.current > 0 ? motorCurrent / d.current : 0;
          return {
            label: motorName,
            sublabel: d.name,
            energy: d.energy * share,
            power: d.power * share,
            current: motorCurrent,
            colorIndex: subsysIdx * 5 + mi,
          };
        })
      );

  const sorted = [...rows].sort((a, b) => b.energy - a.energy);
  const totalE = sorted.reduce((s, r) => s + r.energy, 0) || 1;

  return (
    <Card title="Energy Consumption" wide>
      <div className="mb-4 flex gap-2">
        <Button size="sm" variant={mode === 'subsystem' ? 'default' : 'outline'} onClick={() => setMode('subsystem')}>By Subsystem</Button>
        <Button size="sm" variant={mode === 'motor' ? 'default' : 'outline'} onClick={() => setMode('motor')}>By Motor</Button>
      </div>
      {sorted.length === 0 ? (
        <EmptyState label="Waiting for subsystem data" />
      ) : (
        <div className="grid gap-4">
          {sorted.map((r) => {
            const c = color(r.colorIndex);
            const share = r.energy / totalE;
            return (
              <div className="grid gap-2" key={`${r.sublabel ?? ''}:${r.label}`}>
                <div className="grid items-center gap-2 md:grid-cols-[minmax(120px,1fr)_auto]">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ background: c }} />
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{r.label}</span>
                      {r.sublabel && <span className="block truncate text-[11px] text-muted-foreground">{r.sublabel}</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-left text-xs text-muted-foreground md:min-w-[250px] md:text-right">
                    <span className="font-black text-foreground">{fmtEnergy(r.energy)}</span>
                    <span>{fmtPower(r.power)}</span>
                    <span>{r.current.toFixed(1)} A</span>
                  </div>
                </div>
                <div className="h-3.5 overflow-hidden rounded-full border border-border/70 bg-background/70" aria-label={`${r.label} energy share`}>
                  <div
                    className="h-full min-w-2 rounded-full shadow-[0_0_18px_currentColor]"
                    style={{ width: `${Math.max(share * 100, 2)}%`, background: c }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── Timeline view ─────────────────────────────────────────────────────────────

type Sample = { t: number; w: number };

function smoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function TimelineView({ data }: { data: SubsystemPowerData[] }) {
  const historyRef  = useRef<Map<string, Sample[]>>(new Map());
  const latestRef   = useRef<Map<string, number>>(new Map());
  const [, tick]    = useState(0);
  const WINDOW      = 30_000; // ms

  // Keep latest power values in ref so interval can read without stale closure
  useEffect(() => {
    data.forEach(d => latestRef.current.set(d.name, d.power));
  });

  // Sample every 500 ms
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      latestRef.current.forEach((w, name) => {
        if (!historyRef.current.has(name)) historyRef.current.set(name, []);
        const buf = historyRef.current.get(name)!;
        buf.push({ t: now, w });
        // cull old samples
        while (buf.length > 0 && buf[0].t < now - WINDOW) buf.shift();
      });
      tick(n => n + 1);
    }, 500);
    return () => clearInterval(id);
  }, []);

  // SVG coordinate helpers
  const W = 960, H = 430;
  const padL = 74, padR = 34, padT = 34, padB = 54;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const now = Date.now();
  const allSamples = [...historyRef.current.values()].flat();
  const maxW = Math.max(...allSamples.map(s => s.w), 100);
  const yScale = nicePowerScale(maxW);

  const toX = (t: number) => padL + ((t - (now - WINDOW)) / WINDOW) * plotW;
  const toY = (w: number) => padT + plotH - (w / yScale) * plotH;

  const yLines = [0, 0.2, 0.4, 0.6, 0.8, 1].map(f => f * yScale);
  const hasLines = data.some(d => (historyRef.current.get(d.name)?.length ?? 0) >= 2);

  return (
    <Card title="Power Over Time (last 30 s)" wide>
      <div className="relative h-[clamp(300px,45vh,500px)] w-full overflow-hidden rounded-xl border border-border bg-background/70">
        {!hasLines && <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">Collecting samples...</div>}
        <svg className="block h-full w-full" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Subsystem power over the last 30 seconds">
          <defs>
            <linearGradient id="chartFade" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--muted)" stopOpacity="0.42" />
              <stop offset="100%" stopColor="var(--background)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x={padL} y={padT} width={plotW} height={plotH} rx="8" fill="url(#chartFade)" />
          {yLines.map(v => (
            <g key={v}>
              <line className="stroke-[color-mix(in_oklch,var(--border)_74%,transparent)] [stroke-width:1] [vector-effect:non-scaling-stroke]" x1={padL} y1={toY(v)} x2={W - padR} y2={toY(v)} />
              <text className="fill-muted-foreground text-xs" x={padL - 10} y={toY(v) + 4} textAnchor="end">
                {fmtPower(v)}
              </text>
            </g>
          ))}
          {[-30, -20, -10, 0].map(s => (
            <g key={s}>
              <line className="stroke-[color-mix(in_oklch,var(--border)_74%,transparent)] opacity-70 [stroke-dasharray:4_7] [stroke-width:1] [vector-effect:non-scaling-stroke]" x1={toX(now + s * 1000)} y1={padT} x2={toX(now + s * 1000)} y2={padT + plotH} />
              <text className="fill-muted-foreground text-xs" x={toX(now + s * 1000)} y={H - 10} textAnchor="middle">
                {s === 0 ? 'now' : `${s}s`}
              </text>
            </g>
          ))}
          <line className="stroke-border [stroke-width:1.25] [vector-effect:non-scaling-stroke]" x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} />
          <line className="stroke-border [stroke-width:1.25] [vector-effect:non-scaling-stroke]" x1={padL} y1={padT} x2={padL} y2={padT + plotH} />
          {data.map((d, i) => {
            const buf = historyRef.current.get(d.name);
            if (!buf || buf.length < 2) return null;
            const points = buf.map(s => ({
              x: Number(toX(s.t).toFixed(1)),
              y: Number(toY(s.w).toFixed(1)),
            }));
            const path = smoothPath(points);
            const latest = buf[buf.length - 1];
            return (
              <g key={d.name}>
                <path className="opacity-15 blur-[0.5px] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:12] [vector-effect:non-scaling-stroke]" d={path} fill="none" stroke={color(i)} />
                <path className="[stroke-linecap:round] [stroke-linejoin:round] [stroke-width:3] [vector-effect:non-scaling-stroke]" d={path} fill="none" stroke={color(i)} />
                <circle cx={toX(latest.t)} cy={toY(latest.w)} r="3.5" fill={color(i)} stroke="var(--background)" strokeWidth="2" />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {data.map((d, i) => (
          <div key={d.name} className="flex min-h-7 items-center gap-2 rounded-full border border-border/70 bg-muted/45 px-3 py-1 text-xs text-muted-foreground">
            <div className="size-2.5 rounded-sm" style={{ background: color(i) }} />
            <span>{d.name}</span>
            <strong className="text-xs font-black text-foreground">{fmtPower(historyRef.current.get(d.name)?.at(-1)?.w ?? d.power)}</strong>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Detail view ───────────────────────────────────────────────────────────────

function DetailView({ data, batteryVoltage }: { data: SubsystemPowerData[]; batteryVoltage: number }) {
  const [selected, setSelected] = useState<string | null>(null);
  const active = selected
    ? data.find(d => d.name === selected) ?? data[0]
    : data[0];

  if (!active) {
    return <EmptyState label="Waiting for subsystem data" />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {data.map((d, i) => (
          <Button
            key={d.name}
            onClick={() => setSelected(d.name)}
            variant={active.name === d.name ? 'default' : 'outline'}
            size="sm"
          >
            {d.name}
          </Button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Subsystem">
          <Row label="Current"        value={`${active.current.toFixed(2)} A`} />
          <Row label="Power"          value={`${active.power.toFixed(1)} W`} />
          <Row label="Total Energy"   value={fmtEnergy(active.energy)} />
          <Row label="Battery Voltage" value={`${batteryVoltage.toFixed(3)} V`} />
        </Card>
      </div>

      <Card title={`${active.name} — Motor Breakdown`} wide>
        <Table>
          <TableHeader>
            <TableRow>
              {['Motor', 'Current (A)', 'Power (W)', 'Share (%)'].map(h => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {active.motorNames.map((name, i) => {
              const amps  = active.motorCurrents[i] ?? 0;
              const watts = amps * batteryVoltage;
              const share = active.power > 0 ? (watts / active.power * 100).toFixed(1) : '—';
              return (
                <TableRow key={name}>
                  <TableCell>{name}</TableCell>
                  <TableCell className="text-muted-foreground">{amps.toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground">{watts.toFixed(1)}</TableCell>
                  <TableCell className="text-muted-foreground">{share}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ── PowerPage root ────────────────────────────────────────────────────────────

export default function PowerPage() {
  const [view, setView] = useState<SubView>('summary');

  const subsystemNames = useNTValue<string[]>(NT_KEYS.POWER_SUBSYSTEM_NAMES, []);
  const batteryVoltage = useNTValue<number>(NT_KEYS.POWER_BATTERY_VOLTAGE, 0);
  const totalCurrent   = useNTValue<number>(NT_KEYS.POWER_BATTERY_CURRENT, 0);
  const totalPower     = useNTValue<number>(NT_KEYS.POWER_BATTERY_POWER, 0);

  // Collect data from each discovered subsystem via SubsystemReader
  const [subsystemData, setSubsystemData] = useState<Map<string, SubsystemPowerData>>(new Map());
  const handleData = (data: SubsystemPowerData) => {
    setSubsystemData(prev => {
      const next = new Map(prev);
      next.set(data.name, data);
      return next;
    });
  };

  const dataList = subsystemNames
    .map(n => subsystemData.get(n))
    .filter((d): d is SubsystemPowerData => d !== undefined);

  const VIEWS: { id: SubView; label: string }[] = [
    { id: 'summary',  label: 'Summary' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'detail',   label: 'Detail' },
  ];

  return (
    <div>
      {subsystemNames.map(name => (
        <SubsystemReader key={name} name={name} onData={handleData} />
      ))}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Battery"
          value={`${batteryVoltage.toFixed(3)} V`}
          tone={batteryVoltage < 11.5 ? 'destructive' : batteryVoltage < 12.2 ? 'warning' : 'success'}
        />
        <StatCard label="Total Current" value={`${totalCurrent.toFixed(1)} A`} />
        <StatCard label="Total Power" value={`${totalPower.toFixed(0)} W`} />
        <StatCard label="Subsystems" value={subsystemNames.length} />
      </div>

      <Tabs items={VIEWS} value={view} onValueChange={setView} />

      <div className="mt-4">
        {view === 'summary'  && <SummaryView data={dataList} />}
        {view === 'timeline' && <TimelineView data={dataList} />}
        {view === 'detail'   && <DetailView data={dataList} batteryVoltage={batteryVoltage} />}
      </div>
    </div>
  );
}
