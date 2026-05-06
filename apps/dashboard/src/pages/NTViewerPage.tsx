import { useEffect, useMemo, useState } from 'react';
import { useNTConnected } from '../hooks/useNTValue';
import { useNTPrefix } from '../hooks/useNTPrefix';
import { formatValue } from '../dashboardContract';
import { Badge, Card, EmptyState, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui';

export default function NTViewerPage() {
  const connected = useNTConnected();
  const topics = useNTPrefix('/3544');
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter(topic => topic.key.toLowerCase().includes(q) || formatValue(topic.value).toLowerCase().includes(q));
  }, [query, topics]);

  return (
    <div>
      <div className="stat-strip">
        <div className="stat-card">
          <span className="stat-label">Connection</span>
          <span className="stat-value" style={{ color: connected ? '#22c55e' : '#ef4444' }}>{connected ? 'Connected' : 'Offline'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Topics</span>
          <span className="stat-value">{topics.length}</span>
        </div>
      </div>

      <Card title="NetworkTables Live Viewer" wide>
        <Input
          className="nt-search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search keys or values"
        />
        {filtered.length === 0 ? (
          <EmptyState label="No topics found" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(topic => (
                <TableRow key={topic.key}>
                  <TableCell><Badge variant={topic.online ? 'success' : 'muted'}>{topic.online ? 'live' : 'stale'}</Badge></TableCell>
                  <TableCell>{topic.key}</TableCell>
                  <TableCell className="ui-table-cell-muted">{topic.type}</TableCell>
                  <TableCell className="ui-table-cell-muted">{formatValue(topic.value)}</TableCell>
                  <TableCell className="ui-table-cell-muted">{Math.max(0, (now - topic.lastChangedMs) / 1000).toFixed(1)} s</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
