# packages/3544FRCLib

Reusable Java library for WPILib robot code. The shared foundation used across all Team 3544 robot projects.

## Stack

- Java
- WPILib
- Gradle

## Packages

| Package | Description |
|---|---|
| `nt` | NetworkTables helpers and `NTManager` for structured key logging |
| `dashboard` | Reusable publishers for the Team 3544 dashboard NT contract |
| `logging` | Robot-side logging utilities |
| `health` | `RobotHealth` checks for battery, CAN, motors, and more |
| `tuning` | Tunable wrappers that sync gains live over NT |
| `math` | Common FRC math utilities |
| `simulation` | Sim-mode hooks and physics models |
| `commands` | Reusable WPILib command building blocks |
| `state` | State machine base classes |
| `power` | Power and current monitoring helpers |

## Current Status

The library includes working helpers for:

- publishing structured `/3544/` dashboard state
- publishing subsystem readiness metadata
- registering tunable metadata for dashboard discovery
- publishing robot health faults, warnings, battery, and CAN utilization
- publishing total and subsystem-level power data

## Usage

```java
// Log a subsystem value
NTManager.logDouble("Shooter/TopRPM", shooter.getTopRPM());

// Run a battery health check
RobotHealth.checkBattery();

// Check a TalonFX motor
RobotHealth.checkTalonFX("Shooter/TopMotor", topMotor);
```

## Setup

Add `packages/3544FRCLib` as a local Gradle dependency in your robot project:

```gradle
implementation project(':packages:3544FRCLib')
```

## NT Key Conventions

All keys are published under `/3544/` to avoid collisions with WPILib defaults.
