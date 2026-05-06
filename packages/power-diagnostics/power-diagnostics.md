# packages/power-diagnostics

Power analysis logic for monitoring robot electrical health.

Used by the power diagnostics module in `apps/dashboard` and by `packages/3544FRCLib` on the robot side.

## Stack

- TypeScript

## What It Tracks

| Metric | Description |
|---|---|
| Battery voltage sag | Voltage drop under load over time |
| Total current | Sum of all motor and system current draw |
| Current per motor | Per-motor current readings |
| Current per subsystem | Aggregated current grouped by subsystem |
| PDH/PDP channels | Raw channel current readings from the Power Distribution Hub |
| Brownout risk | Estimated risk of triggering brownout protection |
| Energy usage | Cumulative energy consumed during a match |
| Current spikes | Detection and flagging of transient overcurrent events |

## NT Keys Used

- `/3544/Power/TotalCurrent`
- `/3544/Power/TotalPower`
- `/3544/Power/SubsystemNames`
- `/3544/Power/Battery/Voltage`
- `/3544/Power/Battery/TotalCurrent`
- `/3544/Power/Battery/TotalPower`
- `/3544/Power/Subsystems/<Subsystem>/Current`
- `/3544/Power/Subsystems/<Subsystem>/Power`
- `/3544/Power/Subsystems/<Subsystem>/Energy`
- `/3544/Power/Subsystems/<Subsystem>/MotorNames`
- `/3544/Power/Subsystems/<Subsystem>/MotorCurrents`
- `/3544/Robot/BatteryVoltage`

## Current Status

The first live power diagnostics UI is implemented directly in `apps/dashboard`, and reusable robot-side publishers exist in `packages/3544FRCLib`. This package remains the future extraction point for standalone analysis logic.
