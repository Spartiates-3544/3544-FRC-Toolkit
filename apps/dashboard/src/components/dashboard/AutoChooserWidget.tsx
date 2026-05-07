import { NetworkTablesTypeInfos } from 'ntcore-ts-client';
import { Button } from '../ui';
import { useNTPrefix } from '../../hooks/useNTPrefix';
import { nt } from '../../nt';

const AUTO_CHOOSER_PATH = '/SmartDashboard/Auto Chooser';

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function AutoChooserWidget() {
  const topics = useNTPrefix(AUTO_CHOOSER_PATH);
  const byLeaf = new Map(topics.map(topic => [topic.key.split('/').at(-1) ?? topic.key, topic]));
  const options = stringArrayValue(byLeaf.get('options')?.value);
  const selected = stringValue(byLeaf.get('selected')?.value);
  const active = stringValue(byLeaf.get('active')?.value);
  const defaultAuto = stringValue(byLeaf.get('default')?.value);

  function chooseAuto(name: string) {
    const topic = nt.createTopic<string>(`${AUTO_CHOOSER_PATH}/selected`, NetworkTablesTypeInfos.kString);
    topic.publish().then(() => topic.setValue(name));
  }

  if (!options.length) {
    return <div className="grid h-full min-h-16 place-items-center text-center text-xs font-medium text-muted-foreground">Auto chooser not live</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-1.5">
      {options.map(option => (
        <Button
          key={option}
          type="button"
          size="sm"
          className="h-8 justify-start px-2 text-xs"
          variant={option === selected || option === active ? 'default' : 'outline'}
          onClick={() => chooseAuto(option)}
        >
          {option || defaultAuto || 'Default'}
        </Button>
      ))}
    </div>
  );
}
