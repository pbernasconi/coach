'use client';

import { useEffect, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { LEVEL_LABEL } from '@/lib/plan/compliance.mjs';
import { levelStyle } from './ComplianceMark';

const LEVELS: [string, string][] = [
  ['good', '80–120 % of the planned time'],
  ['partial', 'Under 80 % or over 120 %'],
  ['missed', 'Missed or skipped (with why)'],
  ['planned', 'Still to do'],
];

/** The calendar key in a small "?" popover: chip styles, compliance colours and the week summary labels. */
export default function LegendPopover({ placeName }: { placeName: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Calendar key"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CircleHelp aria-hidden className="h-4 w-4" />
      </button>
      {open && (
        <div role="dialog" aria-label="Calendar key" className="absolute right-0 top-full z-40 mt-2 w-72 space-y-3 rounded-lg border bg-background p-3 text-xs shadow-xl">
          <section className="space-y-1.5">
            <h3 className="font-semibold text-[var(--viz-ink)]">Chips</h3>
            <div className="flex items-center gap-2">
              <span className="h-5 w-10 rounded-[5px] border border-dashed border-[var(--viz-axis)] [border-left:3px_solid_var(--sport-ride)]" />
              <span className="text-[var(--viz-ink-2)]">Planned, still to do (dashed outline)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="plan-done h-5 w-10 rounded-[5px] border shadow-sm [border-left:3px_solid_var(--sport-ride)]" style={{ '--chip-tint': 'var(--plan-good)' } as React.CSSProperties} />
              <span className="text-[var(--viz-ink-2)]">Done, partly done or not done (filled in its status colour). The edge is the sport colour.</span>
            </div>
          </section>
          <section className="space-y-1">
            <h3 className="font-semibold text-[var(--viz-ink)]">Planned vs completed</h3>
            {LEVELS.map(([level, hint]) => {
              const { color, Icon } = levelStyle(level);
              return (
                <div key={level} className="flex items-center gap-2">
                  <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" style={{ color }} strokeWidth={2.75} />
                  <span className="font-medium text-[var(--viz-ink)]">{(LEVEL_LABEL as Record<string, string>)[level]}</span>
                  <span className="text-[var(--viz-muted)]">{hint}</span>
                </div>
              );
            })}
          </section>
          <section className="space-y-1 text-[var(--viz-ink-2)]">
            <h3 className="font-semibold text-[var(--viz-ink)]">Week column</h3>
            <p>Fitness (CTL), Fatigue (ATL) and Form (TSB) at the end of the week. Time and TSS are done / planned.</p>
            <p>Weather: {placeName}, the next 14 days.</p>
          </section>
        </div>
      )}
    </div>
  );
}
