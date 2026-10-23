'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { addDays } from '@/lib/plan/week.mjs';
import type { PlanningContext, PlanningFact } from '@/lib/plan/planning-context';
import type { Proposal } from '@/lib/plan/proposals';
import type { DayWeather } from '@/lib/plan/weather';
import { WeatherIcon } from '@/components/plan/WeatherBadge';
import CoachDialog, { Choice, SectionTitle } from './CoachDialog';
import { openProposalAction, planningContextAction, requestPlanAction } from './coachActions';

const FEELS = [
  { id: 'fresh', label: 'Fresh', dot: 'bg-emerald-500' },
  { id: 'normal', label: 'Normal', dot: 'bg-zinc-400' },
  { id: 'fatigued', label: 'Fatigued', dot: 'bg-amber-400' },
  { id: 'recovery', label: 'Recovery week', dot: 'bg-rose-500' },
] as const;
const FOCUSES = [
  { id: 'endurance', label: 'Endurance base' },
  { id: 'cycling', label: 'Cycling quality' },
  { id: 'running', label: 'Running quality' },
  { id: 'ski', label: 'Ski touring' },
  { id: 'test', label: 'Test week' },
] as const;
const HOURS = [4, 6, 8, 10, 12, 14] as const;
const GYM = [0, 1, 2, 3] as const;
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Feel = (typeof FEELS)[number]['id'];
type Focus = (typeof FOCUSES)[number]['id'];

const dayLabel = (d: string) => `Mon ${Number(d.slice(8))}`;
const TONE_DOT: Record<PlanningFact['tone'], string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-400',
  bad: 'bg-rose-500',
  neutral: 'bg-zinc-300 dark:bg-zinc-600',
};

/**
 * "Plan with Coach": what Coach already knows (fitness, form, recent weeks, readiness, how sessions felt, skips, the
 * next event, the week's calendar), then Paolo's answers for the week. Empty answers leave the call to Coach.
 */
