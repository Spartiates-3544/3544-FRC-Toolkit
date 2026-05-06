# 3544-FRC-Toolkit

Open-source FRC tooling monorepo for Team 3544.

Tools to prototype, tune, diagnose, simulate, log, and drive Team 3544 robots.

**Goal:** Make the robot faster to develop, easier to debug, easier to tune, and more reliable at competition.

---

## Repository Structure

```
3544-FRC-Toolkit/
├── apps/
│   ├── dashboard/          Vite + React match/sim/replay dashboard
│   ├── code-generator/     Python + Qt boilerplate generator
│   ├── robot-health/       Python + Qt pit diagnostic app
│   └── subsystem-tuner/    Python + Qt live mechanism tuner
└── packages/
    ├── 3544FRCLib/         Java WPILib library (robot-side)
    ├── dashboard-core/     Shared TS logic (NT client, models)
    ├── dashboard-ui/       Shared React components
    ├── field-sim/          2D field & mechanism visualization
    ├── power-diagnostics/  Power and current analysis logic
    └── replay-engine/      NT recording and replay engine
```

Each part has its own `README.md` with full details.

---

## Current Status

The live-first dashboard path is implemented and wired to the sample robot simulation.

| Part | Status |
|---|---|
| `apps/dashboard` | Live React dashboard with overview, power, subsystems, tunables, health/faults, field simulation, NT live viewer, and replay JSON import |
| `robot` | WPILib sample robot publishes the `/3544/` dashboard contract in simulation |
| `packages/3544FRCLib` | Reusable NT, health, tunable metadata, dashboard publishing, and power publishing helpers |
| `packages/dashboard-core` | Shared NT key schema, robot/replay models, and live/replay data source interfaces |
| `packages/field-sim` | Field visualization is currently implemented inside `apps/dashboard`; package remains the future extraction target |
| `packages/replay-engine` | Replay model/import path exists; full recording/export engine is still future work |
| `packages/power-diagnostics` | Live power dashboard is implemented in `apps/dashboard`; package remains the future extraction target |
| Python apps | Markdown specs exist; implementation is still future work |

---

## Dependency Map

Understanding what depends on what tells you what to build first.

### Package dependencies (build these before the apps that need them)

```
packages/3544FRCLib       — no internal dependencies (robot-side Java)

packages/dashboard-core   — no internal dependencies
packages/replay-engine    — depends on: dashboard-core
packages/power-diagnostics — depends on: dashboard-core
packages/field-sim        — depends on: dashboard-core

packages/dashboard-ui     — depends on: dashboard-core

apps/dashboard            — depends on: dashboard-core
                                         dashboard-ui
                                         field-sim
                                         power-diagnostics
                                         replay-engine

apps/code-generator       — no internal dependencies (standalone Python app)
apps/robot-health         — no internal dependencies (standalone Python app)
apps/subsystem-tuner      — no internal dependencies (standalone Python app)
```

### Visual dependency graph

```
dashboard-core ──┬──▶ replay-engine ────────┐
                 ├──▶ power-diagnostics ─────┤
                 ├──▶ field-sim ─────────────┤──▶ apps/dashboard
                 └──▶ dashboard-ui ──────────┘

3544FRCLib        ──▶ (robot project, not this monorepo)

code-generator    ──▶ (standalone)
robot-health      ──▶ (standalone)
subsystem-tuner   ──▶ (standalone)
```

---

## Build Order

If you are setting up the full monorepo from scratch, follow this order:

### Step 1 — Core TypeScript foundation
Build `packages/dashboard-core` first. Everything else in the TS stack depends on it.

### Step 2 — TS packages (can be built in parallel after step 1)
- `packages/replay-engine`
- `packages/power-diagnostics`
- `packages/field-sim`
- `packages/dashboard-ui`

### Step 3 — Dashboard app
Build `apps/dashboard` after all packages are ready.

### Step 4 — Java library (independent, any time)
`packages/3544FRCLib` is a self-contained Gradle project. Build and link it to your robot project independently of the TS stack.

### Step 5 — Python apps (independent, any time)
`apps/code-generator`, `apps/robot-health`, and `apps/subsystem-tuner` are standalone Python apps with no dependencies on the rest of this monorepo.

---

## Development Setup

### Live Robot Simulation + Dashboard

Run the robot simulation and dashboard in two terminals.

Terminal 1:

```bash
cd robot
./gradlew simulateJava
```

Terminal 2:

```bash
cd apps/dashboard
npm install
npm run dev
```

Open the Vite URL printed by `npm run dev`, usually `http://localhost:3000`. The dashboard connects to the NT4 server at `localhost:5810`.

### Dashboard (Vite + React)

```bash
cd apps/dashboard
npm install
npm run dev
```

### Python Apps

All three Python apps follow the same pattern:

```bash
cd apps/<app-name>   # code-generator | robot-health | subsystem-tuner
python -m venv .venv
pip install -r requirements.txt
python main.py
```

### Java Library

Add `packages/3544FRCLib` as a local Gradle dependency in your robot project:

```gradle
implementation project(':packages:3544FRCLib')
```

---

## Recommended Workflow (Robot Development Cycle)

1. **Generate** subsystem boilerplate with `apps/code-generator`
2. **Integrate** the subsystem into robot code using `packages/3544FRCLib`
3. **Tune** the mechanism live with `apps/subsystem-tuner`
4. **Validate** the robot before matches with `apps/robot-health`
5. **Monitor** during driving and testing with `apps/dashboard`
6. **Replay** match data afterward to diagnose issues

---

## What Is Next

- Extract the app-local field, replay, and power logic into their package directories when those packages need to be consumed outside `apps/dashboard`.
- Implement full replay recording/export once live dashboard workflows are stable.
- Build out the Python apps from their current specs.
- Add automated TypeScript and Java tests once local `node`, `npm`, and a JDK with `javac` are available.

---

## NT Key Conventions

All NetworkTables keys are published under `/3544/` to avoid collisions with WPILib defaults.

```
/3544/Robot/Pose
/3544/Robot/Mode
/3544/Robot/Enabled
/3544/Robot/BatteryVoltage
/3544/Power/TotalCurrent
/3544/Power/TotalPower
/3544/Power/SubsystemNames
/3544/Power/Battery/Voltage
/3544/Power/Battery/TotalCurrent
/3544/Power/Battery/TotalPower
/3544/Power/Subsystems/<Subsystem>/Current
/3544/Power/Subsystems/<Subsystem>/Power
/3544/Power/Subsystems/<Subsystem>/Energy
/3544/Health/Faults
/3544/Health/Warnings
/3544/Health/CAN/Utilization
/3544/Health/Status
/3544/Subsystems/Names
/3544/Subsystems/Shooter/TopRPM
/3544/Subsystems/Shooter/TargetRPM
/3544/Subsystems/Shooter/Ready
/3544/Tunables/Names
/3544/Tunables/Shooter/kP
/3544/Tunables/Shooter/kV
/3544/Tunables/Shooter/TargetRPM
/3544/Simulation/TurretAngleDeg
/3544/Simulation/DriveMode
/3544/Simulation/IntakeState
```

---

## Design Principles

- One source of truth for NT keys
- Fast robot loops — no excessive allocations in periodic methods
- Live and replay use the same dashboard components
- All tools work with real robot and simulation
- Generated code is readable and easy to modify manually
