import { NT_KEYS, parsePose } from '../../dashboardContract';
import type { NTTopicSnapshot } from '../../hooks/useNTPrefix';

export function FieldPoseWidget({ topic }: { topic?: NTTopicSnapshot }) {
  const pose = parsePose(topic?.value as number[] | string | undefined);
  const x = Math.min(Math.max((pose.x / 16.54) * 100, 0), 100);
  const y = Math.min(Math.max(50 - (pose.y / 8.21) * 50, 0), 50);

  return (
    <div className="grid gap-2">
      <svg className="aspect-[2/1] w-full rounded-lg border border-border bg-background/50" viewBox="0 0 100 50" role="img" aria-label={NT_KEYS.ROBOT_POSE}>
        <rect className="fill-[color-mix(in_oklch,var(--primary)_16%,var(--background))]" x="0" y="0" width="100" height="50" rx="1.5" />
        <line className="stroke-[color-mix(in_oklch,var(--foreground)_38%,transparent)] [stroke-dasharray:1.2_1.2] [stroke-width:0.35]" x1="50" x2="50" y1="0" y2="50" />
        <rect className="fill-primary opacity-20" x="0" y="0" width="18" height="50" />
        <rect className="fill-primary opacity-20" x="82" y="0" width="18" height="50" />
        <g className="[&>line]:stroke-[color-mix(in_oklch,var(--foreground)_22%,transparent)] [&>line]:[stroke-width:0.16]">
          {Array.from({ length: 9 }, (_, i) => <line key={`v-${i}`} x1={i * 12.5} x2={i * 12.5} y1="0" y2="50" />)}
          {Array.from({ length: 5 }, (_, i) => <line key={`h-${i}`} x1="0" x2="100" y1={i * 12.5} y2={i * 12.5} />)}
        </g>
        <g transform={`translate(${x} ${y}) rotate(${pose.rotation})`}>
          <rect className="fill-foreground stroke-background [stroke-width:0.45]" x="-3.2" y="-2.5" width="6.4" height="5" rx="0.6" />
          <line className="stroke-destructive [stroke-linecap:round] [stroke-width:0.58]" x1="0" y1="0" x2="5.4" y2="0" />
        </g>
      </svg>
      <div className="grid grid-cols-3 gap-1 text-center text-xs font-semibold text-muted-foreground">
        <span>X {pose.x.toFixed(2)} m</span>
        <span>Y {pose.y.toFixed(2)} m</span>
        <span>{pose.rotation.toFixed(1)} deg</span>
      </div>
    </div>
  );
}
