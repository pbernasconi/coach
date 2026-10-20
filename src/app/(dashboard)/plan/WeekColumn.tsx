'use client';

import { Dumbbell } from 'lucide-react';
import SportIcon from '@/components/SportIcon';
import { sport } from '@/lib/sports';
import { weekColumnMode } from '@/lib/plan/cells.mjs';
import type { WeekSummary } from '@/lib/plan/month';
import { hm, shortDate } from './calendarShared';

/** The week column: fitness, fatigue and form at the end of the week, then done / planned totals and time per sport. */
export function WeekColumn({ s, monday, today }: { s: WeekSummary | null; monday: string; today: string }) {
  const mode = weekColumnMode(s, today);
  if (!s || mode === 'empty') {
    return (
      <div className="border-l bg-[var(--viz-surface)] px-2 py-1.5 text-[11px] text-[var(--viz-muted)]">
        {monday > today ? 'No plan' : ''}
      </div>
    );
  }
  if (mode === 'planned') {
    return (
      <div className="flex min-w-0 flex-col gap-1.5 overflow-hidden border-l bg-[var(--viz-surface)] px-2 py-1.5 text-[11px] leading-4" aria-label={`Week of ${shortDate(monday)}, planned`}>
        <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--viz-muted)]">Planned</div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 tabular-nums">
          <dt className="text-[var(--viz-muted)]">Time</dt>
          <dd className="text-right text-[var(--viz-ink)]">{hm(s.planned.min)}</dd>
          {s.planned.tss > 0 && (<><dt className="text-[var(--viz-muted)]">TSS</dt><dd className="text-right text-[var(--viz-ink)]">{s.planned.tss}</dd></>)}
          <dt className="text-[var(--viz-muted)]">Workouts</dt>
          <dd className="text-right text-[var(--viz-ink)]">{s.planned.count}</dd>
        </dl>
      </div>
    );
  }
  const f = s.fitness;
  const sports = Object.entries(s.done.bySport).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]);
  const load: [string, string, string, string][] = [
    ['Fitness (CTL)', 'Fit', f ? String(Math.round(f.ctl)) : '–', 'var(--viz-ctl)'],
    ['Fatigue (ATL)', 'Fat', f ? String(Math.round(f.atl)) : '–', 'var(--viz-atl)'],
    ['Form (TSB)', 'Form', f ? `${f.tsb > 0 ? '+' : ''}${Math.round(f.tsb)}` : '–', 'var(--viz-tsb)'],
  ];
  const row = (label: string, value: string, planned?: string | null) => (
    <>
      <dt className="text-[var(--viz-muted)]">{label}</dt>
      <dd className="text-right text-[var(--viz-ink)]">
        {value}
        {planned && <span className="text-[var(--viz-muted)]"> / {planned}</span>}
      </dd>
    </>
  );
  return (
    <div className="flex min-w-0 flex-col gap-1.5 overflow-hidden border-l bg-[var(--viz-surface)] px-2 py-1.5 text-[11px] leading-4" aria-label={`Week of ${shortDate(monday)}`}>
      {f && <div className="grid grid-cols-3 gap-1" title={`On ${shortDate(f.date)}`}>
        {load.map(([full, short, value, color]) => (
          <div key={short} title={full} className="min-w-0">
            <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--viz-muted)]">
              <span className="h-0.5 w-2 shrink-0 rounded-full" style={{ background: color }} />
              {short}
            </div>
            <div className="font-semibold tabular-nums text-[var(--viz-ink)]">{value}</div>
          </div>
        ))}
      </div>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 tabular-nums" title="Done / planned">
        {row('Time', hm(s.done.min), s.planned.min ? hm(s.planned.min) : null)}
        {row('TSS', String(s.done.tss), s.planned.tss ? String(s.planned.tss) : null)}
        {s.done.km > 0 && row('Dist', `${s.done.km} km`)}
        {s.planned.count > 0 && row('Done', `${s.planned.done}/${s.planned.count}`)}
      </dl>
      {(sports.length > 0 || s.done.liftSessions > 0) && (
        <ul className="mt-auto flex flex-wrap gap-x-2 gap-y-0.5 tabular-nums text-[var(--viz-ink)]">
          {sports.map(([id, m]) => (
            <li key={id} className="inline-flex items-center gap-0.5" title={sport(id).label}>
              <SportIcon id={id} className="h-3 w-3" />
              <span className="sr-only">{sport(id).label}</span>
              {hm(m)}
            </li>
          ))}
          {s.done.liftSessions > 0 && (
            <li className="inline-flex items-center gap-0.5" title="Lift sessions">
              <Dumbbell aria-hidden className="h-3 w-3" style={{ color: sport('strength').color }} />
              {s.done.liftSessions}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
