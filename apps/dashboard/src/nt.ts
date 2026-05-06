import { NetworkTables } from 'ntcore-ts-client';
export { NT_KEYS, NT_ROOT } from './dashboardContract';

// WPILib simulation NT4 server — change to robot IP for real robot (e.g. 10.35.44.2)
export const nt = NetworkTables.getInstanceByURI('localhost', 5810);
