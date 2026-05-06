import { useEffect, useRef, useState } from 'react';
import { NT_KEYS } from '../nt';
import { useNTValue } from '../hooks/useNTValue';
import { usePowerSubsystem, type SubsystemPowerData } from '../hooks/usePowerSubsystem';
import {
  Button,
  Card,
  EmptyState,
  Row,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
} from '../components/ui';

// ── palette ──────────────────────────────────────────────────────────────────

const PALETTE = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#f97316', '#84cc16'];
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

function SummaryView({ data }: { data: SubsystemPowerData[] }) {
  const sorted    = [...data].sort((a, b) => b.energy - a.energy);
  const totalE    = sorted.reduce((s, d) => s + d.energy, 0) || 1;

  return (
    <Card title="Energy Consumption by Subsystem" wide>
      {sorted.length === 0 ? (
        <EmptyState label="Waiting for subsystem data" />
      ) : (
        <div className="energy-chart">
          {sorted.map((d, i) => {
            const idx = data.findIndex(x => x.name === d.name);
            const c = color(idx);
            const share = d.energy / totalE;
            return (
              <div className="energy-row" key={d.name}>
                <div className="energy-row-main">
                  <div className="energy-name">
                    <span className="chart-swatch" style={{ background: c }} />
                    <span>{d.name}</span>
                  </div>
                  <div className="energy-values">
                    <span>{fmtEnergy(d.energy)}</span>
                    <span>{fmtPower(d.power)}</span>
                    <span>{d.current.toFixed(1)} A</span>
                  </div>
                </div>
                <div className="energy-track" aria-label={`${d.name} energy share`}>
                  <div
                    className="energy-fill"
                    style={{
                      width: `${Math.max(share * 100, 2)}%`,
                      color: c,
                      background: `linear-gradient(90deg, ${c}, color-mix(in srgb, ${c} 58%, white))`,
                    }}
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
    <Card title="Power Over Time (last 30 s)" wide className="timeline-card">
      <div className="timeline-frame">
        {!hasLines && <div className="timeline-empty">Collecting samples...</div>}
        <svg className="timeline-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Subsystem power over the last 30 seconds">
          <defs>
            <linearGradient id="chartFade" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#334155" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x={padL} y={padT} width={plotW} height={plotH} rx="8" fill="url(#chartFade)" />
          {yLines.map(v => (
            <g key={v}>
              <line className="timeline-grid-line" x1={padL} y1={toY(v)} x2={W - padR} y2={toY(v)} />
              <text className="timeline-axis-label" x={padL - 10} y={toY(v) + 4} textAnchor="end">
                {fmtPower(v)}
              </text>
            </g>
          ))}
          {[-30, -20, -10, 0].map(s => (
            <g key={s}>
              <line className="timeline-grid-line timeline-grid-line-vertical" x1={toX(now + s * 1000)} y1={padT} x2={toX(now + s * 1000)} y2={padT + plotH} />
              <text className="timeline-axis-label" x={toX(now + s * 1000)} y={H - 10} textAnchor="middle">
                {s === 0 ? 'now' : `${s}s`}
              </text>
            </g>
          ))}
          <line className="timeline-axis" x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} />
          <line className="timeline-axis" x1={padL} y1={padT} x2={padL} y2={padT + plotH} />
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
                <path className="timeline-line timeline-line-glow" d={path} fill="none" stroke={color(i)} />
                <path className="timeline-line" d={path} fill="none" stroke={color(i)} />
                <circle cx={toX(latest.t)} cy={toY(latest.w)} r="3.5" fill={color(i)} stroke="#0f172a" strokeWidth="2" />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="chart-legend">
        {data.map((d, i) => (
          <div key={d.name} className="chart-legend-item">
            <div className="chart-swatch" style={{ background: color(i) }} />
            <span>{d.name}</span>
            <strong>{fmtPower(historyRef.current.get(d.name)?.at(-1)?.w ?? d.power)}</strong>
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
      <div className="button-strip">
        {data.map((d, i) => (
          <Button
            key={d.name}
            onClick={() => setSelected(d.name)}
            variant={active.name === d.name ? 'default' : 'outline'}
            size="sm"
            style={active.name === d.name ? { backgroundColor: color(i), borderColor: color(i) } : undefined}
          >
            {d.name}
          </Button>
        ))}
      </div>

      <div className="compact-grid">
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
                  <TableCell className="ui-table-cell-muted">{amps.toFixed(2)}</TableCell>
                  <TableCell className="ui-table-cell-muted">{watts.toFixed(1)}</TableCell>
                  <TableCell className="ui-table-cell-muted">{share}</TableCell>
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

      <div className="stat-strip">
        <div className="stat-card">
          <span className="stat-label">Battery</span>
          <span className="stat-value" style={{ color: batteryVoltage < 11.5 ? '#ef4444' : batteryVoltage < 12.2 ? '#f59e0b' : '#22c55e' }}>
            {batteryVoltage.toFixed(3)} V
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Current</span>
          <span className="stat-value">{totalCurrent.toFixed(1)} A</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Power</span>
          <span className="stat-value">{totalPower.toFixed(0)} W</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Subsystems</span>
          <span className="stat-value">{subsystemNames.length}</span>
        </div>
      </div>

      <Tabs items={VIEWS} value={view} onValueChange={setView} />

      <div className="tab-content">
        {view === 'summary'  && <SummaryView data={dataList} />}
        {view === 'timeline' && <TimelineView data={dataList} />}
        {view === 'detail'   && <DetailView data={dataList} batteryVoltage={batteryVoltage} />}
      </div>
    </div>
  );
}
