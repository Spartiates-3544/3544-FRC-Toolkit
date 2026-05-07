import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { NT_KEYS, NT_ROOT } from '../dashboardContract';
import { useNTPrefix, type NTTopicSnapshot } from '../hooks/useNTPrefix';
import { getTopicLeafName, useSubsystemSnapshots } from '../hooks/useSubsystemSnapshots';
import { Button, EmptyState, Input } from '../components/ui';
import { NTTopicCombobox } from '../components/dashboard/NTTopicCombobox';
import { FieldPoseWidget } from '../components/dashboard/FieldPoseWidget';
import { AutoChooserWidget } from '../components/dashboard/AutoChooserWidget';
import { MatchTimerWidget } from '../components/dashboard/MatchTimerWidget';
import { PathWidget } from '../components/dashboard/PathWidget';
import { SubsystemWidget } from '../components/dashboard/SubsystemWidget';
import { ValueWidget } from '../components/dashboard/ValueWidget';
import { WidgetShell } from '../components/dashboard/WidgetShell';
import {
  DASHBOARD_STORAGE_KEY,
  NO_TOPICS,
  snap,
  type DashboardWidget,
  type DashboardWidgetKind,
} from '../components/dashboard/types';

const toolbarSelectClass = 'h-7 min-w-32 rounded-lg border border-input bg-background/70 px-2 py-1 text-xs text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-35';
const configSelectClass = 'h-8 min-w-0 rounded-md border border-input bg-background/70 px-2 py-1 text-xs text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';
const configInputClass = 'h-8 min-w-0 text-xs';

function normalizeWidget(widget: DashboardWidget, index = 0): DashboardWidget {
  const legacyCell = widget.w <= 8 && widget.h <= 8;
  return {
    ...widget,
    x: snap(widget.x ?? 20 + (index % 5) * 40),
    y: snap(widget.y ?? 20 + (index % 5) * 40),
    w: snap(legacyCell ? widget.w * 160 : widget.w || 280),
    h: snap(legacyCell ? widget.h * 90 : widget.h || 180),
    z: widget.z ?? index + 1,
    display: widget.display ?? (widget.kind === 'value' ? 'large' : 'rows'),
  };
}

function readWidgets(): DashboardWidget[] | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(DASHBOARD_STORAGE_KEY) ?? 'null');
    return Array.isArray(parsed) ? parsed.map(normalizeWidget) as DashboardWidget[] : null;
  } catch {
    return null;
  }
}

function defaultWidgets(subsystems: string[]): DashboardWidget[] {
  return [
    {
      id: 'match:timer',
      title: 'Match Timer',
      kind: 'matchTimer',
      topicKeys: [NT_KEYS.ROBOT_MATCH_TIME],
      x: 20,
      y: 80,
      w: 260,
      h: 150,
      z: 1,
      fontSize: 56,
    },
    {
      id: 'field:pose',
      title: 'Field Pose',
      kind: 'field',
      topicKeys: [NT_KEYS.ROBOT_POSE],
      x: 300,
      y: 80,
      w: 520,
      h: 320,
      z: 2,
    },
    {
      id: 'auto:chooser',
      title: 'Auto Chooser',
      kind: 'autoChooser',
      x: 840,
      y: 80,
      w: 320,
      h: 220,
      z: 3,
    },
    ...subsystems.map((name, index) => ({
      id: `subsystem:${name}`,
      title: name,
      kind: 'subsystem' as const,
      subsystem: name,
      topicKeys: [],
      display: 'rows' as const,
      x: 20 + (index % 4) * 300,
      y: 420 + Math.floor(index / 4) * 220,
      w: 280,
      h: 200,
      z: index + 4,
    })),
  ];
}

