'use client';

import { cn } from '@kobo/web';
import { Sparkles } from 'lucide-react';
import type { PlannerWeek } from '@/lib/plan/planner-week';
import { lastWeekRead } from '@/lib/plan/planner-steps.mjs';
import { Chip, FEELS, type Answers } from './PlannerPanels';
import { dayNum, hm, sportVar, weekLabel, weekday } from './plannerUi';

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

const BAR = { good: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-rose-500', neutral: 'bg-foreground/40' };

/** A number with its note, and a meter when it counts toward a target (lifts done of planned, hours of 8). */
function Tile({ label, value, note, tone = 'neutral', share }: { label: string; value: string; note?: string | null; tone?: keyof typeof TONE; share?: number | null }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border bg-card px-4 py-3.5">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="text-[26px] leading-8 font-semibold tracking-tight tabular-nums">{value}</span>
      {share != null && (
        <span className="my-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <span className={cn('block h-full rounded-full', BAR[tone])} style={{ width: `${Math.max(3, Math.min(100, share * 100))}%` }} />
        </span>
      )}
      {note && <span className={cn('truncate text-[13px]', TONE[tone])}>{note}</span>}
    </div>
  );
}

const MISS: Record<string, { text: string; className: string }> = {
  missed: { text: 'Missed', className: 'border-rose-500/45 text-rose-700 dark:text-rose-300' },
  skipped: { text: 'Skipped', className: 'border-rose-500/45 text-rose-700 dark:text-rose-300' },
  partial: { text: 'Partly', className: 'border-amber-500/55 text-amber-800 dark:text-amber-300' },
};

/** A plan item that wasn't done (or only partly): a dashed outline, so it reads as the gap it is. */
function Gap({ level, title }: { level: string; title: string }) {
  const m = MISS[level] ?? MISS.missed;
  return (
    <div className={cn('flex min-w-0 flex-col rounded-md border border-dashed px-2 py-1.5', m.className)}>
      <span className="text-[10px] font-bold tracking-wide uppercase opacity-80">{m.text}</span>
      <span className="line-clamp-2 text-xs font-medium">{title.replace(/^\P{L}+/u, '')}</span>
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
    <div className="flex gap-5">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <StepTitle title={ongoing ? 'This week so far' : 'How last week went'}
          sub={lw ? `${weekLabel(lw.monday)}, from Strava, Garmin and Lift${ongoing ? '. It isn\u2019t over yet.' : ''}` : 'No week before this one to look at yet.'} />
        {read.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" aria-label="Coach's read">
            <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-brand-ink uppercase">
              <Sparkles className="size-3.5" aria-hidden />Coach&apos;s read
            </span>
            {read.map((r) => (
              <span key={r.id} title={r.text}
                className={cn('rounded-full px-2.5 py-1 text-[13px] font-medium',
                  r.tone === 'good' ? 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300' : 'bg-amber-500/14 text-amber-900 dark:text-amber-200')}>
                {r.title}
              </span>
            ))}
          </div>
        )}
        {lw && (
          <>
            <div className="grid grid-cols-4 gap-3.5">
              <Tile label="Time" value={hm(lw.doneMin)} tone={ongoing ? 'neutral' : lw.doneMin < 480 ? 'warn' : 'good'} share={lw.doneMin / 480}
                note={ongoing ? 'So far' : lw.doneMin < 480 ? 'Under your 8–10 h week' : lw.plannedMin ? `of ${hm(lw.plannedMin)} planned` : 'A full week'} />
              <Tile label="Lifts" value={`${lw.lifts.done} of ${lw.lifts.planned}`} tone={lw.lifts.done < lw.lifts.planned ? 'warn' : lw.lifts.planned ? 'good' : 'neutral'}
                share={lw.lifts.planned ? lw.lifts.done / lw.lifts.planned : null}
                note={lw.lifts.done < lw.lifts.planned ? `${lw.lifts.planned - lw.lifts.done} missed` : lw.lifts.planned ? 'All done' : ongoing ? 'None due yet' : 'None planned'} />
              <Tile label="Hard sessions" value={`${lw.hard.done} of ${lw.hard.planned}`} tone={lw.hard.done < lw.hard.planned ? 'warn' : lw.hard.planned ? 'good' : 'neutral'}
                share={lw.hard.planned ? lw.hard.done / lw.hard.planned : null}
                note={lw.hard.done < lw.hard.planned ? `${lw.hard.planned - lw.hard.done} missed` : lw.hard.planned ? 'All done' : ongoing ? 'None due yet' : 'None planned'} />
              <Tile label="Fitness" value={fitness ? fitness.value.replace(' CTL', '') : '–'} note={form ? `Form ${form.value}, ${form.note ?? ''}`.replace(/, $/, '') : fitness?.note} />
            </div>
            <div className="grid grid-cols-7 gap-2.5">
              {lw.days.map((d) => {
                const ahead = d.date >= data.today;
                const missed = d.items.filter((i) => ['missed', 'skipped', 'partial'].includes(i.level));
                const coming = ahead ? d.items.filter((i) => !['good', 'done', 'partial'].includes(i.level)) : [];
                const nothing = d.done.length === 0 && missed.length === 0 && coming.length === 0;
                const doneMin = d.done.reduce((n, a) => n + a.min, 0);
                return (
                  <div key={d.date} className={cn('flex min-w-0 flex-col gap-2 rounded-2xl border p-3', nothing ? 'border-dashed bg-transparent' : 'bg-card')}>
                    <div className="flex items-baseline justify-between gap-1">
                      <span className={cn('text-[13px] font-semibold whitespace-nowrap', d.date === data.today && 'text-brand-ink')}>{weekday(d.date)} {dayNum(d.date)}</span>
                      {doneMin > 0 && <span className="text-xs text-muted-foreground tabular-nums">{hm(doneMin)}</span>}
                    </div>
                    {d.done.map((a, i) => (
                      <div key={i} className="flex min-w-0 flex-col gap-0.5 rounded-md border-l-[3px] px-2 py-1.5"
                        style={{ borderLeftColor: sportVar({ sport: a.sport, title: a.name }), background: `color-mix(in oklab, ${sportVar({ sport: a.sport, title: a.name })} 13%, var(--color-card))` }}>
                        <span className="line-clamp-2 text-xs font-semibold">{a.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{a.km ? `${a.km} km · ` : ''}{hm(a.min)}</span>
                      </div>
                    ))}
                    {missed.map((i, k) => <Gap key={k} level={i.level} title={i.title} />)}
                    {coming.map((i, k) => (
                      <div key={`c${k}`} className="rounded-md border px-2 py-1.5 text-xs text-muted-foreground">
                        <span className="block text-[10px] font-bold tracking-wide uppercase">Planned</span>
                        <span className="line-clamp-2">{i.title.replace(/^\P{L}+/u, '')}</span>
                      </div>
                    ))}
                    {nothing && <span className="m-auto text-xs text-muted-foreground">{ahead ? 'Nothing planned' : 'Rest'}</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="flex w-[380px] shrink-0 flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold">How are you coming into this week?</span>
            <span className="text-sm text-muted-foreground">Coach shapes the first days around it.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {FEELS.map((f) => (
              <Chip key={f.id} on={answers.feel === f.id} onClick={() => setAnswers({ ...answers, feel: answers.feel === f.id ? null : f.id })}
                className={cn(!answers.feel && data.context?.suggested.feel === f.id && 'border-brand/60')}>
                {f.label}
                {data.context?.suggested.feel === f.id && <span className="ml-1.5 text-[11px] opacity-70">Coach&apos;s read</span>}
              </Chip>
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
