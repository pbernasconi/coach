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
        {/* A projection (the plan review): fitness, fatigue and form at the end of the week if done as planned. */}
        {s.fitness && <LoadGrid f={s.fitness} title="End of week, if done as planned" />}
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
      {f && <LoadGrid f={f} title={`On ${shortDate(f.date)}`} />}
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 tabular-nums" title="Done / planned">
        {row('Time', hm(s.done.min), s.planned.min ? hm(s.planned.min) : null)}
        {s.planned.min > 0 && <WeekBar done={s.done.min} planned={s.planned.min} label="Time" />}
        {row('TSS', String(s.done.tss), s.planned.tss ? String(s.planned.tss) : null)}
        {s.planned.tss > 0 && <WeekBar done={s.done.tss} planned={s.planned.tss} label="TSS" />}
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

/** A thin done / planned bar under a week total (TrainingPeaks' summary column). Full at 100 %; more is still full. */
export function WeekBar({ done, planned, label, className = 'col-span-2 mb-0.5 mt-px' }: { done: number; planned: number; label: string; className?: string }) {
  const pct = Math.round((done / planned) * 100);
  return (
    <div
      role="meter"
      aria-label={`${label}: ${pct} % of the plan`}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-1 overflow-hidden rounded-full bg-[var(--viz-grid)] ${className}`}
    >
      <div className="h-full rounded-full bg-[var(--viz-ink-2)]" style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

/** Fitness, fatigue and form, each with its chart colour. */
function LoadGrid({ f, title }: { f: { ctl: number; atl: number; tsb: number }; title: string }) {
  const load: [string, string, string, string][] = [
    ['Fitness (CTL)', 'Fit', String(Math.round(f.ctl)), 'var(--viz-ctl)'],
    ['Fatigue (ATL)', 'Fat', String(Math.round(f.atl)), 'var(--viz-atl)'],
    ['Form (TSB)', 'Form', `${f.tsb > 0 ? '+' : ''}${Math.round(f.tsb)}`, 'var(--viz-tsb)'],
  ];
  return (
    <div className="grid grid-cols-3 gap-1" title={title}>
      {load.map(([full, short, value, color]) => (
        <div key={short} title={full} className="min-w-0">
          <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--viz-muted)]">
            <span className="h-0.5 w-2 shrink-0 rounded-full" style={{ background: color }} />
            {short}
          </div>
          <div className="font-semibold tabular-nums text-[var(--viz-ink)]">{value}</div>
        </div>
      ))}
    </div>
  );
}

/** The week's totals on one line, done / planned (the phone agenda's week header; the plan review shows `plannedOnly`). `bars`: a done / planned bar under each. */
export function WeekTotals({ s, plannedOnly = false, bars = false }: { s: WeekSummary; plannedOnly?: boolean; bars?: boolean }) {
  return (
    <span className="flex flex-wrap gap-x-3 text-[11px] tabular-nums">
      <span className="inline-flex flex-col">
        <span><span className="text-[var(--viz-muted)]">Time </span><span className="text-[var(--viz-ink)]">{plannedOnly ? hm(s.planned.min) : `${hm(s.done.min)}${s.planned.min ? ` / ${hm(s.planned.min)}` : ''}`}</span></span>
        {bars && !plannedOnly && s.planned.min > 0 && <WeekBar done={s.done.min} planned={s.planned.min} label="Time" className="mt-0.5" />}
      </span>
      <span className="inline-flex flex-col">
        <span><span className="text-[var(--viz-muted)]">TSS </span><span className="text-[var(--viz-ink)]">{plannedOnly ? s.planned.tss : `${s.done.tss}${s.planned.tss ? ` / ${s.planned.tss}` : ''}`}</span></span>
        {bars && !plannedOnly && s.planned.tss > 0 && <WeekBar done={s.done.tss} planned={s.planned.tss} label="TSS" className="mt-0.5" />}
      </span>
      {s.fitness && (
        <span title="Form (TSB) at the end of the week">
          <span className="text-[var(--viz-muted)]">Form </span>
          <span className="text-[var(--viz-ink)]">{s.fitness.tsb > 0 ? '+' : ''}{Math.round(s.fitness.tsb)}</span>
        </span>
      )}
    </span>
  );
}
