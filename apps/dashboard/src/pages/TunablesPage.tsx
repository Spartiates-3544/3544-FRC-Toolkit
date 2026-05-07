import { useState } from 'react';
import { NetworkTablesTypeInfos } from 'ntcore-ts-client';
import { nt, NT_KEYS } from '../nt';
import { useNTValue } from '../hooks/useNTValue';
import { parseJsonArray, type TunableDefinition } from '../dashboardContract';
import { Card, Row, InputRow, Input, Button, Grid, EmptyState } from '../components/ui';

function publish(key: string, value: number) {
  const topic = nt.createTopic<number>(key, NetworkTablesTypeInfos.kDouble);
  topic.publish().then(() => topic.setValue(value));
}

function TunableRow({ label, ntKey, step = 0.001 }: { label: string; ntKey: string; step?: number }) {
  const live = useNTValue<number>(ntKey, 0);
  const [input, setInput] = useState('');

  return (
    <div style={{ marginBottom: '16px' }}>
      <Row label={label} value={live.toFixed(4)} />
      <InputRow>
        <Input
          type="number"
          step={step}
          placeholder={`current: ${live.toFixed(4)}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button onClick={() => {
          const v = parseFloat(input);
          if (!isNaN(v)) { publish(ntKey, v); setInput(''); }
        }}>
          Set
        </Button>
      </InputRow>
    </div>
  );
}

export default function TunablesPage() {
  const definitionsJson = useNTValue<string>(NT_KEYS.TUNABLE_NAMES, '[]');
  const definitions = parseJsonArray<TunableDefinition>(definitionsJson, []);
  const groups = definitions.reduce<Record<string, TunableDefinition[]>>((acc, item) => {
    acc[item.subsystem] ??= [];
    acc[item.subsystem].push(item);
    return acc;
  }, {});

  return (
    <Grid>
      {Object.entries(groups).map(([subsystem, items]) => (
        <Card key={subsystem} title={`${subsystem} Tunables`}>
          {items.map(item => (
            <TunableRow key={item.key} label={item.label} ntKey={item.key} step={item.step} />
          ))}
        </Card>
      ))}
      {definitions.length === 0 && <EmptyState label="Waiting for tunable metadata" />}
    </Grid>
  );
}
