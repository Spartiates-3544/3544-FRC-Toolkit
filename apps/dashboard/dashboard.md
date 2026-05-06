# apps/dashboard

Vite + React dashboard used during matches, testing, simulation, and replay.

## Stack

- Vite
- React
- TypeScript

## Modules

| Module | Description |
|---|---|
| Driver dashboard | Implemented as the Overview page for connection, mode, battery, power, shooter, and health summary |
| Power diagnostics | Implemented with subsystem energy summary, live timeline, and motor detail views |
| Simulation viewer | Implemented as a 2D field page with pose, path history, turret angle, drive mode, and intake state |
| NetworkTables live viewer | Implemented as a searchable `/3544/` topic browser with type, value, status, and update age |
| Tunables panel | Implemented with metadata-driven tunable discovery and live value setting |
| Match replay | Lightweight JSON replay import and scrubber implemented; recording/export is future work |
| Subsystem status | Implemented using `/3544/Health/Status` readiness metadata |
| Fault viewer | Implemented with structured fault/warning counts and subsystem readiness table |

## Current Status

The app is no longer only a scaffold. It is a live-first dashboard connected to the sample robot simulation and the shared `/3544/` NetworkTables contract.

## Development

Run the robot simulation in one terminal:

```bash
cd robot
./gradlew simulateJava
```

Run the dashboard in another terminal:

```bash
cd apps/dashboard
npm install
npm run dev
```

## Dependencies

- `packages/dashboard-core` — NT client, robot state model, replay data model
- `packages/dashboard-ui` — shared React components
- `packages/field-sim` — 2D field and mechanism visualization
- `packages/power-diagnostics` — power analysis logic
- `packages/replay-engine` — match recording and replay
