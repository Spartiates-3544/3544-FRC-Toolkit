import { useEffect, useState } from 'react';
import { NetworkTablesTypeInfos, type NetworkTablesTypeInfo, type NetworkTablesTypes } from 'ntcore-ts-client';
import { nt } from '../nt';

type NTValue = NetworkTablesTypes;

function typeInfoFor(defaultValue: NTValue): NetworkTablesTypeInfo {
  if (Array.isArray(defaultValue)) {
    if (defaultValue.length === 0 || typeof defaultValue[0] === 'string')
      return NetworkTablesTypeInfos.kStringArray;
    return NetworkTablesTypeInfos.kDoubleArray;
  }
  if (typeof defaultValue === 'boolean') return NetworkTablesTypeInfos.kBoolean;
  if (typeof defaultValue === 'number')  return NetworkTablesTypeInfos.kDouble;
  return NetworkTablesTypeInfos.kString;
}

export function useNTValue<T extends NTValue>(key: string, defaultValue: T): T {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    const topic = nt.createTopic<T>(key, typeInfoFor(defaultValue));
    topic.subscribe((v) => {
      if (v !== null && v !== undefined) setValue(v as T);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
