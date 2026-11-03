'use client';

import { Check } from 'lucide-react';
import { Textarea, cn } from '@kobo/web';
import type { PlannerWeek } from '@/lib/plan/planner-week';
import { hourSplit, roughSplit } from '@/lib/plan/planner-steps.mjs';
import { Segmented, type Answers } from './PlannerPanels';
import { Card, StepTitle } from './StepLastWeek';
import { days, hm } from './plannerUi';

const MIN_H = 4;
const MAX_H = 14;
const pct = (h: number) => `${((h - MIN_H) / (MAX_H - MIN_H)) * 100}%`;

function Goal({ goal, color, title, note, children }: { goal: string; color: string; title: string; note: string; children?: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-2.5 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: `color-mix(in oklab, ${color} 75%, var(--color-foreground))` }}>{goal}</span>
        <span className="size-2.5 rounded-full" style={{ background: color }} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[17px] font-semibold">{title}</span>
        {children}
      </div>
      <span className="text-sm leading-5 text-muted-foreground">{note}</span>
    </Card>
  );
}

const RULES = [
  'One session a day, or two back to back. Never one in the morning and one at night.',
  'Hard days at least 48 h apart, and nothing hard the day before the long run.',
  'Only what fits your free windows.',
];

/**
 * Step 3: what the week should do. Hours (his normal week is 8–10 h), then each goal and what it gets: lifts for
 * the arms, hard sessions for the engine, the long run, easy aerobic volume and physio. "Auto" leaves it to Coach.
 */
