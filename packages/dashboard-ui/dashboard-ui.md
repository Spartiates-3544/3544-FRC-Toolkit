# packages/dashboard-ui

Shared React UI component library for the dashboard.

Consumed by `apps/dashboard`. Built on top of `packages/dashboard-core` for data.

## Stack

- React
- TypeScript

## Components

| Component | Description |
|---|---|
| Cards | Generic data card containers |
| Graphs | Time-series and bar graph displays |
| Warnings | Warning and alert banner components |
| Status badges | Colored pass/warn/fault indicators |
| Mechanism widgets | Visual representations of mechanism states |
| Match timeline | Scrubable match timeline bar |
| Fault panels | Structured fault and warning list views |
| Subsystem panels | Per-subsystem status and data panels |

## Usage

Import components directly:

```tsx
import { StatusBadge, FaultPanel, MatchTimeline } from '@3544/dashboard-ui';
```
