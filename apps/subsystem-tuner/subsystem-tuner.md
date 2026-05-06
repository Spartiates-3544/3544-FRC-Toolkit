# apps/subsystem-tuner

Python + Qt app for tuning robot mechanisms live.

Connects to the robot over NetworkTables and allows iterative tuning of PID and feedforward gains with real-time feedback.

## Stack

- Python
- Qt (PyQt / PySide)

## Features

| Feature | Description |
|---|---|
| Velocity PID | Tune kP/kI/kD for velocity control loops |
| Position PID | Tune kP/kI/kD for position control loops |
| Feedforward tuning | Tune kS/kV/kA feedforward terms |
| Step response testing | Send a step command and record the response |
| Motor templates | Pre-configured starting points for common motors |
| Gear reductions | Input gear ratio for accurate unit conversion |
| CAD mass / inertia inputs | Import physical parameters from CAD for feedforward estimation |
| Encoder configuration | Set encoder CPR, gear ratio, and unit scale |
| Starting PID recommendations | Suggest initial gains based on mechanism parameters |

## Development

```powershell
cd apps/subsystem-tuner
python -m venv .venv
pip install -r requirements.txt
python main.py
```

## NT Keys Used

- `/3544/Tunables/<Subsystem>/kP`
- `/3544/Tunables/<Subsystem>/kV`
- `/3544/Tunables/<Subsystem>/TargetRPM`
- `/3544/Subsystems/<Subsystem>/TopRPM`
- `/3544/Subsystems/<Subsystem>/TargetRPM`
- `/3544/Subsystems/<Subsystem>/Ready`
