import { useEffect, useState } from 'react';
import type { AnnounceMessageParams } from 'ntcore-ts-client';
import { nt } from '../nt';

export function useNTValue<T>(key: string, defaultValue: T): T {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    const topic = nt.createPrefixTopic(key);
    const subuid = topic.subscribe((v: unknown, params: AnnounceMessageParams) => {
      if (params.name === key && v !== null && v !== undefined) setValue(v as T);
    }, { all: true, periodic: 0.1 });
    return () => topic.unsubscribe(subuid);
  }, [key]);

  return value;
}

export function useNTConnected(): boolean {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const unsub = nt.addRobotConnectionListener(setConnected, true);
    return () => unsub();
  }, []);
  return connected;
}
