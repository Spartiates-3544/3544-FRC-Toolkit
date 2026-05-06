import type { CSSProperties, HTMLAttributes, InputHTMLAttributes, ReactNode, ButtonHTMLAttributes } from 'react';

type Classy = { className?: string; style?: CSSProperties };

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Card({
  title,
  children,
  wide,
  className,
  style,
}: {
  title?: string;
  children: ReactNode;
  wide?: boolean;
} & Classy) {
  return (
    <section className={cn('ui-card', wide && 'ui-card-wide', className)} style={style}>
      {title && (
        <header className="ui-card-header">
          <h2 className="ui-card-title">{title}</h2>
        </header>
      )}
      <div className="ui-card-content">{children}</div>
    </section>
  );
}

export function Grid({ children, className, style }: { children: ReactNode } & Classy) {
  return (
    <div className={cn('ui-grid', className)} style={style}>
      {children}
    </div>
  );
}

export function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="ui-row">
      <span className="ui-row-label">{label}</span>
      <span className="ui-row-value" style={{ color: color ?? undefined }}>{value}</span>
    </div>
  );
}

export function ProgressBar({ ratio, color }: { ratio: number; color?: string }) {
  return (
    <div className="ui-progress">
      <div
        className="ui-progress-indicator"
        style={{
          width: `${Math.min(Math.max(ratio, 0) * 100, 100)}%`,
          background: color ?? 'hsl(var(--primary))',
        }}
      />
    </div>
  );
}

export function InputRow({ children, className, style }: { children: ReactNode } & Classy) {
  return (
    <div className={cn('ui-input-row', className)} style={style}>
      {children}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('ui-input', className)} />;
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'icon';
}) {
  return <button {...props} className={cn('ui-button', `ui-button-${variant}`, `ui-button-size-${size}`, className)} />;
}

export function Badge({
  label,
  color,
  variant = 'default',
  children,
  className,
  style,
}: {
  label?: string;
  color?: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'muted';
  children?: ReactNode;
} & Classy) {
  return (
    <span
      className={cn('ui-badge', `ui-badge-${variant}`, className)}
      style={{ ...(color ? { backgroundColor: color, color: '#fff', borderColor: color } : {}), ...style }}
    >
      {children ?? label}
    </span>
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
    <div className={cn('ui-tabs-list', className)} role="tablist">
      {items.map(item => (
        <Button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          variant={value === item.id ? 'secondary' : 'ghost'}
          className="ui-tabs-trigger"
          onClick={() => onValueChange(item.id)}
        >
          {item.label}
          {getBadge?.(item.id)}
        </Button>
      ))}
    </div>
  );
}

export function Table({ children, className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="ui-table-wrap">
      <table {...props} className={cn('ui-table', className)}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} className={cn('ui-table-header', className)}>{children}</thead>;
}

export function TableBody({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} className={cn('ui-table-body', className)}>{children}</tbody>;
}

export function TableRow({ children, className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} className={cn('ui-table-row', className)}>{children}</tr>;
}

export function TableHead({ children, className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <th {...props} className={cn('ui-table-head', className)}>{children}</th>;
}

export function TableCell({ children, className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} className={cn('ui-table-cell', className)}>{children}</td>;
}

export function EmptyState({ label, children, className }: { label: string; children?: ReactNode } & Classy) {
  return (
    <div className={cn('ui-empty', className)}>
      <span className="ui-empty-title">{label}</span>
      {children && <span className="ui-empty-subtitle">{children}</span>}
    </div>
  );
}

export function Placeholder({ label }: { label: string }) {
  return <EmptyState label={label}>Not yet implemented</EmptyState>;
}
