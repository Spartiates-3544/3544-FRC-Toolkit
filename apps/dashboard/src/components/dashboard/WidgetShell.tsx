import { useCallback, useEffect, useRef, type ReactNode, type PointerEvent } from 'react';
import { Settings2, X } from 'lucide-react';
import { Button } from '../ui';
import { cn } from '@/lib/utils';
import { clamp, snap, type DashboardWidget } from './types';

export function WidgetShell({
  widget,
  configuring,
  onBringToFront,
  onMoveLive,
  onMoveCommit,
  onResizeLive,
  onResizeCommit,
  onConfigure,
  onClose,
  children,
}: {
  widget: DashboardWidget;
  configuring: boolean;
  onBringToFront: (id: string) => void;
  onMoveLive: (id: string, x: number, y: number) => void;
  onMoveCommit: (id: string, x: number, y: number) => void;
  onResizeLive: (id: string, w: number, h: number) => void;
  onResizeCommit: (id: string, w: number, h: number) => void;
  onConfigure: (id: string) => void;
  onClose: (id: string) => void;
  children: ReactNode;
}) {
  const dragRef = useRef<{ startX: number; startY: number; px: number; py: number } | null>(null);
  const resizeRef = useRef<{ startW: number; startH: number; px: number; py: number } | null>(null);
  const liveRef = useRef({ x: widget.x, y: widget.y, w: widget.w, h: widget.h });
  const rafMove = useRef<number | null>(null);
  const rafResize = useRef<number | null>(null);

  useEffect(() => {
    liveRef.current = { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
  }, [widget.x, widget.y, widget.w, widget.h]);

  useEffect(() => () => {
    if (rafMove.current) cancelAnimationFrame(rafMove.current);
    if (rafResize.current) cancelAnimationFrame(rafResize.current);
  }, []);

  const commitMove = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    onMoveCommit(widget.id, liveRef.current.x, liveRef.current.y);
  }, [onMoveCommit, widget.id]);

  const commitResize = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    onResizeCommit(widget.id, liveRef.current.w, liveRef.current.h);
  }, [onResizeCommit, widget.id]);

  function onHeaderPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    onBringToFront(widget.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: liveRef.current.x, startY: liveRef.current.y, px: event.clientX, py: event.clientY };
  }

  function onHeaderPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const maxX = Math.max(0, window.innerWidth - 80);
    const maxY = Math.max(0, window.innerHeight - 130);
    liveRef.current.x = clamp(snap(drag.startX + event.clientX - drag.px), 0, maxX);
    liveRef.current.y = clamp(snap(drag.startY + event.clientY - drag.py), 0, maxY);
    if (!rafMove.current) {
      rafMove.current = requestAnimationFrame(() => {
        rafMove.current = null;
        onMoveLive(widget.id, liveRef.current.x, liveRef.current.y);
      });
    }
  }

  function onResizePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    onBringToFront(widget.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = { startW: liveRef.current.w, startH: liveRef.current.h, px: event.clientX, py: event.clientY };
  }

  function onResizePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const resize = resizeRef.current;
    if (!resize) return;
    liveRef.current.w = snap(clamp(resize.startW + event.clientX - resize.px, 180, 900));
    liveRef.current.h = snap(clamp(resize.startH + event.clientY - resize.py, 120, 720));
    if (!rafResize.current) {
      rafResize.current = requestAnimationFrame(() => {
        rafResize.current = null;
        onResizeLive(widget.id, liveRef.current.w, liveRef.current.h);
      });
    }
  }

  return (
    <section
      className={cn(
        'pointer-events-auto absolute flex flex-col overflow-hidden rounded-xl border border-border/70 bg-background/78 text-foreground shadow-xl backdrop-blur-xl supports-[backdrop-filter]:bg-background/58',
        configuring && 'ring-2 ring-primary/50',
      )}
      style={{ left: widget.x, top: widget.y, width: widget.w, height: widget.h, zIndex: widget.z }}
      onPointerDown={() => onBringToFront(widget.id)}
    >
      <div
        className="flex h-8 shrink-0 cursor-grab select-none items-center justify-between gap-2 border-b border-border/60 bg-muted/35 px-2 active:cursor-grabbing"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={commitMove}
        onPointerCancel={commitMove}
      >
        <span className="min-w-0 truncate text-[11px] font-black uppercase tracking-wide text-muted-foreground">{widget.title}</span>
        <div className="flex shrink-0 items-center gap-1" onPointerDown={event => event.stopPropagation()}>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onConfigure(widget.id)} aria-label={`Configure ${widget.title}`}>
            <Settings2 />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onClose(widget.id)} aria-label={`Remove ${widget.title}`}>
            <X />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">{children}</div>
      <button
        type="button"
        className="absolute bottom-1.5 right-1.5 size-5 cursor-nwse-resize rounded-md border border-border bg-background/85 shadow-sm after:absolute after:bottom-1 after:right-1 after:size-2 after:border-b after:border-r after:border-muted-foreground after:content-['']"
        aria-label={`Resize ${widget.title}`}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={commitResize}
        onPointerCancel={commitResize}
      />
    </section>
  );
}
