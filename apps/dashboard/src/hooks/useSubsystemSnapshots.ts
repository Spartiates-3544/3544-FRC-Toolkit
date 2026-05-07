import { useMemo } from 'react';
import { NT_ROOT, formatValue } from '../dashboardContract';
import { useNTPrefix, type NTTopicSnapshot } from './useNTPrefix';

export type SubsystemSnapshot = {
  name: string;
  path: string;
  topics: NTTopicSnapshot[];
  ready: boolean | null;
  state: string;
  fault: string;
  warning: string;
};

function leafName(key: string) {
  return key.split('/').filter(Boolean).at(-1) ?? key;
}

export function useSubsystemSnapshots(): SubsystemSnapshot[] {
  const topics = useNTPrefix(`${NT_ROOT}/Subsystems`);

  return useMemo(() => {
    const groups = new Map<string, NTTopicSnapshot[]>();

    for (const topic of topics) {
      const segments = topic.key.split('/').filter(Boolean);
      const rootIndex = segments.indexOf('Subsystems');
      const name = rootIndex >= 0 ? segments[rootIndex + 1] : undefined;
      const leaf = leafName(topic.key);

      if (!name || leaf === 'Names') continue;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name)!.push(topic);
    }

    return [...groups.entries()]
      .map(([name, subsystemTopics]) => {
        const byLeaf = new Map(subsystemTopics.map(topic => [leafName(topic.key), topic]));
        const readyValue = byLeaf.get('Ready')?.value;
        const state = formatValue(byLeaf.get('State')?.value ?? 'unknown');
        const fault = formatValue(byLeaf.get('Fault')?.value ?? '');
        const warning = formatValue(byLeaf.get('Warning')?.value ?? '');

        return {
          name,
          path: `${NT_ROOT}/Subsystems/${name}`,
          topics: subsystemTopics.sort((a, b) => leafName(a.key).localeCompare(leafName(b.key))),
          ready: typeof readyValue === 'boolean' ? readyValue : null,
          state,
          fault: fault === '-' ? '' : fault,
          warning: warning === '-' ? '' : warning,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [topics]);
}

export function getTopicLeafName(key: string) {
  return leafName(key);
}
