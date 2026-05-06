import { useNTValue, useNTConnected } from '../hooks/useNTValue';
import { NT_KEYS } from '../nt';
import { splitNTList } from '../dashboardContract';
import { Badge, Card, Row, Grid } from '../components/ui';

export default function OverviewPage() {
  const connected = useNTConnected();
  const mode    = useNTValue<string>(NT_KEYS.ROBOT_MODE, 'disabled');
  const enabled = useNTValue<boolean>(NT_KEYS.ROBOT_ENABLED, false);
  const battery = useNTValue<number>(NT_KEYS.ROBOT_BATTERY, 0);
  const current = useNTValue<number>(NT_KEYS.POWER_CURRENT, 0);
  const power   = useNTValue<number>(NT_KEYS.POWER_POWER, 0);
  const canUtil = useNTValue<number>(NT_KEYS.HEALTH_CAN_UTILIZATION, 0);
  const faults  = useNTValue<string>(NT_KEYS.HEALTH_FAULTS, '');
  const warnings = useNTValue<string>(NT_KEYS.HEALTH_WARNINGS, '');
  const rpm     = useNTValue<number>(NT_KEYS.SHOOTER_RPM, 0);
  const target  = useNTValue<number>(NT_KEYS.SHOOTER_TARGET, 0);
  const ready   = useNTValue<boolean>(NT_KEYS.SHOOTER_READY, false);
  const subsystems = useNTValue<string[]>(NT_KEYS.SUBSYSTEM_NAMES, []);

  const batteryColor = battery < 11.5 ? '#ef4444' : battery < 12.2 ? '#f59e0b' : '#22c55e';
  const canColor     = canUtil > 0.8 ? '#ef4444' : canUtil > 0.5 ? '#f59e0b' : '#22c55e';
  const faultList    = splitNTList(faults);
  const warningList  = splitNTList(warnings);
  const rpmError     = target - rpm;

  return (
    <Grid>
      <Card title="Robot">
        <Row label="Connection" value={connected ? 'Connected' : 'Disconnected'} color={connected ? '#22c55e' : '#ef4444'} />
        <Row label="Mode"       value={mode} />
        <Row label="Enabled"    value={enabled ? 'Yes' : 'No'} color={enabled ? '#22c55e' : '#ef4444'} />
        <Row label="Battery"    value={`${battery.toFixed(2)} V`} color={batteryColor} />
      </Card>

      <Card title="Power">
        <Row label="Total Current" value={`${current.toFixed(1)} A`} />
        <Row label="Total Power"   value={`${power.toFixed(1)} W`} />
        <Row label="CAN Bus"       value={`${(canUtil * 100).toFixed(1)} %`} color={canColor} />
      </Card>

      <Card title="Shooter">
        <Row label="RPM"   value={rpm.toFixed(0)} />
        <Row label="Target" value={target.toFixed(0)} />
        <Row label="Error" value={`${rpmError.toFixed(0)} RPM`} color={ready ? '#22c55e' : '#f59e0b'} />
        <Row label="Ready" value={ready ? 'Yes' : 'No'} color={ready ? '#22c55e' : '#f59e0b'} />
      </Card>

      <Card title="Health">
        <div className="badge-strip">
          <Badge variant={faultList.length ? 'destructive' : 'success'}>{faultList.length} faults</Badge>
          <Badge variant={warningList.length ? 'warning' : 'success'}>{warningList.length} warnings</Badge>
          <Badge variant="secondary">{subsystems.length} subsystems</Badge>
        </div>
        {faultList.length ? (
          faultList.map((f, i) => (
            <div key={i} className="entry-list-item entry-list-item-danger">! {f}</div>
          ))
        ) : (
          <div className="entry-list-item entry-list-item-success">No active faults</div>
        )}
      </Card>
    </Grid>
  );
}
