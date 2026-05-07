import { formatValue } from '../dashboardContract';
import { getTopicLeafName, useSubsystemSnapshots } from '../hooks/useSubsystemSnapshots';
import { Badge, Card, EmptyState, Grid, Row, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui';

export default function SubsystemsPage() {
  const subsystems = useSubsystemSnapshots();

  return (
    <Grid>
      {subsystems.map(subsystem => (
        <Card key={subsystem.name} title={subsystem.name}>
          <Row label="State" value={subsystem.state} />
          <Row
            label="Ready"
            value={subsystem.ready === null ? 'unknown' : subsystem.ready ? 'Yes' : 'No'}
            tone={subsystem.ready === null ? 'muted' : subsystem.ready ? 'success' : 'destructive'}
          />
          <Row label="Fault" value={subsystem.fault || 'none'} tone={subsystem.fault ? 'destructive' : 'success'} />
          <Row label="Warning" value={subsystem.warning || 'none'} tone={subsystem.warning ? 'warning' : 'success'} />
          <div className="mt-3 grid gap-1">
            {subsystem.topics
              .filter(topic => !['State', 'Ready', 'Fault', 'Warning'].includes(getTopicLeafName(topic.key)))
              .map(topic => (
                <div className="flex min-h-8 items-center justify-between gap-3 rounded-md border border-border/50 bg-background/35 px-2.5 py-1 text-sm" key={topic.key}>
                  <span className="min-w-0 truncate text-muted-foreground">{getTopicLeafName(topic.key)}</span>
                  {typeof topic.value === 'boolean'
                    ? <Badge variant={topic.value ? 'success' : 'destructive'}>{formatValue(topic.value)}</Badge>
                    : <strong className="min-w-0 truncate text-right text-foreground">{formatValue(topic.value)}</strong>}
                </div>
              ))}
          </div>
        </Card>
      ))}

      <Card title="All Subsystems" wide>
        {subsystems.length === 0 ? (
          <EmptyState label="Waiting for subsystem topics">
            Expected live topics under /3544/Subsystems.
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Ready</TableHead>
                <TableHead>Fault</TableHead>
                <TableHead>Warning</TableHead>
                <TableHead>Topics</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subsystems.map(subsystem => (
                <TableRow key={subsystem.name}>
                  <TableCell>{subsystem.name}</TableCell>
                  <TableCell className="text-muted-foreground">{subsystem.state}</TableCell>
                  <TableCell>
                    <Badge variant={subsystem.ready ? 'success' : subsystem.ready === false ? 'destructive' : 'muted'}>
                      {subsystem.ready === null ? 'unknown' : subsystem.ready ? 'Ready' : 'Not ready'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{subsystem.fault || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{subsystem.warning || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{subsystem.topics.length}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </Grid>
  );
}
