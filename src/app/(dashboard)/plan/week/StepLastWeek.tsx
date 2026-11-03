'use client';

import { cn } from '@kobo/web';
import type { PlannerWeek } from '@/lib/plan/planner-week';
import { lastWeekRead } from '@/lib/plan/planner-steps.mjs';
import { Chip, FEELS, type Answers } from './PlannerPanels';
import { dayNum, hm, sportVar, weekLabel, weekday } from './plannerUi';

const LEVEL: Record<string, { text: string; className: string }> = {
  good: { text: 'Done', className: 'text-emerald-700 dark:text-emerald-400' },
  done: { text: 'Done', className: 'text-emerald-700 dark:text-emerald-400' },
  partial: { text: 'Partly', className: 'text-amber-700 dark:text-amber-400' },
  off: { text: 'Off plan', className: 'text-amber-700 dark:text-amber-400' },
  missed: { text: 'Missed', className: 'text-rose-700 dark:text-rose-400' },
  skipped: { text: 'Skipped', className: 'text-rose-700 dark:text-rose-400' },
};
const TONE = { good: 'text-emerald-700 dark:text-emerald-400', warn: 'text-amber-700 dark:text-amber-400', bad: 'text-rose-700 dark:text-rose-400', neutral: 'text-muted-foreground' };

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn('rounded-2xl border bg-card p-5', className)}>{children}</section>;
}

