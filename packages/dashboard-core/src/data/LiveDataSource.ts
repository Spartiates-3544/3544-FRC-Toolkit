import type { DataSource } from './DataSource.js';
import { NTClient } from '../nt/NTClient.js';

export class LiveDataSource implements DataSource {
  readonly mode = 'live' as const;

  private client: NTClient;
  private snapshots = new Map<string, unknown>();

  constructor(client: NTClient) {
    this.client = client;
  }

  subscribe(key: string, callback: (value: unknown) => void): () => void {
    return this.client.subscribe(key, (value) => {
      this.snapshots.set(key, value);
      callback(value);
    });
  }

  getSnapshot(key: string): unknown {
    return this.snapshots.get(key);
  }
}