export default function DashboardPage() {
  const topics = useNTPrefix(NT_ROOT);
  const subsystems = useSubsystemSnapshots();
  const subsystemNames = useMemo(() => subsystems.map(subsystem => subsystem.name), [subsystems]);
  const topicByKey = useMemo(() => new Map(topics.map(topic => [topic.key, topic])), [topics]);
  const [widgets, setWidgets] = useState<DashboardWidget[]>(() => readWidgets() ?? []);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedPath, setSelectedPath] = useState(`${NT_ROOT}/Power/Battery`);
  const [selectedSubsystem, setSelectedSubsystem] = useState('');
  const [newWidgetKind, setNewWidgetKind] = useState<DashboardWidgetKind>('value');
  const [configuringId, setConfiguringId] = useState<string | null>(null);

  useEffect(() => {
    setWidgets(current => {
      if (current.length > 0 || subsystemNames.length === 0) return current;
      return defaultWidgets(subsystemNames);
    });
  }, [subsystemNames]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(widgets));
  }, [widgets]);

  const selectableTopics = topics.filter(topic => !topic.key.endsWith('/Names'));

  const bringToFront = useCallback((id: string) => {
    setWidgets(current => {
      const maxZ = current.reduce((max, widget) => Math.max(max, widget.z), 1);
      return current.map(widget => widget.id === id ? { ...widget, z: maxZ + 1 } : widget);
    });
  }, []);

  const moveLive = useCallback((id: string, x: number, y: number) => {
    setWidgets(current => current.map(widget => widget.id === id ? { ...widget, x, y } : widget));
  }, []);

  const moveCommit = useCallback((id: string, x: number, y: number) => {
    setWidgets(current => current.map(widget => widget.id === id ? { ...widget, x: snap(x), y: snap(y) } : widget));
  }, []);

  const resizeLive = useCallback((id: string, w: number, h: number) => {
    setWidgets(current => current.map(widget => widget.id === id ? { ...widget, w, h } : widget));
  }, []);

  const resizeCommit = useCallback((id: string, w: number, h: number) => {
    setWidgets(current => current.map(widget => widget.id === id ? { ...widget, w: snap(w), h: snap(h) } : widget));
  }, []);

  const updateWidget = useCallback((id: string, patch: Partial<DashboardWidget>) => {
    setWidgets(current => current.map(widget => widget.id === id ? normalizeWidget({ ...widget, ...patch }) : widget));
  }, []);

  const removeWidget = useCallback((id: string) => {
    setWidgets(current => current.filter(widget => widget.id !== id));
    setConfiguringId(current => current === id ? null : current);
  }, []);

  function addWidget() {
    if (newWidgetKind === 'value' && !selectedTopic) return;
    if (newWidgetKind === 'path' && !selectedPath.trim()) return;
    if (newWidgetKind === 'subsystem' && !selectedSubsystem) return;
    if (newWidgetKind === 'field' && widgets.some(widget => widget.kind === 'field')) return;
    if (newWidgetKind === 'autoChooser' && widgets.some(widget => widget.kind === 'autoChooser')) return;

    const maxZ = widgets.reduce((max, widget) => Math.max(max, widget.z), 1);
    const offset = widgets.length % 8;
    const base = { x: snap(20 + offset * 40), y: snap(90 + offset * 32), z: maxZ + 1 };
    const topic = topicByKey.get(selectedTopic);
    const path = selectedPath.trim().startsWith('/') ? selectedPath.trim() : `/${selectedPath.trim()}`;

    const next: DashboardWidget =
      newWidgetKind === 'field'
        ? { id: `field:${Date.now()}`, title: 'Field Pose', kind: 'field', topicKeys: [NT_KEYS.ROBOT_POSE], w: 520, h: 320, ...base }
        : newWidgetKind === 'autoChooser'
          ? { id: `auto:${Date.now()}`, title: 'Auto Chooser', kind: 'autoChooser', w: 320, h: 220, ...base }
          : newWidgetKind === 'matchTimer'
            ? { id: `timer:${Date.now()}`, title: 'Match Timer', kind: 'matchTimer', topicKeys: [NT_KEYS.ROBOT_MATCH_TIME], w: 260, h: 150, fontSize: 56, ...base }
            : newWidgetKind === 'path'
              ? { id: `path:${path}:${Date.now()}`, title: path, kind: 'path', path, display: 'rows', w: 320, h: 260, ...base }
              : newWidgetKind === 'subsystem'
                ? { id: `subsystem:${selectedSubsystem}:${Date.now()}`, title: selectedSubsystem, kind: 'subsystem', subsystem: selectedSubsystem, topicKeys: [], display: 'rows', w: 280, h: 200, ...base }
                : { id: `value:${selectedTopic}:${Date.now()}`, title: topic ? getTopicLeafName(topic.key) : selectedTopic, kind: 'value', topicKeys: [selectedTopic], display: 'large', w: 220, h: 140, ...base };

    setWidgets(current => [...current, next]);
  }

  function resetWidgets() {
    setWidgets(defaultWidgets(subsystemNames));
    setConfiguringId(null);
  }

  function toggleSubsystemTopic(widget: DashboardWidget, key: string) {
    const subsystem = subsystems.find(item => item.name === widget.subsystem);
    const allKeys = subsystem?.topics.map(topic => getTopicLeafName(topic.key)) ?? [];
    const currentKeys = widget.topicKeys?.length ? widget.topicKeys.filter(item => item !== NO_TOPICS) : allKeys;
    const nextKeys = currentKeys.includes(key) ? currentKeys.filter(item => item !== key) : [...currentKeys, key];
    updateWidget(widget.id, { topicKeys: nextKeys.length ? nextKeys : [NO_TOPICS] });
  }

  function renderConfig(widget: DashboardWidget) {
    const subsystem = subsystems.find(item => item.name === widget.subsystem);

    return (
      <div className="mb-2 grid gap-2 rounded-lg border border-border/70 bg-background/85 p-2 shadow-sm">
        <Input className={configInputClass} value={widget.title} onChange={event => updateWidget(widget.id, { title: event.target.value })} aria-label="Widget title" />
        <div className="grid grid-cols-3 gap-2">
          <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
            W
            <Input className={configInputClass} type="number" min={180} max={900} step={20} value={widget.w} onChange={event => updateWidget(widget.id, { w: Number(event.target.value) })} />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
            H
            <Input className={configInputClass} type="number" min={120} max={720} step={20} value={widget.h} onChange={event => updateWidget(widget.id, { h: Number(event.target.value) })} />
          </label>
          {(widget.kind === 'value' || widget.kind === 'path') && (
            <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
              View
              <select className={configSelectClass} value={widget.display ?? 'large'} onChange={event => updateWidget(widget.id, { display: event.target.value as DashboardWidget['display'] })}>
                <option value="large">Large</option>
                <option value="rows">Rows</option>
              </select>
            </label>
          )}
        </div>
        {(widget.kind === 'value' || widget.kind === 'path' || widget.kind === 'subsystem') && (
          <div className="grid grid-cols-3 gap-2">
            <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
              Text px
              <Input className={`${configInputClass} p-0`} type="range" min={10} max={72} value={widget.fontSize ?? 14} onChange={event => updateWidget(widget.id, { fontSize: Number(event.target.value) })} />
            </label>
            <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
              Color
              <Input className={`${configInputClass} p-1`} type="color" value={widget.color ?? '#ffffff'} onChange={event => updateWidget(widget.id, { color: event.target.value })} />
            </label>
          </div>
        )}
        {widget.kind === 'value' && (
          <select className={configSelectClass} value={widget.topicKeys?.[0] ?? ''} onChange={event => updateWidget(widget.id, { topicKeys: [event.target.value], title: getTopicLeafName(event.target.value) })}>
            {selectableTopics.map(topic => <option key={topic.key} value={topic.key}>{topic.key}</option>)}
          </select>
        )}
        {widget.kind === 'path' && (
          <Input className={configInputClass} value={widget.path ?? ''} onChange={event => updateWidget(widget.id, { path: event.target.value, title: event.target.value })} aria-label="NetworkTables path" />
        )}
        {widget.kind === 'matchTimer' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
                Font
                <Input className={`${configInputClass} p-0`} type="range" min={24} max={120} value={widget.fontSize ?? 56} onChange={event => updateWidget(widget.id, { fontSize: Number(event.target.value) })} />
              </label>
              <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
                Low max
                <Input className={`${configInputClass} p-0`} type="range" min={0} max={150} value={widget.timerLowMax ?? 30} onChange={event => updateWidget(widget.id, { timerLowMax: Number(event.target.value) })} />
              </label>
              <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
                Mid max
                <Input className={`${configInputClass} p-0`} type="range" min={0} max={150} value={widget.timerMidMax ?? 50} onChange={event => updateWidget(widget.id, { timerMidMax: Number(event.target.value) })} />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
                Low
                <Input className={`${configInputClass} p-1`} type="color" value={widget.timerLowColor ?? '#2563eb'} onChange={event => updateWidget(widget.id, { timerLowColor: event.target.value })} />
              </label>
              <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
                Mid
                <Input className={`${configInputClass} p-1`} type="color" value={widget.timerMidColor ?? '#dc2626'} onChange={event => updateWidget(widget.id, { timerMidColor: event.target.value })} />
              </label>
              <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
                High
                <Input className={`${configInputClass} p-1`} type="color" value={widget.timerHighColor ?? '#3b82f6'} onChange={event => updateWidget(widget.id, { timerHighColor: event.target.value })} />
              </label>
            </div>
          </>
        )}
        {widget.kind === 'subsystem' && subsystem && (
          <div className="flex max-h-24 flex-wrap gap-1 overflow-auto">
            {subsystem.topics.map(topic => getTopicLeafName(topic.key)).map(key => (
              <label className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/50 px-2 py-1 text-xs text-muted-foreground" key={key}>
                <input type="checkbox" checked={!widget.topicKeys?.length || widget.topicKeys.includes(key)} onChange={() => toggleSubsystemTopic(widget, key)} />
                {key}
              </label>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderWidget(widget: DashboardWidget) {
    const subsystem = subsystems.find(item => item.name === widget.subsystem);
    const topicsForValue = (widget.topicKeys ?? [])
      .map(key => topicByKey.get(key))
      .filter((topic): topic is NTTopicSnapshot => Boolean(topic));

    const path = widget.path?.trim() ?? '';
    const normalizedPath = path && !path.startsWith('/') ? `/${path}` : path;
    const topicsForPath = topics.filter(topic => normalizedPath && topic.key.startsWith(normalizedPath));

    if (widget.kind === 'field') return <FieldPoseWidget topic={topicByKey.get(NT_KEYS.ROBOT_POSE)} />;
    if (widget.kind === 'autoChooser') return <AutoChooserWidget />;
    if (widget.kind === 'matchTimer') return <MatchTimerWidget widget={widget} topic={topicByKey.get(NT_KEYS.ROBOT_MATCH_TIME)} />;
    if (widget.kind === 'path') return <PathWidget widget={widget} topics={topicsForPath} />;
    if (widget.kind === 'subsystem') return <SubsystemWidget widget={widget} subsystem={subsystem} />;
    return <ValueWidget widget={widget} topics={topicsForValue} />;
  }

  return (
    <div className="relative min-h-[calc(100vh-var(--header-height)-88px)] overflow-hidden">
      <div className="absolute left-3 right-3 top-2 z-50 rounded-xl border border-border/70 bg-background/70 px-2 py-1.5 shadow-lg backdrop-blur-xl supports-[backdrop-filter]:bg-background/55">
        <div className="flex h-8 flex-nowrap items-center gap-1.5 overflow-x-auto">
          <span className="shrink-0 px-2 text-[11px] font-black uppercase tracking-wide text-muted-foreground">Add widget</span>
          <select className={toolbarSelectClass} value={newWidgetKind} onChange={event => setNewWidgetKind(event.target.value as DashboardWidgetKind)} aria-label="Widget type">
            <option value="value">NT value</option>
            <option value="path">NT path</option>
            <option value="subsystem">Subsystem</option>
            <option value="field">Field pose</option>
            <option value="autoChooser">Auto chooser</option>
            <option value="matchTimer">Match timer</option>
          </select>
          <NTTopicCombobox
            topics={selectableTopics}
            value={selectedTopic}
            onChange={setSelectedTopic}
            disabled={newWidgetKind !== 'value'}
          />
          <Input
            className="h-7 w-auto min-w-36 max-w-xs flex-none rounded-lg text-xs text-muted-foreground disabled:opacity-35"
            value={selectedPath}
            onChange={event => setSelectedPath(event.target.value)}
            aria-label="NetworkTables path"
            disabled={newWidgetKind !== 'path'}
          />
          <select className={toolbarSelectClass} value={selectedSubsystem} onChange={event => setSelectedSubsystem(event.target.value)} aria-label="Select subsystem" disabled={newWidgetKind !== 'subsystem'}>
            <option value="">Choose subsystem</option>
            {subsystems.map(subsystem => <option key={subsystem.name} value={subsystem.name}>{subsystem.name}</option>)}
          </select>
          <Button className="h-7 rounded-lg px-2 text-xs" type="button" onClick={addWidget} disabled={(newWidgetKind === 'value' && !selectedTopic) || (newWidgetKind === 'path' && !selectedPath.trim()) || (newWidgetKind === 'subsystem' && !selectedSubsystem)}>
            <Plus />
            Add
          </Button>
          <Button className="h-7 rounded-lg px-2 text-xs" type="button" variant="outline" onClick={resetWidgets}>
            <RotateCcw />
            Reset
          </Button>
        </div>
      </div>

      <div
        className="relative min-h-[calc(100vh-var(--header-height)-106px)] w-full overflow-hidden rounded-xl border border-border/60 bg-background/20"
        style={{
          backgroundImage: 'linear-gradient(color-mix(in oklch, var(--border) 42%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklch, var(--border) 42%, transparent) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        {widgets.length === 0 ? (
          <EmptyState label="Waiting for live robot data">Start sim or add a NetworkTables value after topics appear.</EmptyState>
        ) : widgets.map(widget => (
          <WidgetShell
            key={widget.id}
            widget={widget}
            configuring={configuringId === widget.id}
            onBringToFront={bringToFront}
            onMoveLive={moveLive}
            onMoveCommit={moveCommit}
            onResizeLive={resizeLive}
            onResizeCommit={resizeCommit}
            onConfigure={(id) => setConfiguringId(current => current === id ? null : id)}
            onClose={removeWidget}
          >
            {configuringId === widget.id && renderConfig(widget)}
            {renderWidget(widget)}
          </WidgetShell>
        ))}
      </div>
    </div>
  );
}
