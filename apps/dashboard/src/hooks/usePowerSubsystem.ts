import { useNTValue } from './useNTValue';

export interface SubsystemPowerData {
  name: string;
  current: number;   // amps
  power: number;     // watts
  energy: number;    // joules cumulative
  motorNames: string[];
  motorCurrents: number[];
}

export function usePowerSubsystem(name: string): SubsystemPowerData {
  const base = `/3544/Power/Subsystems/${name}`;
  const current       = useNTValue<number>(`${base}/Current`, 0);
  const power         = useNTValue<number>(`${base}/Power`, 0);
  const energy        = useNTValue<number>(`${base}/Energy`, 0);
  const motorNames    = useNTValue<string[]>(`${base}/MotorNames`, []);
  const motorCurrents = useNTValue<number[]>(`${base}/MotorCurrents`, []);
  return { name, current, power, energy, motorNames, motorCurrents };
}
