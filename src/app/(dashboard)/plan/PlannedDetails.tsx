'use client';

import type { ReactNode } from 'react';
import { ChevronRight, CloudRain, Thermometer, Wind } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@kobo/web';
import WorkoutChart, { ZONE_COLOR } from '@/components/workouts/WorkoutChart';
import WorkoutSteps from '@/components/workouts/WorkoutSteps';
import { cn } from '@/lib/utils';
import { clock, flatten, keyTargets, stepSeconds, stepZone, totals } from '@/lib/workouts/steps.mjs';
import type { StructuredWorkout } from '@/lib/plan/queries';
import type { DayWeather } from '@/lib/plan/weather';

// Parts of the item modal for a planned workout: the workout (main targets, chart, steps, notes), the time in each
// zone, and the forecast for the day.

type Step = { kind: string; count?: number; steps?: Step[]; duration: { type: string; s?: number; m?: number }; target: { type: string; low?: number; high?: number }; notes?: string };

export function Card({ title, note, children, className }: { title: ReactNode; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('min-w-0 rounded-xl border p-4', className)}>
      <h3 className="mb-3 flex items-baseline justify-between gap-2 text-sm font-semibold text-[var(--viz-ink)]">
        <span className="flex items-center gap-1.5">{title}</span>
        {note && <span className="text-right text-xs font-normal text-[var(--viz-muted)]">{note}</span>}
      </h3>
      {children}
    </section>
  );
}

const zoneOfStep = (s: Step, sport: string) => stepZone(s as never, sport) as string;

/**
 * The workout in one card: the main work in a line each, the interval chart (watts or beats up the side, time along
 * the bottom), every step, and the coach's notes folded away under them.
 */
export function Structure({ workout, notes }: { workout: StructuredWorkout; notes?: string | null }) {
  const t = totals(workout as never) as { seconds: number; minutes: number; tss: number; if: number };
  const total = t.seconds || 1;
  const every = total > 3 * 3600 ? 3600 : total > 5400 ? 1800 : 900;
  const ticks = Array.from({ length: Math.floor(total / every) + 1 }, (_, i) => i * every).filter((s) => s <= total);
  const lines = keyTargets(workout as never) as { text: string; zone: string }[];
  return (
    <Card title="Workout" note={`${clock(t.seconds)} · ${t.tss} TSS · IF ${t.if.toFixed(2)}`}>
      {lines.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {lines.map((l, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="mt-1 h-3 w-1.5 shrink-0 rounded-full" style={{ background: ZONE_COLOR[l.zone] }} aria-hidden />
              <span className="font-medium tabular-nums text-[var(--viz-ink)]">{l.text}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="rounded-lg bg-muted/40 px-3 pb-1 pt-5">
        <WorkoutChart workout={workout} />
        <div className="relative ml-10 mt-1 h-4 text-[10px] tabular-nums text-[var(--viz-muted)]">
          {ticks.map((s) => (
            <span key={s} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: `${(s / total) * 100}%` }}>
              {s === 0 ? '0' : clock(s).replace(/:00$/, '')}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <WorkoutSteps workout={workout} />
      </div>
      {notes && (
        <Collapsible className="mt-3 border-t pt-2">
          <CollapsibleTrigger className="group flex w-full items-center gap-1 rounded py-1 text-xs font-medium text-[var(--viz-muted)] hover:text-[var(--viz-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronRight aria-hidden className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90" />
            Coach notes
          </CollapsibleTrigger>
          <CollapsibleContent className="whitespace-pre-wrap pb-1 pl-[1.125rem] pt-1 text-[13px] leading-relaxed text-[var(--viz-ink-2)]">{notes}</CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
}

/** Planned time in each zone, as one bar and a row of minutes. */
export function ZoneTime({ workout }: { workout: StructuredWorkout }) {
  const flat = flatten(workout.steps as never[]) as Step[];
  const by: Record<string, number> = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 };
  for (const s of flat) by[zoneOfStep(s, workout.sport)] += stepSeconds(s as never);
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  if (!total) return null;
  const zones = Object.keys(by);
  return (
    <Card title="Time in zones" note={workout.sport === 'ride' ? 'by power' : 'by heart rate'}>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={zones.map((z) => `${z} ${Math.round((by[z] / total) * 100)}%`).join(', ')}>
        {zones.map((z) => by[z] > 0 && <div key={z} style={{ width: `${(by[z] / total) * 100}%`, background: ZONE_COLOR[z] }} />)}
      </div>
      <ul className="mt-2.5 grid grid-cols-5 gap-1 text-[11px]">
        {zones.map((z) => (
          <li key={z} className="min-w-0">
            <span className="flex items-center gap-1 text-[var(--viz-muted)]">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: ZONE_COLOR[z] }} />
              {z}
            </span>
            <span className="block font-semibold tabular-nums text-[var(--viz-ink)]">{by[z] ? (by[z] < 3600 && by[z] % 60 === 0 ? `${by[z] / 60} min` : clock(by[z])) : '–'}</span>
            <span className="block tabular-nums text-[var(--viz-muted)]">{Math.round((by[z] / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** The forecast for the day of the workout, with a hint when rain makes an indoor ride the better choice. */
export function Forecast({ w, sport }: { w: DayWeather; sport: string }) {
  const wet = (w.rain ?? 0) >= 50;
  return (
    <Card title="Forecast" note={w.src}>
      <p className="text-base font-semibold text-[var(--viz-ink)]">
        {w.text}, {Math.round(w.max)}° / {Math.round(w.min)}°
      </p>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="flex items-center gap-1 text-[var(--viz-muted)]"><CloudRain aria-hidden className="h-3 w-3" /> Rain</dt>
          <dd className="font-semibold tabular-nums text-[var(--viz-ink)]">{w.rain != null ? `${Math.round(w.rain)}%` : '–'}{w.mm ? ` · ${w.mm} mm` : ''}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-[var(--viz-muted)]"><Wind aria-hidden className="h-3 w-3" /> Wind</dt>
          <dd className="font-semibold tabular-nums text-[var(--viz-ink)]">{w.wind != null ? `${Math.round(w.wind)} km/h${w.dir ? ` ${w.dir}` : ''}` : '–'}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-[var(--viz-muted)]"><Thermometer aria-hidden className="h-3 w-3" /> Feels</dt>
          <dd className="font-semibold tabular-nums text-[var(--viz-ink)]">{w.feels ? `${Math.round(w.feels[0])}–${Math.round(w.feels[1])}°` : '–'}</dd>
        </div>
      </dl>
      {wet && (sport === 'ride' || sport === 'run') && (
        <p className="mt-2 text-xs text-[var(--plan-partial)]">{sport === 'ride' ? 'Rain likely: Zwift is the dry option.' : 'Rain likely: plan for wet roads.'}</p>
      )}
    </Card>
  );
}
