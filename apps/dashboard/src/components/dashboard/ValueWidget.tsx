import { Badge } from '../ui';
import { formatValue } from '../../dashboardContract';
import { getTopicLeafName } from '../../hooks/useSubsystemSnapshots';
import type { NTTopicSnapshot } from '../../hooks/useNTPrefix';
import type { DashboardWidget } from './types';

function toneClass(value: unknown) {
  if (typeof value !== 'boolean') return undefined;
  return value ? 'text-primary' : 'text-destructive';
}

export function ValueWidget({ widget, topics }: { widget: DashboardWidget; topics: NTTopicSnapshot[] }) {
  const primary = topics[0];

  if (!primary) {
    return <div className="grid h-full min-h-16 place-items-center text-center text-xs font-medium text-muted-foreground">Topic not live</div>;
  }

  if ((widget.display ?? 'large') === 'large') {
    return (
      <div className="flex h-full min-h-16 flex-col justify-center gap-1">
        <span className="truncate text-xs font-medium text-muted-foreground">{getTopicLeafName(primary.key)}</span>
        <strong className={`truncate text-2xl font-black leading-none tracking-tight text-foreground ${toneClass(primary.value) ?? ''}`} style={{ fontSize: widget.fontSize ? `${widget.fontSize}px` : undefined, color: widget.color || undefined }}>
          {typeof primary.value === 'boolean'
            ? <Badge variant={primary.value ? 'success' : 'destructive'}>{formatValue(primary.value)}</Badge>
            : formatValue(primary.value)}
        </strong>
      </div>
    );
  }

  return (
    <div className="grid gap-1.5">
      {topics.map(topic => (
        <div className="grid min-h-7 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border/50 bg-background/35 px-2 py-1 text-xs" key={topic.key}>
          <span className="min-w-0 truncate text-muted-foreground">{getTopicLeafName(topic.key)}</span>
          <strong className={`min-w-0 text-right text-xs font-semibold text-foreground ${toneClass(topic.value) ?? ''}`} style={{ fontSize: widget.fontSize ? `${widget.fontSize}px` : undefined, color: widget.color || undefined }}>
            {typeof topic.value === 'boolean'
              ? <Badge variant={topic.value ? 'success' : 'destructive'}>{formatValue(topic.value)}</Badge>
              : formatValue(topic.value)}
          </strong>
        </div>
      ))}
    </div>
  );
}
