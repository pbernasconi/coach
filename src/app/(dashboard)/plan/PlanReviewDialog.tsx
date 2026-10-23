'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, Eye, Moon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import CalendarCard from '@/components/plan/CalendarCard';
import { AgendaDayLabel, CalendarDayHead, dayCellClass } from '@/components/plan/CalendarDay';
import SportIcon from '@/components/SportIcon';
import WeatherBadge from '@/components/plan/WeatherBadge';
import WorkoutChart from '@/components/workouts/WorkoutChart';
import { cn } from '@/lib/utils';
import { dur } from '@/lib/plan/cells.mjs';
import { plainTitle } from '@/lib/plan/calendar.mjs';
import { summaryBlocks } from '@/lib/plan/review.mjs';
import { addDays } from '@/lib/plan/week.mjs';
import type { CalendarWorkout, WeekSummary } from '@/lib/plan/month';
import type { WeekOutlook } from '@/lib/plan/planning-context';
import type { Proposal, ProposalRow } from '@/lib/plan/proposals';
import type { DayWeather } from '@/lib/plan/weather';
import { COLS } from './calendarShared';
import CoachDialog, { SectionTitle } from './CoachDialog';
import { WeekColumn, WeekTotals } from './WeekColumn';
import { acceptProposalAction, proposalOutlookAction, rejectProposalAction } from './coachActions';

const weekTitle = (monday: string) =>
  `Week of ${new Date(`${monday}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;

/** A proposal row as a calendar workout, so the shared CalendarCard draws it as on /plan (upcoming, grey chart). */
function asWorkout(r: ProposalRow, i: number): CalendarWorkout {
  return {
    id: r.id, date: r.date, startTime: r.startTime, endTime: null, title: r.title, sport: r.activityType, workoutType: r.workoutType,
    intensity: r.intensity, duration: r.duration, tss: r.tss, why: r.why, description: r.description, status: 'planned',
    skipReason: null, adaptedFrom: null, sortOrder: i, steps: r.steps, state: 'planned', match: null,
    compliance: { level: 'planned', label: 'Planned', ratio: null, basis: null }, actual: null, imported: false, lift: null,
    liftSessionId: null, syncs: {},
  };
}

type ReviewDay = { date: string; sessions: CalendarWorkout[]; rest: CalendarWorkout | null };

/**
 * The review of the coach's plan: the week as a /plan week row (day heads with the weather, the same cards, the
 * week column with the end-of-week fitness Coach projects), each session's reason, the key decisions and their
 * trade-offs, and what to watch. Accept writes it; Reject changes nothing.
 */
