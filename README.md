# 3544-FRC-Toolkit
Open-source FRC tooling monorepo for Team 3544.
This repository contains the tools used to prototype, tune, diagnose, simulate, log, and drive Team 3544 robots.
---
## Projects
### `apps/dashboard`
Vite + React dashboard used during matches, testing, simulation, and replay.
**Modules:**
- Driver dashboard
- Power diagnostics
- Simulation viewer
- NetworkTables live viewer
- Tunables panel
- Match replay
- Subsystem status
- Fault viewer
---
### `apps/code-generator`
Python + Qt app that generates FRC robot boilerplate.
**Generates:**
- Command-based subsystems
- State machines
- Constants files
- Tunable motor wrappers
- Simulation hooks
- Logging hooks
- Health checks
---
### `apps/robot-health`
Python + Qt diagnostic app for pit checks and robot validation.
**Checks:**
- Battery voltage
- CAN devices
- Motor faults
- Motor temperatures
- Current draw
- Encoders
- Gyro
- Vision
- Pneumatics
- Subsystem readiness
---
### `apps/subsystem-tuner`
Python + Qt app for tuning mechanisms.
**Supports:**
- Velocity PID
- Position PID
- Feedforward tuning
- Step response testing
- Motor templates
- Gear reductions
- CAD mass / inertia inputs
- Encoder configuration
- Starting PID recommendations
---
## Packages
### `packages/3544FRCLib`
Reusable Java library for WPILib robot code.
**Packages:**
- `nt`
- `logging`
- `health`
- `tuning`
- `math`
- `simulation`
- `commands`
- `state`
- `power`
**Example:**
```java
NTManager.logDouble("Shooter/TopRPM", shooter.getTopRPM());
RobotHealth.checkBattery();
RobotHealth.checkTalonFX("Shooter/TopMotor", topMotor);
```
⸻

## `packages/dashboard-core`

Shared TypeScript logic for the dashboard.

Includes:

* NetworkTables client wrapper
* NT schema
* Robot state model
* Replay data model
* Dashboard configuration system
* Live/replay data abstraction

⸻

## `packages/dashboard-ui`

Shared React UI components.

Includes:

* Cards
* Graphs
* Warnings
* Status badges
* Mechanism widgets
* Match timeline
* Fault panels
* Subsystem panels

⸻

## `packages/field-sim`

2D field and mechanism visualization package.

Shows:

* Robot pose
* Swerve modules
* Turret angle
* Shooter angle
* Intake state
* Robot path
* Vision targets
* Drive mode

⸻

## `packages/power-diagnostics`

Power analysis logic.

Tracks:

* Battery voltage sag
* Total current
* Current per motor
* Current per subsystem
* PDH/PDP channels
* Brownout risk
* Energy usage
* Current spikes

⸻

## `packages/replay-engine`

NetworkTables recording and replay engine.

Features:

* Record complete NT timelines
* Replay matches
* Scrub timeline
* Export logs
* Compare live vs replay
* Detect faults from replay

⸻

# Main Goal

Make the robot faster to develop, easier to debug, easier to tune, and more reliable at competition.

⸻

# Recommended Workflow

1. Generate subsystem boilerplate with code-generator
2. Add subsystem to robot code using 3544FRCLib
3. Tune the mechanism with subsystem-tuner
4. Validate the robot with robot-health
5. Drive and monitor with dashboard
6. Replay match data after testing or competition

⸻

# Suggested NT Key Structure

`/3544/Robot/Pose`
`/3544/Robot/Mode`
`/3544/Robot/Enabled`
`/3544/Robot/BatteryVoltage`
`/3544/Power/TotalCurrent`
`/3544/Power/TotalPower`
`/3544/Power/Channels/0/Current`
`/3544/Power/Subsystems/Shooter/Current`
`/3544/Health/Faults`
`/3544/Health/Warnings`
`/3544/Health/CAN/Utilization`
`/3544/Subsystems/Shooter/TopRPM`
`/3544/Subsystems/Shooter/TargetRPM`
`/3544/Subsystems/Shooter/Ready`
`/3544/Tunables/Shooter/kP`
`/3544/Tunables/Shooter/kV`
`/3544/Tunables/Shooter/TargetRPM`
`/3544/Simulation/TurretAngleDeg`
`/3544/Simulation/DriveMode`

⸻

## Development

# Dashboard

```powershell
cd apps/dashboard
npm install
npm run dev
```

# Python Apps

```powershell
cd apps/robot-health
python -m venv .venv
pip install -r requirements.txt
python main.py
```

# Java Library

Add packages/3544FRCLib as a local Gradle dependency in your robot project.

⸻

## Design Principles

* One source of truth for NT keys
* Fast robot loops
* No excessive allocations in periodic methods
* Live and replay use the same dashboard components
* All tools should work in real robot and simulation
* Generated code should be readable and easy to modify manually

