# packages/field-sim

2D field and mechanism visualization package.

Renders the robot's position and mechanism states on a top-down field view. Used in the simulation viewer and match replay modules of `apps/dashboard`.

## Stack

- TypeScript
- Canvas / SVG rendering

## Visualizations

| Element | Description |
|---|---|
| Robot pose | Robot position and heading on the field |
| Swerve modules | Individual wheel angles and speeds |
| Turret angle | Turret heading relative to robot |
| Shooter angle | Shooter pivot angle |
| Intake state | Intake deployed/retracted/running state |
| Robot path | Drawn path of the robot over time |
| Vision targets | Detected AprilTag or vision target overlays |
| Drive mode | Current drive mode indicator (field-relative, robot-relative, etc.) |

## NT Keys Used

- `/3544/Robot/Pose`
- `/3544/Robot/Mode`
- `/3544/Simulation/TurretAngleDeg`
- `/3544/Simulation/DriveMode`
- `/3544/Simulation/IntakeState`

## Current Status

The first field visualization is implemented directly in `apps/dashboard`. This package remains the future extraction point for reusable field and mechanism rendering.
