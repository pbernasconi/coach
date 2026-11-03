'use client';

import { RefreshCw } from 'lucide-react';
import type { PlannerWeek } from '@/lib/plan/planner-week';
import { keepers, versusLastWeek } from '@/lib/plan/planner-steps.mjs';
import { Card, StepTitle } from './StepLastWeek';
import { clock, dayNum, days, hm, sportVar, weekday } from './plannerUi';

const SYNCS = 'Google Calendar, Lift, Garmin and Zwift';

/**
 * Step 5: the week day by day, against last week, the sessions to keep if the week goes sideways, and where it
 * syncs. The footer's Accept and sync takes it.
 */
export default function StepAccept({ data }: { data: PlannerWeek }) {
  const total = data.events.reduce((n, e) => n + (e.minutes ?? 0), 0);
  const lifts = data.events.filter((e) => e.sport === 'strength' && !/physio|stretch/i.test(e.title)).length;
  const hard = data.events.filter((e) => e.hard).length;
  const rows = versusLastWeek(data.lastWeek, data.events);
  const keep = keepers(data.events);
  const review = data.proposal?.review;
  const fmt = (v: number | null, unit: string) => (v == null ? '–' : unit === 'min' ? hm(v) : String(v));
  return (
    <div className="flex gap-7">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <StepTitle title="Your week, ready to go"
          sub={`${hm(total)} · ${data.events.length} sessions · ${lifts} lift${lifts === 1 ? '' : 's'} · ${hard} hard`} />
        <Card className="flex flex-col py-1.5">
          {days(data.weekStart).map((d) => {
            const items = data.events.filter((e) => e.date === d);
            const gone = d < data.today;
            return (
              <div key={d} className="flex gap-4 border-b py-3 last:border-b-0">
                <span className="w-16 shrink-0 text-[15px] font-semibold">{weekday(d)} {dayNum(d)}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {items.length === 0 && <span className="text-[15px] text-muted-foreground">{gone ? 'Already done' : 'Rest'}</span>}
                  {items.map((e) => (
                    <div key={e.index} className="flex items-center gap-3 text-[15px]">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: sportVar(e) }} />
                      <span className="min-w-0 flex-1 truncate">
                        {e.title}
                        {e.hard && <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">HARD</span>}
                      </span>
                      <span className="w-32 shrink-0 text-right text-sm text-muted-foreground tabular-nums">{e.start ? `${clock(e.start)} · ` : ''}{hm(e.minutes)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </Card>
        <span className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <RefreshCw aria-hidden className="size-4" />
          Goes to {SYNCS}. Moving a workout later syncs it again; moves on your calendar win.
        </span>
      </div>

      <div className="flex w-[440px] shrink-0 flex-col gap-4">
        <Card className="flex flex-col">
          <span className="mb-2 text-[17px] font-semibold">{data.lastWeek?.ongoing ? 'Against this week so far' : 'Against last week'}</span>
          {rows.map((r) => (
            <div key={r.label} className="flex items-center border-b py-2.5 text-[15px] last:border-b-0">
              <span className="flex-1">{r.label}</span>
              <span className="w-20 text-right text-muted-foreground tabular-nums">{fmt(r.before, r.unit)}</span>
              <span aria-hidden className="w-9 text-center text-muted-foreground">→</span>
              <span className="w-20 text-right font-semibold tabular-nums">{fmt(r.after, r.unit)}</span>
            </div>
          ))}
        </Card>
        {keep.length > 0 && (
          <Card className="flex flex-col gap-2.5">
            <span className="text-[17px] font-semibold">If the week goes sideways</span>
            <span className="text-sm leading-5 text-muted-foreground">Keep these {keep.length === 3 ? 'three' : keep.length} and the week still moves you forward.</span>
            <div className="flex flex-wrap gap-1.5">
              {keep.map((e) => (
                <span key={e.index} className="rounded-full px-3 py-1.5 text-[13px] font-semibold"
                  style={{ background: `color-mix(in oklab, ${sportVar(e)} 16%, transparent)`, color: `color-mix(in oklab, ${sportVar(e)} 70%, var(--color-foreground))` }}>
                  {e.title} · {weekday(e.date)}
                </span>
              ))}
            </div>
          </Card>
        )}
        {(review?.headline || data.proposal?.summary) && (
          <section className="flex flex-col gap-1.5 rounded-2xl bg-brand/12 px-5 py-4">
            <span className="text-xs font-semibold tracking-wide text-brand-ink uppercase">Coach</span>
            <span className="text-[15px] leading-[22px]">{review?.headline ?? data.proposal?.summary?.split('\n')[0]}</span>
          </section>
        )}
      </div>
    </div>
  );
}
