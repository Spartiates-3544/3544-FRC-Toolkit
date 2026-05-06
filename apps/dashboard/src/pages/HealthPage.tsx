import { useNTValue } from '../hooks/useNTValue';
import { NT_KEYS } from '../nt';
import { parseJsonArray, splitNTList, type SubsystemStatus } from '../dashboardContract';
import { Badge, Card, Row, Grid, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui';

function EntryList({ items, color, emptyLabel }: { items: string[]; color: string; emptyLabel: string }) {
  if (items.length === 0) return <div className="entry-list-item entry-list-item-success">{emptyLabel}</div>;
  return (
    <div className="entry-list">
      {items.map((item, i) => (
        <div key={i} className="entry-list-item" style={{ color }}>
          {item}
        </div>
      ))}
    </div>
  );
}

export default function HealthPage() {
  const faults   = useNTValue<string>(NT_KEYS.HEALTH_FAULTS, '');
  const warnings = useNTValue<string>(NT_KEYS.HEALTH_WARNINGS, '');
  const canUtil  = useNTValue<number>(NT_KEYS.HEALTH_CAN_UTILIZATION, 0);
  const battery  = useNTValue<number>(NT_KEYS.ROBOT_BATTERY, 0);
  const statusJson = useNTValue<string>(NT_KEYS.HEALTH_STATUS, '[]');
  const subsystemNames = useNTValue<string[]>(NT_KEYS.SUBSYSTEM_NAMES, []);

  const faultList   = splitNTList(faults);
  const warningList = splitNTList(warnings);
  const statuses = parseJsonArray<SubsystemStatus>(statusJson, []);

  const canColor     = canUtil > 0.8 ? '#ef4444' : canUtil > 0.5 ? '#f59e0b' : '#22c55e';
  const batteryColor = battery < 11.5 ? '#ef4444' : battery < 12.2 ? '#f59e0b' : '#22c55e';

  return (
    <Grid>
      <Card title={`Faults${faultList.length > 0 ? ` (${faultList.length})` : ''}`} wide>
        <EntryList items={faultList} color="#ef4444" emptyLabel="No active faults" />
      </Card>

      <Card title={`Warnings${warningList.length > 0 ? ` (${warningList.length})` : ''}`} wide>
        <EntryList items={warningList} color="#f59e0b" emptyLabel="No active warnings" />
      </Card>

      <Card title="System">
        <Row label="Battery"        value={`${battery.toFixed(3)} V`} color={batteryColor} />
        <Row label="CAN Utilization" value={`${(canUtil * 100).toFixed(1)} %`} color={canColor} />
        <Row label="Known Subsystems" value={`${subsystemNames.length}`} />
        <div className="badge-strip">
          <Badge variant={faultList.length ? 'destructive' : 'success'}>{faultList.length} faults</Badge>
          <Badge variant={warningList.length ? 'warning' : 'success'}>{warningList.length} warnings</Badge>
        </div>
      </Card>

      <Card title="Subsystem Readiness" wide>
        {statuses.length === 0 ? (
          <div className="entry-list-item">Waiting for subsystem status</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subsystem</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Ready</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statuses.map(status => (
                <TableRow key={status.name}>
                  <TableCell>{status.name}</TableCell>
                  <TableCell className="ui-table-cell-muted">{status.state}</TableCell>
                  <TableCell>
                    <Badge variant={status.ready ? 'success' : 'warning'}>{status.ready ? 'Ready' : 'Not ready'}</Badge>
                  </TableCell>
                  <TableCell className="ui-table-cell-muted">{status.detail ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </Grid>
  );
}