export default function StepShape({ data, answers, setAnswers }: { data: PlannerWeek; answers: Answers; setAnswers: (a: Answers) => void }) {
  const week = days(data.weekStart);
  const suggested = data.context?.suggested.hours ?? 9;
  const hours = answers.hours ?? suggested;
  const ready = data.proposal?.status === 'proposed' && data.events.length > 0;
  const rough = roughSplit({ hours, gym: answers.gym ?? 2, hard: answers.hard ?? 2 });
  const split = ready ? hourSplit(data.events) : null;
  // Easy aerobic in the draft: the easy runs and rides, less the long run.
  const easy = data.events.filter((e) => !e.hard && (e.sport === 'run' || e.sport === 'ride')).sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0));
  const longRun = easy.find((e) => e.sport === 'run');
  const easyMin = ready ? easy.filter((e) => e !== longRun).reduce((n, e) => n + (e.minutes ?? 0), 0) : rough.easy;
  const total = ready ? data.events.reduce((n, e) => n + (e.minutes ?? 0), 0) : rough.total;
  const parts = split
    ? [
        { label: 'Run', min: split.run, color: 'var(--sport-run)' },
        { label: 'Ride', min: split.ride, color: 'var(--sport-ride)' },
        { label: 'Lift', min: split.lift, color: 'var(--sport-strength)' },
        { label: 'Physio', min: split.physio, color: 'var(--sport-yoga)' },
        { label: 'Other', min: split.other, color: 'var(--sport-other)' },
      ]
    : [
        { label: 'Lifts', min: rough.lift, color: 'var(--sport-strength)' },
        { label: 'Hard sessions', min: rough.quality, color: 'var(--sport-run)' },
        { label: 'Long run', min: rough.long, color: 'var(--sport-run)' },
        { label: 'Easy aerobic', min: rough.easy, color: 'var(--sport-ride)' },
        { label: 'Physio', min: rough.physio, color: 'var(--sport-yoga)' },
      ];
  return (
    <div className="flex gap-7">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <StepTitle title="What this week should do" sub="Set from your goals and last week. Change any of them, or leave them to Coach." />
        <Card className="flex flex-col gap-3.5 px-6">
          <div className="flex items-baseline justify-between">
            <label htmlFor="plan-hours" className="text-[17px] font-semibold">Hours this week</label>
            <span className="text-3xl font-semibold tracking-tight tabular-nums">{answers.hours == null ? `~${hours} h` : `${hours} h`}</span>
          </div>
          <div className="relative h-8">
            <div className="absolute inset-x-0 top-3.5 h-1.5 rounded-full bg-muted" />
            <div className="absolute top-2.5 h-3.5 rounded-full bg-brand/20" style={{ left: pct(8), width: `calc(${pct(10)} - ${pct(8)})` }} />
            <div className="absolute top-3.5 left-0 h-1.5 rounded-full bg-brand" style={{ width: pct(hours) }} />
            <input id="plan-hours" type="range" min={MIN_H} max={MAX_H} step={1} value={hours} aria-valuetext={`${hours} hours`}
              onChange={(e) => setAnswers({ ...answers, hours: Number(e.target.value) })}
              className="absolute inset-0 w-full cursor-pointer appearance-none bg-transparent accent-brand [&::-webkit-slider-runnable-track]:bg-transparent" />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{MIN_H} h</span>
            <span className="font-semibold text-brand-ink">8–10 h · your normal week</span>
            <span>{MAX_H} h</span>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3.5">
          <Goal goal="Bigger arms" color="var(--sport-strength)" title="Lifts" note="Arm-first and full body, with curls in each.">
            <Segmented value={answers.gym} onChange={(v) => setAnswers({ ...answers, gym: v })}
              options={[{ v: null, label: 'Auto' }, { v: 1, label: '1' }, { v: 2, label: '2' }, { v: 3, label: '3' }]} />
          </Goal>
          <Goal goal="Faster engine" color="var(--sport-run)" title="Hard sessions" note="Threshold and VO2 work, at least 48 h apart.">
            <Segmented value={answers.hard} onChange={(v) => setAnswers({ ...answers, hard: v })}
              options={[{ v: null, label: 'Auto' }, { v: 0, label: '0' }, { v: 1, label: '1' }, { v: 2, label: '2' }]} />
          </Goal>
          <Goal goal="Keep long runs" color="var(--sport-run)" title="Long day" note="The week's long run, easy all the way.">
            <Segmented value={answers.longDay} onChange={(v) => setAnswers({ ...answers, longDay: v })}
              options={[{ v: null, label: 'Auto' }, { v: week[5], label: 'Sat' }, { v: week[6], label: 'Sun' }]} />
          </Goal>
          <Goal goal="Lose belly fat" color="var(--sport-ride)" title="Easy aerobic" note="Z2 rides and easy runs fill the rest of your hours.">
            <span className="text-[17px] font-semibold text-muted-foreground tabular-nums">{hm(easyMin)}</span>
          </Goal>
        </div>
        <Card className="flex items-center gap-4 py-4">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: 'var(--sport-yoga)' }} />
          <span className="w-28 text-[15px] font-semibold">Physio</span>
          <span className="flex-1 text-sm text-muted-foreground">A for Achilles and calf, B for knee and hip. 20 min each, straight after a session.</span>
          <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'color-mix(in oklab, var(--sport-yoga) 16%, transparent)', color: 'color-mix(in oklab, var(--sport-yoga) 70%, var(--color-foreground))' }}>Always in</span>
        </Card>
      </div>

      <div className="flex w-[400px] shrink-0 flex-col gap-4">
        <Card className="flex flex-col gap-3.5">
          <span className="text-[17px] font-semibold">{split ? `Where the ${hm(total)} goes` : `Where ${hours} h goes, roughly`}</span>
          <div className="flex h-4 gap-0.5 overflow-hidden rounded-full">
            {parts.filter((p) => p.min > 0).map((p) => <div key={p.label} style={{ width: `${(p.min / Math.max(1, total)) * 100}%`, background: p.color }} />)}
          </div>
          <div className="flex flex-col gap-2 text-sm">
            {parts.filter((p) => p.min > 0).map((p) => (
              <div key={p.label} className="flex items-center gap-2.5">
                <span className="size-2.5 rounded-[3px]" style={{ background: p.color }} />
                <span className="flex-1">{p.label}</span>
                <span className="font-semibold tabular-nums">{hm(p.min)}</span>
              </div>
            ))}
          </div>
          <span className="border-t pt-3 text-[13px] text-muted-foreground">
            {split ? 'From the current draft. Redraw to change it.' : 'Coach sets the exact split when it drafts.'}
            {data.lastWeek ? ` ${data.lastWeek.ongoing ? 'This week so far' : 'Last week'}: ${hm(data.lastWeek.doneMin)}.` : ''}
          </span>
        </Card>
        <Card className="flex flex-col gap-2.5">
          <span className="text-[17px] font-semibold">Rules Coach keeps</span>
          {RULES.map((r) => (
            <div key={r} className="flex gap-2.5 text-sm leading-5">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{r}</span>
            </div>
          ))}
        </Card>
        <Card className="flex flex-col gap-2.5 py-4">
          <label htmlFor="plan-lock" className="text-[15px] font-semibold">Anything else for this week?</label>
          <Textarea id="plan-lock" rows={2} value={answers.lock} maxLength={500} placeholder="A club ride Saturday, ride outside if it's dry"
            onChange={(e) => setAnswers({ ...answers, lock: e.target.value })} className={cn('resize-none')} />
        </Card>
      </div>
    </div>
  );
}
