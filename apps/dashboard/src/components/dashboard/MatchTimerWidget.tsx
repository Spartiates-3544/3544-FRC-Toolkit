import { NT_KEYS, formatValue } from '../../dashboardContract';
import type { NTTopicSnapshot } from '../../hooks/useNTPrefix';
import type { DashboardWidget } from './types';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function MatchTimerWidget({ widget, topic }: { widget: DashboardWidget; topic?: NTTopicSnapshot }) {
  const value = typeof topic?.value === 'number' ? topic.value : Number(formatValue(topic?.value));
  const lowMax = widget.timerLowMax ?? 30;
  const midMax = widget.timerMidMax ?? 50;
  const color = value <= lowMax
    ? widget.timerLowColor ?? 'var(--primary)'
    : value <= midMax
      ? widget.timerMidColor ?? 'var(--destructive)'
      : widget.timerHighColor ?? 'var(--chart-2)';

  return (
    <div className="flex h-full min-h-20 flex-col items-center justify-center gap-1">
      <span className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">{NT_KEYS.ROBOT_MATCH_TIME}</span>
      <strong className="font-black tabular-nums leading-none tracking-tight" style={{ color, fontSize: widget.fontSize ? `${widget.fontSize}px` : undefined }}>
        {formatTime(value)}
      </strong>
    </div>
  );
}
