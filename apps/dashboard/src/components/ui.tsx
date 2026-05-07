import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import { Badge as ShadcnBadge } from './ui/badge';
import { Button } from './ui/button';
import {
  Card as ShadcnCard,
  CardContent,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Tabs as ShadcnTabs,
  TabsList,
  TabsTrigger,
} from './ui/tabs';
import { cn } from '@/lib/utils';

export { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow };

type Classy = { className?: string; style?: CSSProperties };
export type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'muted';

const toneText: Record<Tone, string> = {
  default: 'text-foreground',
  success: 'text-primary',
  warning: 'text-secondary-foreground',
  destructive: 'text-destructive',
  muted: 'text-muted-foreground',
};

export function toneFor(ok: boolean): Tone {
  return ok ? 'success' : 'destructive';
}

export function warningTone(active: boolean): Tone {
  return active ? 'warning' : 'success';
}

export function Card({
  title,
  children,
  wide,
  className,
  style,
  ...props
}: {
  title?: string;
  children: ReactNode;
  wide?: boolean;
} & Classy & Omit<HTMLAttributes<HTMLDivElement>, 'title'>) {
  return (
    <ShadcnCard className={cn(wide && 'lg:col-span-2 2xl:col-span-3', className)} style={style} {...props}>
      {title && (
        <CardHeader className="pb-0">
          <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={title ? 'pt-0' : undefined}>{children}</CardContent>
    </ShadcnCard>
  );
}

export function Grid({ children, className, style }: { children: ReactNode } & Classy) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3', className)} style={style}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
}) {
  return (
    <ShadcnCard className="gap-1 px-5 py-4">
      <span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span>
      <span className={cn('text-xl font-black tracking-tight', toneText[tone])}>{value}</span>
    </ShadcnCard>
  );
}

export function Row({ label, value, tone = 'default' }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4 border-b border-border/60 py-1.5 last:border-b-0">
      <span className="min-w-0 text-sm font-medium text-muted-foreground">{label}</span>
      <span className={cn('min-w-0 text-right text-sm font-semibold', toneText[tone])}>{value}</span>
    </div>
  );
}

export function ProgressBar({ ratio }: { ratio: number; tone?: Tone }) {
  return <Progress className="mt-3" value={Math.min(Math.max(ratio, 0) * 100, 100)} />;
}

export function InputRow({ children, className, style }: { children: ReactNode } & Classy) {
  return (
    <div className={cn('mt-3 flex gap-2', className)} style={style}>
      {children}
    </div>
  );
}

export function Badge({
  label,
  variant = 'default',
  children,
  className,
  style,
}: {
  label?: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'muted';
  children?: ReactNode;
} & Classy) {
  return (
    <ShadcnBadge variant={variant} className={className} style={style}>
      {children ?? label}
    </ShadcnBadge>
  );
}

export function Tabs<T extends string>({
  items,
  value,
  onValueChange,
  getBadge,
  className,
}: {
  items: readonly { id: T; label: string }[];
  value: T;
  onValueChange: (value: T) => void;
  getBadge?: (value: T) => ReactNode;
} & Classy) {
  return (
    <ShadcnTabs value={value} onValueChange={(next) => onValueChange(next as T)} className={className}>
      <TabsList className="h-auto max-w-full flex-wrap justify-start gap-1 bg-muted/70 p-1">
        {items.map(item => (
          <TabsTrigger key={item.id} value={item.id} className="relative grow-0 rounded-md px-3">
            {item.label}
            {getBadge?.(item.id)}
          </TabsTrigger>
        ))}
      </TabsList>
    </ShadcnTabs>
  );
}

export function EmptyState({ label, children, className }: { label: string; children?: ReactNode } & Classy) {
  return (
    <div className={cn('flex min-h-[260px] flex-col items-center justify-center gap-2 text-center text-muted-foreground', className)}>
      <span className="text-lg font-semibold text-foreground">{label}</span>
      {children && <span className="text-sm text-muted-foreground">{children}</span>}
    </div>
  );
}

export function Placeholder({ label }: { label: string }) {
  return <EmptyState label={label}>Not yet implemented</EmptyState>;
}

export function TableWrap({ children, className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <Table {...props} className={className}>{children}</Table>;
}
