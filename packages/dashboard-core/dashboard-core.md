# packages/dashboard-core

Shared TypeScript logic for the dashboard. Framework-agnostic — contains no React.

Used by `apps/dashboard` and any future dashboard surfaces.

## Stack

- TypeScript

## Contents

| Module | Description |
|---|---|
| NetworkTables client wrapper | Connects to the robot NT server and manages subscriptions |
| NT schema | Implemented type definitions for the live-first `/3544/` NT contract |
| Robot state model | Parsed, typed model of the robot's current state |
| Replay data model | Implemented data structures for imported match timelines |
| Dashboard configuration system | Layout and panel configuration persistence |
| Live/replay data abstraction | Implemented live/replay source interface and replay frame playback |

## Design Note

Live and replay mode use the same data abstraction layer so dashboard components work identically in both contexts.

## Current Status

The live/replay data contracts exist and are used by the dashboard. Full recording/export belongs in `packages/replay-engine` later.
