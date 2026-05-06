import { useEffect, useMemo, useState } from 'react';
import type { AnnounceMessageParams, NetworkTablesTypes } from 'ntcore-ts-client';
import { nt } from '../nt';
import { NT_ROOT } from '../dashboardContract';

export interface NTTopicSnapshot {
  key: string;
  type: string;
  value: NetworkTablesTypes | null;
  lastChangedMs: number;
  online: boolean;
}

export function useNTPrefix(prefix = NT_ROOT): NTTopicSnapshot[] {
  const [topics, setTopics] = useState<Map<string, NTTopicSnapshot>>(new Map());

  useEffect(() => {
    const topic = nt.createPrefixTopic(prefix);
    const subuid = topic.subscribe((value, params: AnnounceMessageParams) => {
      setTopics(prev => {
        const next = new Map(prev);
        next.set(params.name, {
          key: params.name,
          type: params.type,
          value,
          lastChangedMs: Date.now(),
          online: true,
        });
        return next;
      });
    }, { all: true, periodic: 0.1 });

    return () => topic.unsubscribe(subuid);
  }, [prefix]);

  return useMemo(
    () => [...topics.values()].sort((a, b) => a.key.localeCompare(b.key)),
    [topics],
  );
}
