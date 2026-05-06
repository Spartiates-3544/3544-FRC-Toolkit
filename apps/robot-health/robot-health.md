# apps/robot-health

Python + Qt diagnostic app for pit checks and robot validation before and during competition.

Connects to the robot over NetworkTables and runs a structured health check, flagging anything that needs attention.

## Stack

- Python
- Qt (PyQt / PySide)

## Checks Performed

| Check | Description |
|---|---|
| Battery voltage | Validates voltage is within safe operating range |
| CAN devices | Confirms all expected CAN devices are online |
| Motor faults | Reads and reports any sticky or active motor faults |
| Motor temperatures | Flags motors above thermal thresholds |
| Current draw | Checks for overcurrent conditions |
| Encoders | Validates encoder connectivity and plausibility |
| Gyro | Confirms gyro is connected and reading |
| Vision | Checks vision co-processor connectivity and target detection |
| Pneumatics | Validates pneumatic system pressure and solenoid states |
| Subsystem readiness | Confirms each subsystem reports as ready |

## Development

```powershell
cd apps/robot-health
python -m venv .venv
pip install -r requirements.txt
python main.py
```

## NT Keys Used

- `/3544/Health/Faults`
- `/3544/Health/Warnings`
- `/3544/Health/CAN/Utilization`
- `/3544/Robot/BatteryVoltage`
