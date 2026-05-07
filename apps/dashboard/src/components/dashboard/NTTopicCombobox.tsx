import { useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { NTTopicSnapshot } from '../../hooks/useNTPrefix';

interface NTTopicComboboxProps {
  topics: NTTopicSnapshot[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function NTTopicCombobox({ topics, value, onChange, disabled, placeholder = 'Choose NT value' }: NTTopicComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = topics.find(t => t.key === value);

  // Group topics by their first path segment after the root (e.g. /3544/Power → "Power")
  const groups = topics.reduce<Record<string, NTTopicSnapshot[]>>((acc, topic) => {
    const parts = topic.key.split('/').filter(Boolean);
    const group = parts.length >= 2 ? parts[1] : 'Other';
    (acc[group] ??= []).push(topic);
    return acc;
  }, {});

  const leafName = (key: string) => key.split('/').at(-1) ?? key;

  return (
    <Popover open={open && !disabled} onOpenChange={v => { if (!disabled) setOpen(v); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          className="flex h-7 min-w-36 max-w-56 items-center justify-between gap-1.5 truncate rounded-lg border border-input bg-background/70 px-2 py-1 text-left text-xs text-foreground shadow-xs outline-none transition-[color,box-shadow] hover:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-35"
        >
          <span className="truncate text-muted-foreground">
            {selected ? (
              <span className="text-foreground">{leafName(selected.key)}</span>
            ) : placeholder}
          </span>
          <ChevronsUpDown className="size-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0" sideOffset={6}>
        <Command>
          <CommandInput placeholder="Search topics…" />
          <CommandList>
            <CommandEmpty>No topics found.</CommandEmpty>
            {Object.entries(groups).map(([group, groupTopics]) => (
              <CommandGroup key={group} heading={group}>
                {groupTopics.map(topic => (
                  <CommandItem
                    key={topic.key}
                    value={topic.key}
                    data-checked={topic.key === value}
                    onSelect={() => { onChange(topic.key); setOpen(false); }}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <span className="font-medium">{leafName(topic.key)}</span>
                    <span className="text-[10px] text-muted-foreground opacity-70">{topic.key}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
