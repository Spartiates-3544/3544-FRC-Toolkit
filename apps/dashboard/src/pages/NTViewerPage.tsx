import { useEffect, useMemo, useState } from 'react';
import { useNTConnected } from '../hooks/useNTValue';
import { useNTPrefix, type NTTopicSnapshot } from '../hooks/useNTPrefix';
import { formatValue } from '../dashboardContract';
import { Badge, Card, EmptyState, Input, StatCard } from '../components/ui';

type NTGroup = {
  name: string;
  path: string;
  topics: NTTopicSnapshot[];
  children: NTGroup[];
  total: number;
  live: number;
};

function relativeSegments(key: string, prefix: string) {
  const relative = key.startsWith(prefix) ? key.slice(prefix.length) : key;
  return relative.split('/').filter(Boolean);
}

function buildGroups(topics: NTTopicSnapshot[], prefix: string) {
  const root: NTGroup = { name: prefix, path: prefix, topics: [], children: [], total: 0, live: 0 };
  const childMaps = new Map<NTGroup, Map<string, NTGroup>>();

  function childrenFor(group: NTGroup) {
    const existing = childMaps.get(group);
    if (existing) return existing;
    const created = new Map<string, NTGroup>();
    childMaps.set(group, created);
    return created;
  }

  for (const topic of topics) {
    const segments = relativeSegments(topic.key, prefix);
    const leafName = segments.pop() ?? topic.key;
    let group = root;

    for (const segment of segments) {
      const map = childrenFor(group);
      const nextPath = group.path === '/' ? `/${segment}` : `${group.path}/${segment}`;
      let next = map.get(segment);
      if (!next) {
        next = { name: segment, path: nextPath, topics: [], children: [], total: 0, live: 0 };
        map.set(segment, next);
        group.children.push(next);
      }
      group = next;
    }

    group.topics.push({ ...topic, key: leafName });
  }

  function finalize(group: NTGroup): NTGroup {
    group.children = group.children
      .map(finalize)
      .sort((a, b) => a.name.localeCompare(b.name));
    group.topics.sort((a, b) => a.key.localeCompare(b.key));
    group.total = group.topics.length + group.children.reduce((sum, child) => sum + child.total, 0);
    group.live = group.topics.filter(topic => topic.online).length + group.children.reduce((sum, child) => sum + child.live, 0);
    return group;
  }

  return finalize(root).children;
}

function topicAge(now: number, topic: NTTopicSnapshot) {
  return `${Math.max(0, (now - topic.lastChangedMs) / 1000).toFixed(1)} s`;
}

function NTTopicRow({ topic, now }: { topic: NTTopicSnapshot; now: number }) {
  return (
    <div className="grid min-h-10 grid-cols-[1fr_auto] items-center gap-3 border-b border-border/60 px-3 py-2 text-sm text-foreground last:border-b-0 hover:bg-accent/50 md:grid-cols-[minmax(240px,1.4fr)_130px_minmax(180px,1fr)_78px] md:py-0 md:pl-7">
      <div className="col-span-full flex min-w-0 items-center gap-2 md:col-span-1">
        <Badge variant={topic.online ? 'success' : 'muted'}>{topic.online ? 'live' : 'stale'}</Badge>
        <span className="min-w-0 truncate font-semibold text-foreground">{topic.key}</span>
      </div>
      <span className="min-w-0 truncate text-sm text-muted-foreground">{topic.type}</span>
      <span className="col-span-full min-w-0 truncate text-sm text-muted-foreground md:col-span-1">{formatValue(topic.value)}</span>
      <span className="min-w-0 truncate text-right text-sm text-muted-foreground">{topicAge(now, topic)}</span>
    </div>
  );
}

function NTGroupNode({ group, now, depth, forceOpen }: { group: NTGroup; now: number; depth: number; forceOpen: boolean }) {
  const stale = group.total - group.live;
  const [open, setOpen] = useState(forceOpen || depth < 1);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  return (
    <details className="group border-b border-border/70 last:border-b-0 [&_details]:ml-3 [&_details]:border-l [&_details]:border-border/70 md:[&_details]:ml-4" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 bg-card/45 px-3 hover:bg-accent/50 [&::-webkit-details-marker]:hidden">
        <span className="h-0 w-0 border-y-[5px] border-l-[6px] border-y-transparent border-l-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground">{group.name}</span>
        <span className="min-w-0 truncate text-sm text-muted-foreground">{group.path}</span>
        <span className="flex-1" />
        <Badge variant="secondary">{group.total}</Badge>
        {stale > 0 && <Badge variant="warning">{stale} stale</Badge>}
      </summary>

      <div className="border-t border-border/50 bg-background/45">
        {group.children.map(child => (
          <NTGroupNode key={child.path} group={child} now={now} depth={depth + 1} forceOpen={forceOpen} />
        ))}
        {group.topics.map(topic => (
          <NTTopicRow key={`${group.path}/${topic.key}`} topic={topic} now={now} />
        ))}
      </div>
    </details>
  );
}

export default function NTViewerPage() {
  const connected = useNTConnected();
  const prefix = '/3544';
  const topics = useNTPrefix(prefix);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const typeOptions = useMemo(() => {
    return [...new Set(topics.map(topic => topic.type).filter(Boolean))].sort();
  }, [topics]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topics.filter(topic => {
      const matchesType = typeFilter === 'all' || topic.type === typeFilter;
      const matchesQuery = !q || topic.key.toLowerCase().includes(q) || formatValue(topic.value).toLowerCase().includes(q);
      return matchesType && matchesQuery;
    });
  }, [query, topics, typeFilter]);

  const groups = useMemo(() => buildGroups(filtered, prefix), [filtered]);
  const staleCount = topics.filter(topic => !topic.online).length;
  const forceOpen = query.trim().length > 0 || typeFilter !== 'all';

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Connection" value={connected ? 'Connected' : 'Offline'} tone={connected ? 'success' : 'destructive'} />
        <StatCard label="Topics" value={topics.length} />
        <StatCard label="Visible" value={filtered.length} />
        <StatCard label="Stale" value={staleCount} tone={staleCount > 0 ? 'warning' : 'success'} />
      </div>

      <Card title="NetworkTables Live Viewer" wide>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input
            className="w-full md:max-w-xl"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search keys or values"
          />
          <select
            className="h-9 min-w-36 rounded-md border border-input bg-background/70 px-3 py-1 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={typeFilter}
            onChange={event => setTypeFilter(event.target.value)}
            aria-label="Filter NT topics by type"
          >
            <option value="all">All types</option>
            {typeOptions.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="hidden min-h-9 grid-cols-[minmax(240px,1.4fr)_130px_minmax(180px,1fr)_78px] items-center gap-3 rounded-t-xl border border-border border-b-0 bg-muted/70 px-3 text-sm font-semibold text-muted-foreground md:grid">
          <span>Entry</span>
          <span>Type</span>
          <span>Value</span>
          <span>Age</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState label="No topics found" />
        ) : (
          <div className="overflow-hidden rounded-xl rounded-t-none border border-border bg-background/50">
            {groups.map(group => (
              <NTGroupNode key={group.path} group={group} now={now} depth={0} forceOpen={forceOpen} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
