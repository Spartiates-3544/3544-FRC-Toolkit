import { useEffect, useMemo, useState } from 'react';
import { useNTValue } from '../hooks/useNTValue';
import { NT_KEYS } from '../nt';
import { parsePose, type RobotPose } from '../dashboardContract';
import { Badge, Card, Row, Grid } from '../components/ui';

const FIELD_LENGTH_M = 16.54;
const FIELD_WIDTH_M = 8.21;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function FieldPage() {
  const rawPose = useNTValue<number[] | string>(NT_KEYS.ROBOT_POSE, [0, 0, 0]);
  const turret = useNTValue<number>(NT_KEYS.SIM_TURRET_ANGLE, 0);
  const driveMode = useNTValue<string>(NT_KEYS.SIM_DRIVE_MODE, 'field-relative');
  const intake = useNTValue<string>(NT_KEYS.SIM_INTAKE_STATE, 'stowed');
  const [history, setHistory] = useState<RobotPose[]>([]);

  const pose = useMemo(() => parsePose(rawPose), [rawPose]);

  useEffect(() => {
    setHistory(prev => {
      const last = prev.at(-1);
      if (last && Math.hypot(last.x - pose.x, last.y - pose.y) < 0.03 && Math.abs(last.rotation - pose.rotation) < 1) {
        return prev;
      }
      return [...prev, pose].slice(-180);
    });
  }, [pose]);

  const x = clamp((pose.x / FIELD_LENGTH_M) * 100, 0, 100);
  const y = clamp((pose.y / FIELD_WIDTH_M) * 100, 0, 100);
  const path = history
    .map(p => `${clamp((p.x / FIELD_LENGTH_M) * 100, 0, 100)},${clamp((p.y / FIELD_WIDTH_M) * 100, 0, 100)}`)
    .join(' ');

  return (
    <Grid>
      <Card title="Field Simulation" wide>
        <div className="field-shell">
          <svg className="field-svg" viewBox="0 0 100 50" role="img" aria-label="Robot pose on FRC field">
            <rect className="field-bg" x="0" y="0" width="100" height="50" rx="1.5" />
            <line className="field-center-line" x1="50" x2="50" y1="0" y2="50" />
            <rect className="field-zone field-zone-blue" x="0" y="0" width="18" height="50" />
            <rect className="field-zone field-zone-red" x="82" y="0" width="18" height="50" />
            <g className="field-grid">
              {Array.from({ length: 9 }, (_, i) => <line key={`v-${i}`} x1={i * 12.5} x2={i * 12.5} y1="0" y2="50" />)}
              {Array.from({ length: 5 }, (_, i) => <line key={`h-${i}`} x1="0" x2="100" y1={i * 12.5} y2={i * 12.5} />)}
            </g>
            {history.length > 1 && <polyline className="field-path" points={path} />}
            <g transform={`translate(${x} ${y}) rotate(${pose.rotation})`}>
              <rect className="field-robot" x="-3.2" y="-2.5" width="6.4" height="5" rx="0.6" />
              <line className="field-heading" x1="0" y1="0" x2="5.4" y2="0" />
              <g transform={`rotate(${turret})`}>
                <line className="field-turret" x1="0" y1="0" x2="4.4" y2="0" />
                <circle className="field-turret-hub" cx="0" cy="0" r="0.8" />
              </g>
            </g>
          </svg>
        </div>
      </Card>

      <Card title="Pose">
        <Row label="X" value={`${pose.x.toFixed(2)} m`} />
        <Row label="Y" value={`${pose.y.toFixed(2)} m`} />
        <Row label="Heading" value={`${pose.rotation.toFixed(1)}°`} />
        <Row label="Turret" value={`${turret.toFixed(1)}°`} />
      </Card>

      <Card title="Mechanisms">
        <Row label="Drive Mode" value={driveMode} />
        <Row label="Intake" value={intake} />
        <div className="badge-strip">
          <Badge variant={driveMode.includes('field') ? 'success' : 'secondary'}>{driveMode}</Badge>
          <Badge variant={intake.includes('running') ? 'warning' : 'secondary'}>{intake}</Badge>
        </div>
      </Card>
    </Grid>
  );
}
