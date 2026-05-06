export interface DataSource {
  subscribe(key: string, callback: (value: unknown) => void): () => void;
  getSnapshot(key: string): unknown;
  readonly mode: 'live' | 'replay';
}
