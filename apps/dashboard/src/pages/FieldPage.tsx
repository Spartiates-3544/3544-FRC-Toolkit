import { useEffect, useMemo, useState } from 'react';
import { useNTValue } from '../hooks/useNTValue';
import { NT_KEYS } from '../nt';
import { parsePose, type RobotPose } from '../dashboardContract';
import { Card, Row, Grid } from '../components/ui';

const FIELD_LENGTH_M = 16.54;
const FIELD_WIDTH_M = 8.21;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function FieldPage() {
  const rawPose = useNTValue<number[] | string>(NT_KEYS.ROBOT_POSE, [0, 0, 0]);
  const [history, setHistory] = useState<RobotPose[]>([]);

  const pose = useMemo(() => parsePose(rawPose), [rawPose]);

  useEffect(() => {
    setHistory(prev => {
      const last = prev.at(-1);
      if (last && Math.hypot(last.x - pose.x, last.y - pose.y) < 0.03 && Math.abs(last.rotation - pose.rotation) < 1) {
        return prev;
      }
      return [...prev, pose].slice(-180);
    });
  }, [pose]);

  const x = clamp((pose.x / FIELD_LENGTH_M) * 100, 0, 100);
  const y = clamp(50 - (pose.y / FIELD_WIDTH_M) * 50, 0, 50);
  const path = history
    .map(p => `${clamp((p.x / FIELD_LENGTH_M) * 100, 0, 100)},${clamp(50 - (p.y / FIELD_WIDTH_M) * 50, 0, 50)}`)
    .join(' ');

  return (
    <Grid>
      <Card title="Field Simulation" wide>
        <div className="aspect-[2/1] min-h-[220px] max-h-[620px] w-full overflow-hidden rounded-xl border border-border bg-background/60 md:min-h-[320px]">
          <svg className="block h-full w-full" viewBox="0 0 100 50" role="img" aria-label="Robot pose on FRC field">
            <rect className="fill-[color-mix(in_oklch,var(--primary)_16%,var(--background))]" x="0" y="0" width="100" height="50" rx="1.5" />
            <line className="stroke-[color-mix(in_oklch,var(--foreground)_38%,transparent)] [stroke-dasharray:1.2_1.2] [stroke-width:0.35]" x1="50" x2="50" y1="0" y2="50" />
            <rect className="fill-primary opacity-20" x="0" y="0" width="18" height="50" />
            <rect className="fill-primary opacity-20" x="82" y="0" width="18" height="50" />
            <g className="[&_line]:stroke-[color-mix(in_oklch,var(--foreground)_22%,transparent)] [&_line]:[stroke-width:0.16]">
              {Array.from({ length: 9 }, (_, i) => <line key={`v-${i}`} x1={i * 12.5} x2={i * 12.5} y1="0" y2="50" />)}
              {Array.from({ length: 5 }, (_, i) => <line key={`h-${i}`} x1="0" x2="100" y1={i * 12.5} y2={i * 12.5} />)}
            </g>
            {history.length > 1 && (
              <polyline
                className="fill-none stroke-primary opacity-85 [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:0.45]"
                points={path}
              />
            )}
            <g transform={`translate(${x} ${y}) rotate(${pose.rotation})`}>
              <rect className="fill-foreground stroke-background [stroke-width:0.45]" x="-3.2" y="-2.5" width="6.4" height="5" rx="0.6" />
              <line className="stroke-destructive [stroke-linecap:round] [stroke-width:0.58]" x1="0" y1="0" x2="5.4" y2="0" />
            </g>
          </svg>
        </div>
      </Card>

      <Card title="Pose">
        <Row label="X" value={`${pose.x.toFixed(2)} m`} />
        <Row label="Y" value={`${pose.y.toFixed(2)} m`} />
        <Row label="Heading" value={`${pose.rotation.toFixed(1)}°`} />
        <Row label="Samples" value={`${history.length}`} />
      </Card>
    </Grid>
  );
}
