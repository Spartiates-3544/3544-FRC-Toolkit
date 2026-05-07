import { useMemo, useState } from 'react';
import { formatValue, type ReplayTimeline } from '../dashboardContract';
import { Button, Card, EmptyState, Input, InputRow, Row, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui';

function parseTimeline(text: string): ReplayTimeline | null {
  try {
    const parsed = JSON.parse(text) as ReplayTimeline;
    if (!Array.isArray(parsed.frames)) return null;
    return {
      startTime: parsed.startTime ?? parsed.frames[0]?.timestamp ?? 0,
      endTime: parsed.endTime ?? parsed.frames.at(-1)?.timestamp ?? 0,
      frames: parsed.frames,
      metadata: parsed.metadata,
    };
  } catch {
    return null;
  }
}

export default function ReplayPage() {
  const [raw, setRaw] = useState('');
  const [timeline, setTimeline] = useState<ReplayTimeline | null>(null);
  const [cursor, setCursor] = useState(0);
  const duration = timeline ? Math.max(timeline.endTime - timeline.startTime, 1) : 1;

  const visibleFrames = useMemo(() => {
    if (!timeline) return [];
    const t = timeline.startTime + duration * cursor;
    return timeline.frames.filter(frame => frame.timestamp <= t).slice(-80).reverse();
  }, [cursor, duration, timeline]);

  return (
    <div>
      <Card title="Replay Import" wide>
        <InputRow className="items-center max-md:flex-col max-md:items-stretch">
          <Input
            value={raw}
            onChange={event => setRaw(event.target.value)}
            placeholder='Paste replay JSON: {"frames":[{"timestamp":0,"key":"/3544/Robot/Mode","value":"auto"}]}'
          />
          <Button onClick={() => setTimeline(parseTimeline(raw))}>Load</Button>
        </InputRow>
        {timeline ? (
          <div className="mt-3 grid grid-cols-1 gap-x-5 rounded-xl border border-border/70 bg-background/45 px-3 py-2 md:grid-cols-3">
              <Row label="Frames" value={`${timeline.frames.length}`} />
              <Row label="Duration" value={`${(duration / 1000).toFixed(2)} s`} />
              <Row label="Event" value={timeline.metadata?.eventName ?? '—'} />
          </div>
        ) : (
          <div className="py-3 text-sm text-muted-foreground">Recording/export is intentionally deferred; this importer validates the shared replay shape.</div>
        )}
      </Card>

      <div className="mt-4">
        {!timeline ? (
          <EmptyState label="No replay loaded">Paste a dashboard-core replay timeline JSON to inspect frames.</EmptyState>
        ) : (
          <Card title="Timeline" wide>
            <input
              className="mb-4 w-full accent-primary"
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={cursor}
              onChange={event => setCursor(Number(event.target.value))}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleFrames.map((frame, index) => (
                  <TableRow key={`${frame.timestamp}-${frame.key}-${index}`}>
                    <TableCell className="text-muted-foreground">{((frame.timestamp - timeline.startTime) / 1000).toFixed(2)} s</TableCell>
                    <TableCell>{frame.key}</TableCell>
                    <TableCell className="text-muted-foreground">{formatValue(frame.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
