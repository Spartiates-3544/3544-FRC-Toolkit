import { useNTValue } from '../hooks/useNTValue';
import { NT_KEYS } from '../nt';
import { parseJsonArray, type SubsystemStatus } from '../dashboardContract';
import { Badge, Card, Row, ProgressBar, Grid, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui';

export default function SubsystemsPage() {
  const rpm       = useNTValue<number>(NT_KEYS.SHOOTER_RPM, 0);
  const targetRpm = useNTValue<number>(NT_KEYS.SHOOTER_TARGET, 0);
  const ready     = useNTValue<boolean>(NT_KEYS.SHOOTER_READY, false);
  const turret    = useNTValue<number>(NT_KEYS.SIM_TURRET_ANGLE, 0);
  const driveMode = useNTValue<string>(NT_KEYS.SIM_DRIVE_MODE, '—');
  const intake    = useNTValue<string>(NT_KEYS.SIM_INTAKE_STATE, 'stowed');
  const statusJson = useNTValue<string>(NT_KEYS.HEALTH_STATUS, '[]');
  const statuses = parseJsonArray<SubsystemStatus>(statusJson, []);

  const rpmRatio  = targetRpm > 0 ? rpm / targetRpm : 0;
  const rpmColor  = ready ? '#22c55e' : rpmRatio > 0.8 ? '#f59e0b' : '#3b82f6';

  return (
    <Grid>
      <Card title="Shooter">
        <Row label="RPM"        value={rpm.toFixed(0)} color={rpmColor} />
        <Row label="Target RPM" value={targetRpm.toFixed(0)} />
        <Row label="Error"      value={`${(targetRpm - rpm).toFixed(0)} RPM`} color={ready ? '#22c55e' : '#f59e0b'} />
        <Row label="Ready"      value={ready ? 'Yes' : 'No'} color={ready ? '#22c55e' : '#f59e0b'} />
        <ProgressBar ratio={rpmRatio} color={rpmColor} />
      </Card>

      <Card title="Drive">
        <Row label="Drive Mode"   value={driveMode} />
        <Row label="Turret Angle" value={`${turret.toFixed(1)}°`} />
        <Row label="Intake" value={intake} />
      </Card>

      <Card title="All Subsystems" wide>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
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
      </Card>
    </Grid>
  );
}
