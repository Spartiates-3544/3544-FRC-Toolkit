// NOTE: Verify the actual package name before installing.
// The import below uses '@wpilibsuite/ntcore-ts-client' — confirm on npm or the WPILib GitHub.
import { NetworkTables, NetworkTablesTypeInfos } from '@wpilibsuite/ntcore-ts-client';

type Callback = (value: unknown) => void;

export class NTClient {
  private nt: ReturnType<typeof NetworkTables.getInstanceByURI> | null = null;
  private subscriptions = new Map<string, Set<Callback>>();
  private connected = false;

  connect(serverUrl: string): void {
    this.nt = NetworkTables.getInstanceByURI(serverUrl);
    this.nt.addRobotConnectionListener((connected) => {
      this.connected = connected;
    }, true);
  }

  disconnect(): void {
    // ntcore-ts-client does not expose an explicit disconnect; drop the reference.
    this.nt = null;
    this.connected = false;
    this.subscriptions.clear();
  }

  subscribe(key: string, callback: Callback): () => void {
    if (!this.nt) throw new Error('NTClient not connected');

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(callback);

    const topic = this.nt.createTopic<unknown>(key, NetworkTablesTypeInfos.kUnassigned);
    topic.subscribe((value) => {
      if (value !== null && value !== undefined) {
        this.subscriptions.get(key)?.forEach((cb) => cb(value));
      }
    }, true);

    return () => {
      this.subscriptions.get(key)?.delete(callback);
    };
  }

  publish(key: string, value: unknown): void {
    if (!this.nt) throw new Error('NTClient not connected');
    const topic = this.nt.createTopic<unknown>(key, NetworkTablesTypeInfos.kUnassigned);
    topic.publish();
    topic.setValue(value);
  }

  isConnected(): boolean {
    return this.connected;
  }
}
