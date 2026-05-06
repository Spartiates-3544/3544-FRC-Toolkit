# apps/code-generator

Python + Qt app that generates FRC robot boilerplate.

Speeds up subsystem development by producing readable, standards-compliant code that can be modified manually after generation.

## Stack

- Python
- Qt (PyQt / PySide)

## What It Generates

| Output | Description |
|---|---|
| Command-based subsystems | WPILib Command-based skeleton with standard structure |
| State machines | Subsystem state machine scaffolding |
| Constants files | Typed constants class per subsystem |
| Tunable motor wrappers | Motors wired into the `3544FRCLib` tuning system |
| Simulation hooks | Sim-mode wiring for WPILib simulation |
| Logging hooks | NT logging calls via `NTManager` |
| Health checks | `RobotHealth` check registrations |

## Development

```powershell
cd apps/code-generator
python -m venv .venv
pip install -r requirements.txt
python main.py
```

## Design Note

Generated code should be readable and easy to modify manually — avoid generating code that requires re-running the generator to change.
