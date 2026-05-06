import type { DataSource } from './DataSource.js';
import type { ReplayTimeline } from '../models/ReplayData.js';

type Callback = (value: unknown) => void;

export class ReplayDataSource implements DataSource {
  readonly mode = 'replay' as const;

  private timeline: ReplayTimeline;
  private currentTime: number;
  private playing = false;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private subscriptions = new Map<string, Set<Callback>>();
  private snapshots = new Map<string, unknown>();
  private nextFrameIndex = 0;

  constructor(timeline: ReplayTimeline) {
    this.timeline = {
      ...timeline,
      frames: [...timeline.frames].sort((a, b) => a.timestamp - b.timestamp),
    };
    this.currentTime = timeline.startTime;
  }

  subscribe(key: string, callback: Callback): () => void {
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(callback);
    return () => {
      this.subscriptions.get(key)?.delete(callback);
    };
  }

  getSnapshot(key: string): unknown {
    return this.snapshots.get(key);
  }

  seek(timestamp: number): void {
    this.currentTime = Math.max(
      this.timeline.startTime,
      Math.min(timestamp, this.timeline.endTime)
    );
    this.snapshots.clear();
    this.nextFrameIndex = 0;
    this.emitFramesUpTo(this.currentTime);
  }

  play(): void {
    if (this.playing) return;
    this.playing = true;
    const tickMs = 20;
    this.intervalHandle = setInterval(() => {
      this.currentTime += tickMs;
      this.emitFramesUpTo(this.currentTime);
      if (this.currentTime >= this.timeline.endTime) {
        this.pause();
      }
    }, tickMs);
  }

  pause(): void {
    this.playing = false;
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private emitFramesUpTo(timestamp: number): void {
    while (this.nextFrameIndex < this.timeline.frames.length) {
      const frame = this.timeline.frames[this.nextFrameIndex];
      if (frame.timestamp > timestamp) break;
      this.snapshots.set(frame.key, frame.value);
      this.subscriptions.get(frame.key)?.forEach((cb) => cb(frame.value));
      this.nextFrameIndex++;
    }
  }
}
