'use client';

import { useMemo } from 'react';
import type { PlannerWeek } from '@/lib/plan/planner-week';
import { dayModes, freeWindows, withDayMode } from '@/lib/plan/planner-steps.mjs';
import WeekGrid from './WeekGrid';
import { Segmented, type Answers } from './PlannerPanels';
import { Card, StepTitle } from './StepLastWeek';
import { clock, dayNum, hm, weekday } from './plannerUi';

type Mode = 'free' | 'off' | 'away';
const MODES: { v: Mode; label: string }[] = [
  { v: 'free', label: 'Free' },
  { v: 'off', label: 'Off' },
  { v: 'away', label: 'Away' },
];

/**
 * Step 2: the week on Paolo's calendar, with the free windows Coach sees. He marks each day free, off (no training)
 * or away (travel: no gym), and Coach plans around the rest. Days already gone in this week are left as they were.
 */
export default function StepYourWeek({ data, answers, setAnswers }: { data: PlannerWeek; answers: Answers; setAnswers: (a: Answers) => void }) {
  const modes = dayModes(data.weekStart, answers);
  const byDate = Object.fromEntries(modes.map((m) => [m.date, m.mode])) as Record<string, Mode>;
  const windows = useMemo(
    () => Object.fromEntries(modes.map((m) => [m.date, m.date < data.today ? [] : freeWindows(data.calendar, m.date, { min: 90 })])),
    [data.calendar, data.today, modes],
  );
  const notes = data.calendar.filter((c) => c.allDay || c.minutes >= 180);
  const free = modes.filter((m) => m.mode === 'free' && m.date >= data.today).length;
  const away = modes.filter((m) => m.mode === 'away').length;
  return (
    <div className="flex min-h-0 flex-1 gap-7">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <StepTitle title="What your week looks like" sub="From Google Calendar. Mark the days that are off or away, and Coach plans around the rest." />
        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border bg-card">
          <WeekGrid weekStart={data.weekStart} events={[]} calendar={data.calendar} selected={null} changed={new Set()} today={data.today}
            onSelect={() => {}} onMove={() => {}} windows={windows} modes={byDate} />
        </div>
      </div>
      <div className="flex w-[380px] shrink-0 flex-col gap-4 overflow-auto">
        <Card className="flex flex-col">
          <span className="mb-2 text-[17px] font-semibold">Each day</span>
          {modes.map((m) => {
            const gone = m.date < data.today;
            const win = windows[m.date] ?? [];
            const longest = win.reduce((n, w) => Math.max(n, w.minutes), 0);
            const trip = data.calendar.find((c) => c.date === m.date && (c.allDay || /flight|trip|travel|hotel/i.test(c.title)))?.title;
            return (
              <div key={m.date} className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold">{weekday(m.date)} {dayNum(m.date)}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {gone ? 'Done, kept as it was' : m.mode === 'off' ? 'No training' : m.mode === 'away' ? (trip ? `${trip}: no gym, runs or rest` : 'No gym, runs or rest') : longest ? `Longest free window ${hm(longest)}` : 'Busy all day'}
                  </span>
                </div>
                {gone ? (
                  <span className="text-xs text-muted-foreground">Past</span>
                ) : (
                  <Segmented value={m.mode} options={MODES} onChange={(v) => setAnswers(withDayMode(answers, m.date, v))} />
                )}
              </div>
            );
          })}
        </Card>
        {notes.length > 0 && (
          <Card className="flex flex-col gap-2.5">
            <span className="text-[17px] font-semibold">On your calendar</span>
            {notes.slice(0, 6).map((c, i) => (
              <div key={i} className="flex gap-2.5 text-sm leading-5">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-500" />
                <span>{weekday(c.date)} {dayNum(c.date)}: {c.title}{c.allDay ? '' : `, ${clock(c.start)} for ${hm(c.minutes)}`}</span>
              </div>
            ))}
          </Card>
        )}
        <span className="px-1 text-sm text-muted-foreground">{free} free day{free === 1 ? '' : 's'}{away ? `, ${away} away` : ''}.</span>
      </div>
    </div>
  );
}