export default function PlanRequestDialog({
  thisWeek,
  nextWeek,
  today,
  weather,
  onClose,
  onSent,
  preload,
}: {
  /** Facts already loaded for a week (skips the first fetch). */
  preload?: { week: string; data: PlanningContext | null };
  thisWeek: string;
  nextWeek: string;
  today: string;
  weather: Record<string, DayWeather>;
  onClose: () => void;
  onSent: (p: Proposal | null) => void;
}) {
  const [week, setWeek] = useState<'this' | 'next'>('next');
  const weekStart = week === 'this' ? thisWeek : nextWeek;
  const [ctx, setCtx] = useState<{ week: string; data: PlanningContext | null } | null>(preload ?? null);
  const [feel, setFeel] = useState<Feel | null>(null);
  const [feelTouched, setFeelTouched] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [hours, setHours] = useState<number | null>(null);
  const [gym, setGym] = useState<number | null>(null);
  const [daysOff, setDaysOff] = useState<string[]>([]);
  const [lock, setLock] = useState('');
  const [pending, start] = useTransition();

  useEffect(() => {
    if (preload?.week === weekStart) return;
    let live = true;
    planningContextAction(weekStart)
      .then((data) => live && setCtx({ week: weekStart, data }))
      .catch(() => live && setCtx({ week: weekStart, data: null }));
    return () => {
      live = false;
    };
  }, [weekStart, preload?.week]);

  const data = ctx?.week === weekStart ? ctx.data : null;
  const loading = ctx?.week !== weekStart;
  // The data's feel is the starting answer until Paolo picks one.
  const suggestedFeel = (data?.suggested.feel as Feel | undefined) ?? null;
  const shownFeel = feelTouched ? feel : suggestedFeel;

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const toggleDay = (d: string) => setDaysOff((o) => (o.includes(d) ? o.filter((x) => x !== d) : [...o, d]));

  const send = () =>
    start(async () => {
      const r = await requestPlanAction({
        kind: week === 'this' ? 'checkin' : 'weekly',
        weekStart,
        feel: shownFeel,
        focus,
        lock,
        hours,
        gym,
        daysOff: daysOff.filter((d) => d >= weekStart && d <= addDays(weekStart, 6)),
      });
      if ('error' in r) {
        toast.error(r.error);
        return;
      }
      toast.success('Coach is planning. The plan shows here in a few minutes.');
      onSent(await openProposalAction());
    });

  return (
    <CoachDialog
      title="Plan with Coach"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={send}>{pending ? 'Sending…' : 'Plan it'}</Button>
        </>
      }
    >
      <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Which week">
        {(
          [
            ['next', `Next week · ${dayLabel(nextWeek)}`],
            ['this', 'Rest of this week'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={week === id}
            onClick={() => setWeek(id)}
            className={cn('h-8 rounded-md px-3 text-sm', week === id ? 'bg-brand-soft font-medium text-brand-ink' : 'text-[var(--viz-ink-2)] hover:bg-accent')}
          >
            {label}
          </button>
        ))}
      </div>

      <section>
        <SectionTitle>What Coach sees</SectionTitle>
        {loading ? (
          <div role="status" aria-label="Loading" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-[68px] animate-pulse bg-card" />
            ))}
          </div>
        ) : data && data.facts.length ? (
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
            {data.facts.map((f) => (
              <div key={f.id} className="min-w-0 bg-card px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--viz-muted)]">
                  <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[f.tone])} />
                  {f.label}
                </div>
                <div className="truncate text-sm font-semibold tabular-nums text-[var(--viz-ink)]" title={f.value}>{f.value}</div>
                {f.note && <div className="truncate text-xs text-[var(--viz-ink-2)]" title={f.note}>{f.note}</div>}
              </div>
            ))}
            {data.facts.length % 2 !== 0 && <div className="bg-card sm:hidden" />}
            {data.facts.length % 4 !== 0 && <div className="hidden bg-card sm:block" style={{ gridColumn: `span ${4 - (data.facts.length % 4)}` }} />}
          </div>
        ) : (
          <p className="text-sm text-[var(--viz-muted)]">No recent data to show. Coach still reads your full profile.</p>
        )}
      </section>

      <section className="space-y-4">
        <SectionTitle>Your week</SectionTitle>
        <Choice
          label="How do you feel?"
          hint={!feelTouched && data?.suggested.feelWhy ? data.suggested.feelWhy : undefined}
          options={FEELS.map((f) => ({ id: f.id, label: <><span aria-hidden className={cn('h-2 w-2 rounded-full', f.dot)} />{f.label}</> }))}
          value={shownFeel}
          onChange={(v) => {
            setFeelTouched(true);
            setFeel(v);
          }}
        />
        <Choice
          label="Time available"
          options={HOURS.map((h) => ({ id: h, label: `${h} h`, badge: data?.suggested.hours && h === nearest(data.suggested.hours) ? 'avg' : undefined }))}
          value={hours}
          onChange={setHours}
        />
        <fieldset className="space-y-1.5">
          <legend className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-[var(--viz-ink)]">
            Days off
          </legend>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              const off = daysOff.includes(d);
              const past = d < today;
              const note = data?.days[d];
              const wx = d >= today ? weather[d] : undefined;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={off}
                  disabled={past}
                  onClick={() => toggleDay(d)}
                  title={note}
                  className={cn(
                    'flex min-w-0 flex-col items-start rounded-md border px-1.5 py-1 text-left transition-colors disabled:opacity-40',
                    off ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40' : 'hover:bg-accent'
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-1">
                    <span className={cn('text-[10px] font-semibold uppercase tracking-wide text-[var(--viz-muted)]', off && 'text-rose-700 line-through dark:text-rose-300')}>
                      {DOW[i]} <span className="text-[var(--viz-ink)]">{Number(d.slice(8))}</span>
                    </span>
                    {wx && <WeatherIcon w={wx} />}
                  </span>
                  <span className="w-full truncate text-[10px] text-[var(--viz-muted)]">{off ? 'Off' : note ?? ' '}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <Choice label="Gym sessions" options={GYM.map((g) => ({ id: g, label: String(g) }))} value={gym} onChange={setGym} />
          <Choice label="Focus" options={FOCUSES} value={focus} onChange={setFocus} />
        </div>
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-[var(--viz-ink)]">Notes</span>
          <textarea
            value={lock}
            onChange={(e) => setLock(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Keep Bike Club Thursday. Long ride with friends Saturday. Knee a bit sore."
            className="w-full rounded-md border bg-background px-2.5 py-2 text-sm"
          />
        </label>
      </section>
    </CoachDialog>
  );
}

/** The hour chip closest to an average. */
function nearest(h: number) {
  return HOURS.reduce((best, x) => (Math.abs(x - h) < Math.abs(best - h) ? x : best), HOURS[0]);
}
