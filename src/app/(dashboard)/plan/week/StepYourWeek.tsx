'use client';

import { useMemo } from 'react';
import { Input } from '@kobo/web';
import type { PlannerWeek } from '@/lib/plan/planner-week';
import { DAY_TYPES, dayModes, freeWindows, withDayMode, withDayNote } from '@/lib/plan/planner-steps.mjs';
import WeekGrid from './WeekGrid';
import { Segmented, type Answers } from './PlannerPanels';
import { Card, StepTitle } from './StepLastWeek';
import { dayNum, hm, weekday } from './plannerUi';

type DayType = (typeof DAY_TYPES)[number]['id'];
const OPTIONS = DAY_TYPES.map((t) => ({ v: t.id as DayType, label: t.label }));
const HINT = Object.fromEntries(DAY_TYPES.map((t) => [t.id, t.hint])) as Record<DayType, string>;

/**
 * Step 2: the week on Paolo's calendar, with the free windows Coach sees and the all-day events on top. He marks each
 * day free, busy, travelling, rest or sick, can add a note for it, and Coach plans around that. Days already gone in
 * this week are left as they were.
 */
export default function StepYourWeek({ data, answers, setAnswers }: { data: PlannerWeek; answers: Answers; setAnswers: (a: Answers) => void }) {
  const modes = dayModes(data.weekStart, answers);
  const byDate = Object.fromEntries(modes.map((m) => [m.date, m.mode])) as Record<string, DayType>;
  const windows = useMemo(
    () => Object.fromEntries(modes.map((m) => [m.date, m.date < data.today ? [] : freeWindows(data.calendar, m.date, { min: 90 })])),
    [data.calendar, data.today, modes],
  );
  const open = modes.filter((m) => m.date >= data.today);
  const count = (t: DayType) => open.filter((m) => m.mode === t).length;
  const summary = DAY_TYPES.map((t) => [count(t.id), t.id === 'free' ? 'free' : t.id === 'travel' ? 'travelling' : t.label.toLowerCase()] as const)
    .filter(([n], i) => n > 0 || i === 0)
    .map(([n, w], i) => (i === 0 ? `${n} free day${n === 1 ? '' : 's'}` : `${n} ${w}`))
    .join(', ');
  return (
    <div className="flex min-h-0 flex-1 gap-7">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <StepTitle title="What your week looks like" sub="From Google Calendar. Say what each day is, add a note if it helps, and Coach plans around it." />
        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border bg-card">
          <WeekGrid weekStart={data.weekStart} events={[]} calendar={data.calendar} selected={null} changed={new Set()} today={data.today}
            onSelect={() => {}} onMove={() => {}} windows={windows} modes={byDate} notes={answers.notes} where={data.where} />
        </div>
      </div>
      <div className="flex w-[400px] shrink-0 flex-col gap-3 overflow-auto">
        <Card className="flex flex-col">
          <span className="mb-1 text-[17px] font-semibold">Each day</span>
          {modes.map((m) => {
            const place = (d: string) => {
              const p = data.where.zones.length > 1 ? data.where.days.find((x) => x.date === d) : null;
              return p ? `${p.travel ? '✈ ' : ''}${p.short}` : null;
            };
            const gone = m.date < data.today;
            const longest = (windows[m.date] ?? []).reduce((n, w) => Math.max(n, w.minutes), 0);
            const trip = data.calendar.find((c) => c.date === m.date && (c.allDay || /flight|trip|travel|hotel/i.test(c.title)))?.title;
            const line = gone ? 'Done, kept as it was'
              : m.mode === 'free' ? (longest ? `Longest free window ${hm(longest)}` : 'Busy all day')
                : m.mode === 'travel' && trip ? `${trip}: no gym` : HINT[m.mode];
            return (
              <div key={m.date} className="flex flex-col gap-2 border-b py-3 last:border-b-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {weekday(m.date)} {dayNum(m.date)}
                    {place(m.date) && <span className="ml-1.5 text-xs font-medium text-sky-700 dark:text-sky-300">{place(m.date)}</span>}
                  </span>
                  <span className="truncate text-xs text-muted-foreground" title={line}>{line}</span>
                </div>
                {!gone && (
                  <>
                    <Segmented value={m.mode} options={OPTIONS} onChange={(v) => setAnswers(withDayMode(answers, m.date, v))} />
                    <Input
                      aria-label={`Note for ${weekday(m.date)} ${dayNum(m.date)}`}
                      placeholder="Add a note (dinner at 7, hotel has a gym…)"
                      value={m.note}
                      maxLength={200}
                      onChange={(e) => setAnswers(withDayNote(answers, m.date, e.target.value))}
                      className="h-8 text-sm"
                    />
                  </>
                )}
              </div>
            );
          })}
        </Card>
        <span className="px-1 text-sm text-muted-foreground">{summary}.</span>
      </div>
    </div>
  );
}
