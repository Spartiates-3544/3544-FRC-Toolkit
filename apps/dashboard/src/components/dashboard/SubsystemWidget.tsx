import { Badge } from '../ui';
import { formatValue } from '../../dashboardContract';
import { getTopicLeafName, type SubsystemSnapshot } from '../../hooks/useSubsystemSnapshots';
import type { DashboardWidget } from './types';

function toneClass(value: unknown) {
  if (typeof value !== 'boolean') return undefined;
  return value ? 'text-primary' : 'text-destructive';
}

export function SubsystemWidget({
  widget,
  subsystem,
}: {
  widget: DashboardWidget;
  subsystem?: SubsystemSnapshot;
}) {
  if (!subsystem) {
    return <div className="grid h-full min-h-16 place-items-center text-center text-xs font-medium text-muted-foreground">Subsystem not live</div>;
  }

  const visibleTopics = subsystem.topics.filter(topic => {
    const leaf = getTopicLeafName(topic.key);
    return !widget.topicKeys?.length || widget.topicKeys.includes(leaf);
  });

  return (
    <div className="grid gap-1.5">
      {visibleTopics.map(topic => (
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