export function StepTitle({ title, sub }: { title: string; sub?: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-[28px] leading-9 font-semibold tracking-tight">{title}</h1>
      {sub && <p className="text-[15px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Tile({ label, value, note, tone = 'neutral' }: { label: string; value: string; note?: string | null; tone?: keyof typeof TONE }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border bg-card px-4 py-3.5">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="text-[26px] leading-8 font-semibold tracking-tight tabular-nums">{value}</span>
      {note && <span className={cn('truncate text-[13px]', TONE[tone])}>{note}</span>}
    </div>
  );
}

/**
 * Step 1: how last week went (time, lifts, hard sessions, fitness), day by day from Strava and the plan, Coach's
 * read of it, and how Paolo is coming into this week.
 */
export default function StepLastWeek({ data, answers, setAnswers }: { data: PlannerWeek; answers: Answers; setAnswers: (a: Answers) => void }) {
  const lw = data.lastWeek;
  const fact = (id: string) => data.context?.facts.find((f) => f.id === id) ?? null;
  const fitness = fact('fitness');
  const form = fact('form');
  const read = lastWeekRead(lw, data.today);
  const ongoing = lw?.ongoing ?? false;
  const side = (data.context?.facts ?? []).filter((f) => ['readiness', 'feel', 'skips', 'event', 'volume'].includes(f.id));
  return (
    <div className="flex gap-7">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <StepTitle title={ongoing ? 'This week so far' : 'How last week went'}
          sub={lw ? `${weekLabel(lw.monday)}, from Strava, Garmin and Lift${ongoing ? '. It isn\u2019t over yet.' : ''}` : 'No week before this one to look at yet.'} />
        {lw && (
          <>
            <div className="grid grid-cols-4 gap-3.5">
              <Tile label="Time" value={hm(lw.doneMin)} tone={ongoing ? 'neutral' : lw.doneMin < 480 ? 'warn' : 'good'}
                note={ongoing ? 'So far' : lw.doneMin < 480 ? 'Under your 8–10 h week' : lw.plannedMin ? `of ${hm(lw.plannedMin)} planned` : 'A full week'} />
              <Tile label="Lifts" value={`${lw.lifts.done} of ${lw.lifts.planned}`} tone={lw.lifts.done < lw.lifts.planned ? 'warn' : lw.lifts.planned ? 'good' : 'neutral'}
                note={lw.lifts.done < lw.lifts.planned ? `${lw.lifts.planned - lw.lifts.done} missed` : lw.lifts.planned ? 'All done' : ongoing ? 'None due yet' : 'None planned'} />
              <Tile label="Hard sessions" value={`${lw.hard.done} of ${lw.hard.planned}`} tone={lw.hard.done < lw.hard.planned ? 'warn' : lw.hard.planned ? 'good' : 'neutral'}
                note={lw.hard.done < lw.hard.planned ? `${lw.hard.planned - lw.hard.done} missed` : lw.hard.planned ? 'All done' : ongoing ? 'None due yet' : 'None planned'} />
              <Tile label="Fitness" value={fitness ? fitness.value.replace(' CTL', '') : '–'} note={form ? `Form ${form.value}, ${form.note ?? ''}`.replace(/, $/, '') : fitness?.note} />
            </div>
            <div className="grid grid-cols-7 gap-2.5">
              {lw.days.map((d) => {
                const ahead = d.date >= data.today;
                const missed = d.items.filter((i) => ['missed', 'skipped', 'partial'].includes(i.level));
                const coming = ahead ? d.items.filter((i) => !['good', 'done', 'partial'].includes(i.level)) : [];
                const nothing = d.done.length === 0 && missed.length === 0 && coming.length === 0;
                return (
                  <div key={d.date} className="flex min-h-36 min-w-0 flex-col gap-2 rounded-2xl border bg-card p-3">
                    <span className="text-[13px] font-semibold">{weekday(d.date)} {dayNum(d.date)}</span>
                    {d.done.map((a, i) => (
                      <div key={i} className="flex min-w-0 flex-col gap-0.5 rounded-md border-l-[3px] px-2 py-1.5"
                        style={{ borderLeftColor: sportVar({ sport: a.sport, title: a.name }), background: `color-mix(in oklab, ${sportVar({ sport: a.sport, title: a.name })} 13%, var(--color-card))` }}>
                        <span className="truncate text-xs font-semibold">{a.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{a.km ? `${a.km} km · ` : ''}{hm(a.min)}</span>
                      </div>
                    ))}
                    {missed.map((i, k) => (
                      <span key={k} className={cn('text-xs font-medium', LEVEL[i.level]?.className)}>{LEVEL[i.level]?.text}: {i.title}</span>
                    ))}
                    {coming.map((i, k) => (
                      <span key={`c${k}`} className="text-xs text-muted-foreground">Planned: {i.title}</span>
                    ))}
                    {nothing && <span className="text-xs text-muted-foreground">{ahead ? 'Nothing planned' : 'Nothing logged'}</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}
        {read.length > 0 && (
          <Card className="flex flex-col gap-3.5">
            <span className="text-xs font-semibold tracking-wide text-brand-ink uppercase">Coach&apos;s read</span>
            <div className="grid grid-cols-3 gap-5">
              {read.map((r) => (
                <div key={r.id} className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-[15px] font-semibold">
                    <span className={cn('size-2 rounded-full', r.tone === 'good' ? 'bg-emerald-500' : 'bg-amber-500')} />
                    {r.title}
                  </span>
                  <span className="text-sm leading-5 text-muted-foreground">{r.text}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="flex w-[420px] shrink-0 flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold">How are you coming into this week?</span>
            <span className="text-sm text-muted-foreground">Coach shapes the first days around it.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {FEELS.map((f) => (
              <Chip key={f.id} on={answers.feel === f.id} onClick={() => setAnswers({ ...answers, feel: answers.feel === f.id ? null : f.id })}>{f.label}</Chip>
            ))}
          </div>
          {data.context?.suggested.feelWhy && (
            <div className="rounded-xl bg-brand/12 px-3.5 py-3 text-sm leading-5">
              Coach reads {data.context.suggested.feel}: {data.context.suggested.feelWhy}.
            </div>
          )}
        </Card>
        {side.length > 0 && (
          <Card className="flex flex-col">
            <span className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Going in</span>
            {side.map((f) => (
              <div key={f.id} className="flex items-baseline justify-between gap-3 border-b py-2 text-[15px] last:border-b-0">
                <span className="shrink-0">{f.label}</span>
                <span className="flex min-w-0 flex-col items-end">
                  <span className={cn('font-semibold', TONE[f.tone])}>{f.value}</span>
                  {f.note && <span className="truncate text-xs text-muted-foreground">{f.note}</span>}
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