export default function PlanReviewDialog({
  proposal,
  today,
  weather,
  outlook: preloaded = null,
  onClose,
  onDecided,
}: {
  proposal: Proposal;
  today: string;
  weather: Record<string, DayWeather>;
  /** Loaded with the page; without it the dialog asks for it. */
  outlook?: WeekOutlook | null;
  onClose: () => void;
  onDecided: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fetched, setFetched] = useState<WeekOutlook | null | undefined>(undefined);
  const outlook = preloaded ?? fetched;
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (preloaded) return;
    let live = true;
    proposalOutlookAction(proposal.id).then((o) => live && setFetched(o)).catch(() => live && setFetched(null));
    return () => {
      live = false;
    };
  }, [proposal.id, preloaded]);

  const days: ReviewDay[] = useMemo(() => {
    const workouts = proposal.rows.map(asWorkout);
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(proposal.weekStart, i);
      const all = workouts.filter((w) => w.date === date);
      const sessions = all.filter((w) => w.sport !== 'rest').sort((a, b) => (a.startTime ?? '99').localeCompare(b.startTime ?? '99'));
      return { date, sessions, rest: all.find((w) => w.sport === 'rest') ?? null };
    });
  }, [proposal]);
  const summary: WeekSummary = useMemo(() => {
    const sessions = proposal.rows.filter((r) => r.activityType !== 'rest');
    const weekEnd = addDays(proposal.weekStart, 6);
    return {
      monday: proposal.weekStart,
      done: { min: 0, km: 0, tss: 0, count: 0, liftSessions: 0, bySport: {} },
      planned: {
        min: sessions.reduce((n, r) => n + (r.duration ?? 0), 0),
        tss: outlook?.plannedTss ?? Math.round(sessions.reduce((n, r) => n + (r.tss ?? 0), 0)),
        count: sessions.length,
        done: 0,
        missed: 0,
      },
      fitness: outlook?.end ? { date: weekEnd, ...outlook.end } : null,
    };
  }, [proposal, outlook]);

  const selected = proposal.rows.find((r) => r.id === open) ?? null;
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));
  const review = proposal.review;
  const legacy = review ? [] : summaryBlocks(proposal.summary);
  const wx = (d: string) => (d >= today ? weather[d] : undefined);

  const accept = () =>
    start(async () => {
      const r = await acceptProposalAction(proposal.id);
      if ('error' in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`Plan saved and on your calendar. ${r.note}`);
      onDecided();
      router.push(`/plan?week=${r.weekStart}`);
      router.refresh();
    });
  const reject = () =>
    start(async () => {
      await rejectProposalAction(proposal.id);
      toast('Plan rejected. Nothing changed.');
      onDecided();
    });

  return (
    <CoachDialog
      wide
      title={weekTitle(proposal.weekStart)}
      subtitle={review?.headline ?? undefined}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" disabled={pending} onClick={reject}>Reject</Button>
          <Button disabled={pending} onClick={accept} title="Adds it to Coach, your calendar, Lift and Garmin">
            {pending ? 'Saving…' : 'Accept'}
          </Button>
        </>
      }
    >
      <section>
        {/* Tablet and desktop: one /plan week row. */}
        <div className={cn(COLS, 'hidden overflow-hidden rounded-lg border sm:grid')}>
          {days.map((d) => (
            <div key={d.date} className={cn(dayCellClass(d.date, today), 'gap-1 pb-1.5')}>
              <CalendarDayHead date={d.date} today={today} weather={wx(d.date)} weekdayLabel />
              {d.sessions.map((w) => <Session key={w.id} w={w} open={open === w.id} onOpen={toggle} />)}
              {!d.sessions.length && <RestNote rest={d.rest} />}
            </div>
          ))}
          <WeekColumn s={summary} monday={proposal.weekStart} today={today} />
        </div>
        {/* Phone: the agenda. */}
        <div className="overflow-hidden rounded-lg border sm:hidden">
          <header className="border-b bg-[var(--viz-surface)] px-3 py-2"><WeekTotals s={summary} plannedOnly /></header>
          <ul className="divide-y">
            {days.map((d) => (
              <li key={d.date} className="flex gap-3 px-3 py-2">
                <AgendaDayLabel date={d.date} today={today} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  {wx(d.date) && <div className="flex justify-end"><WeatherBadge w={wx(d.date)!} date={d.date} /></div>}
                  {d.sessions.map((w) => <Session key={w.id} w={w} open={open === w.id} onOpen={toggle} roomy />)}
                  {!d.sessions.length && <RestNote rest={d.rest} />}
                </div>
              </li>
            ))}
          </ul>
        </div>
        {selected && <SessionDetail row={selected} onClose={() => setOpen(null)} />}
      </section>

      {review && review.decisions.length > 0 && (
        <section>
          <SectionTitle>Key decisions &amp; trade-offs</SectionTitle>
          <div className="grid gap-2 md:grid-cols-2">
            {review.decisions.map((d, i) => (
              <div key={i} className="rounded-lg border bg-card px-3 py-2.5">
                <div className="text-sm font-semibold text-[var(--viz-ink)]">{d.title}</div>
                {d.why && <p className="mt-0.5 text-[13px] leading-snug text-[var(--viz-ink-2)]">{d.why}</p>}
                {d.tradeoff && (
                  <p className="mt-1.5 flex gap-1.5 text-xs leading-snug text-[var(--viz-ink-2)]">
                    <ArrowLeftRight aria-label="Trade-off" className="mt-0.5 h-3 w-3 shrink-0 text-brand-ink" />
                    {d.tradeoff}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {review && (review.reasoning.length > 0 || review.watch.length > 0) && (
        <div className="grid gap-5 md:grid-cols-2">
          {review.reasoning.length > 0 && (
            <section>
              <SectionTitle>Why</SectionTitle>
              <ul className="space-y-1 text-[13px] leading-snug text-[var(--viz-ink-2)]">
                {review.reasoning.map((r, i) => (
                  <li key={i} className="flex gap-2"><span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--viz-muted)]" />{r}</li>
                ))}
              </ul>
            </section>
          )}
          {review.watch.length > 0 && (
            <section>
              <SectionTitle>Watch</SectionTitle>
              <ul className="space-y-1 text-[13px] leading-snug text-[var(--viz-ink-2)]">
                {review.watch.map((w, i) => (
                  <li key={i} className="flex gap-2"><Eye aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />{w}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {legacy.length > 0 && (
        <section>
          <SectionTitle>Coach&apos;s notes</SectionTitle>
          <dl className="divide-y rounded-lg border text-[13px]">
            {legacy.map((b, i) => (
              <div key={i} className="grid gap-1 px-3 py-2 sm:grid-cols-[9rem_1fr] sm:gap-3">
                <dt className="font-medium text-[var(--viz-ink)]">{b.title ?? 'Summary'}</dt>
                <dd className="space-y-1 leading-snug text-[var(--viz-ink-2)]">{b.lines.map((l, j) => <p key={j}>{l}</p>)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </CoachDialog>
  );
}

/** A planned session: the /plan card, with the coach's reason under it (two lines; the detail has it all). */
function Session({ w, open, onOpen, roomy = false }: { w: CalendarWorkout; open: boolean; onOpen: (id: string) => void; roomy?: boolean }) {
  return (
    <div className={cn('min-w-0 rounded-[6px]', open && 'ring-2 ring-brand/60')}>
      <CalendarCard item={{ kind: 'planned', key: w.id, w, actual: null }} roomy={roomy} action={{ onClick: () => onOpen(w.id) }} />
      {w.why && <p className="mt-0.5 line-clamp-2 px-0.5 text-[11px] leading-[14px] text-[var(--viz-muted)]">{w.why}</p>}
    </div>
  );
}

function RestNote({ rest }: { rest: CalendarWorkout | null }) {
  return (
    <div className="flex items-start gap-1 px-0.5 text-[11px] leading-[14px] text-[var(--viz-muted)]" title={rest?.why ?? undefined}>
      <Moon aria-hidden className="mt-px h-3 w-3 shrink-0" />
      <span className="line-clamp-2">Rest{rest?.why ? ` · ${rest.why}` : ''}</span>
    </div>
  );
}

/** The picked session: time, load, the reason and the coach's full description, with its chart. */
function SessionDetail({ row, onClose }: { row: ProposalRow; onClose: () => void }) {
  const day = new Date(`${row.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
  return (
    <div className="mt-3 rounded-lg border bg-card p-3 sm:p-4">
      <div className="flex items-start gap-2">
        <SportIcon id={row.activityType} className="mt-0.5 h-4 w-4" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--viz-ink)]">{plainTitle(row.title)}</div>
          <div className="text-xs tabular-nums text-[var(--viz-muted)]">
            {[day, row.startTime, row.duration ? dur(row.duration) : null, row.tss != null ? `${Math.round(row.tss)} TSS` : null].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xs text-[var(--viz-muted)] hover:bg-accent">Close</button>
      </div>
      {row.why && <p className="mt-2 text-[13px] text-[var(--viz-ink)]">{row.why}</p>}
      {row.steps && <WorkoutChart workout={row.steps} height={96} className="mt-2" />}
      {row.description && <p className="mt-2 whitespace-pre-wrap text-[13px] leading-snug text-[var(--viz-ink-2)]">{row.description}</p>}
    </div>
  );
}
