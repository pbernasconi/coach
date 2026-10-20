'use client';

/** One tooltip for a chart: value first, label second, series keyed with a short line. */
export type TooltipRow = { key: string; label: string; value: string; color?: string; strong?: boolean };

export function ChartTooltip({ x, y, width, title, rows }: { x: number; y: number; width: number; title: string; rows: TooltipRow[] }) {
  const W = 200;
  const left = Math.min(Math.max(0, x + 14), width - W);
  const flip = x + 14 + W > width;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 rounded-md border bg-[var(--viz-surface)] px-3 py-2 text-xs shadow-md"
      style={{ left: flip ? Math.max(0, x - W - 14) : left, top: Math.max(0, y), width: W }}
    >
      <div className="mb-1 font-medium text-[var(--viz-ink-2)]">{title}</div>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2 py-0.5">
          {r.color ? <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: r.color }} /> : <span className="w-3 shrink-0" />}
          <span className={`tabular-nums ${r.strong ? 'font-semibold text-[var(--viz-ink)]' : 'text-[var(--viz-ink)]'}`}>{r.value}</span>
          <span className="truncate text-[var(--viz-muted)]">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/** A legend entry: rect for bars and areas, line for lines. Text stays in ink, never the series color. */
export function LegendItem({ color, label, shape = 'rect' }: { color: string; label: string; shape?: 'rect' | 'line' | 'dot' }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--viz-ink-2)]">
      {shape === 'rect' && <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} />}
      {shape === 'line' && <span className="h-0.5 w-3.5 rounded-full" style={{ background: color }} />}
      {shape === 'dot' && <span className="h-2 w-2 rounded-full border-2" style={{ borderColor: color }} />}
      {label}
    </span>
  );
}
