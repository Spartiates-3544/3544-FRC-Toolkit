# packages/replay-engine

NetworkTables recording and replay engine.

Records complete NT timelines during matches or testing, then replays them through the same dashboard components used for live data.

## Stack

- TypeScript

## Features

| Feature | Description |
|---|---|
| Record complete NT timelines | Future work |
| Replay matches | Lightweight JSON import exists in `apps/dashboard`; full engine playback is future work |
| Scrub timeline | Implemented for imported dashboard replay JSON |
| Export logs | Future work |
| Compare live vs replay | Future work |
| Detect faults from replay | Future work |

## Current Status

The dashboard can import and scrub replay-shaped JSON. Recording, export, comparison, and replay health analysis are intentionally deferred until the live dashboard workflow is stable.

## Usage

The replay engine implements the same data interface as the live NT client (from `packages/dashboard-core`), so all dashboard components work without modification in replay mode.

## Related

- `packages/dashboard-core` — defines the live/replay abstraction layer
- `apps/dashboard` — Match replay module consumes this package
