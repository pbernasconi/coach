'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, ArrowRight, Eye, Moon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import CalendarCard from '@/components/plan/CalendarCard';
import SportIcon from '@/components/SportIcon';
import WorkoutChart from '@/components/workouts/WorkoutChart';
import { cn } from '@/lib/utils';
import { dur } from '@/lib/plan/cells.mjs';
import { plainTitle } from '@/lib/plan/calendar.mjs';
import { formWord } from '@/lib/plan/planning-context.mjs';
import { summaryBlocks } from '@/lib/plan/review.mjs';
import { addDays } from '@/lib/plan/week.mjs';
import type { CalendarWorkout } from '@/lib/plan/month';
import type { WeekOutlook } from '@/lib/plan/planning-context';
import type { Proposal, ProposalRow } from '@/lib/plan/proposals';
import CoachDialog, { SectionTitle } from './CoachDialog';
import { acceptProposalAction, proposalOutlookAction, rejectProposalAction } from './coachActions';

const weekTitle = (monday: string) =>
  `Week of ${new Date(`${monday}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const signed = (n: number) => (n > 0 ? `+${Math.round(n)}` : `${Math.round(n)}`);

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

/**
 * The review of the coach's plan: the week as a calendar with each session's reason, the load it adds (from Coach's
 * own numbers), the key decisions and their trade-offs, and what to watch. Accept writes it; Reject changes nothing.
 */
export default function PlanReviewDialog({
  proposal,
  outlook: preloaded = null,
  onClose,
  onDecided,
}: {
  proposal: Proposal;
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

  const days = useMemo(() => {
    const workouts = proposal.rows.map(asWorkout);
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(proposal.weekStart, i);
      const all = workouts.filter((w) => w.date === date);
      const rest = all.find((w) => w.sport === 'rest') ?? null;
      const sessions = all.filter((w) => w.sport !== 'rest').sort((a, b) => (a.startTime ?? '99').localeCompare(b.startTime ?? '99'));
      return { date, dow: DOW[i], sessions, rest, tss: Math.round(sessions.reduce((n, w) => n + (w.tss ?? 0), 0)) };
    });
  }, [proposal]);
  const selected = proposal.rows.find((r) => r.id === open) ?? null;
  const review = proposal.review;
  const legacy = review ? [] : summaryBlocks(proposal.summary);

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
      title={`Coach's plan · ${weekTitle(proposal.weekStart)}`}
      subtitle={review?.headline ?? undefined}
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto hidden text-xs text-[var(--viz-muted)] sm:block">
            Accept adds it to Coach, your calendar, Lift and Garmin. Workouts you changed on the web stay.
          </span>
          <Button variant="outline" disabled={pending} onClick={reject}>Reject</Button>
          <Button disabled={pending} onClick={accept} className="bg-[#fc4c02] text-white hover:opacity-90">{pending ? 'Saving…' : 'Accept'}</Button>
        </>
      }
    >
      <Outlook outlook={outlook} rows={proposal.rows} />

      <section>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-7 sm:gap-0 sm:overflow-hidden sm:rounded-lg sm:border">
          {days.map((d, i) => (
            <div key={d.date} className={cn('flex min-w-0 flex-col gap-1.5 rounded-lg border p-2 sm:rounded-none sm:border-0', i > 0 && 'sm:border-l')}>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="font-semibold uppercase tracking-wide text-[var(--viz-muted)]">
                  {d.dow} <span className="text-[var(--viz-ink-2)]">{Number(d.date.slice(8))}</span>
                </span>
                {d.tss > 0 && <span className="tabular-nums text-[var(--viz-muted)]">{d.tss} TSS</span>}
              </div>
              {d.sessions.map((w) => (
                <div key={w.id} className="min-w-0">
                  <CalendarCard
                    item={{ kind: 'planned', key: w.id, w, actual: null }}
                    action={{ onClick: () => setOpen(open === w.id ? null : w.id) }}
                  />
                  {w.why && <p className="mt-1 line-clamp-4 px-0.5 text-[11px] leading-[15px] text-[var(--viz-ink-2)]">{w.why}</p>}
                </div>
              ))}
              {!d.sessions.length && (
                <div className="flex items-start gap-1 px-0.5 text-[11px] leading-[15px] text-[var(--viz-muted)]">
                  <Moon aria-hidden className="mt-px h-3 w-3 shrink-0" />
                  <span>Rest{d.rest?.why ? ` · ${d.rest.why}` : ''}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        {selected && <SessionDetail row={selected} onClose={() => setOpen(null)} />}
      </section>

      {review && review.decisions.length > 0 && (
        <section>
          <SectionTitle>Key decisions &amp; trade-offs</SectionTitle>
          <div className="grid gap-2 md:grid-cols-2">
            {review.decisions.map((d, i) => (
              <div key={i} className="rounded-lg border bg-card p-3">
                <div className="text-sm font-semibold text-[var(--viz-ink)]">{d.title}</div>
                {d.why && <p className="mt-1 text-sm leading-snug text-[var(--viz-ink-2)]">{d.why}</p>}
                {d.tradeoff && (
                  <p className="mt-2 flex gap-1.5 border-t pt-2 text-xs leading-snug text-[var(--viz-ink-2)]">
                    <ArrowLeftRight aria-hidden className="mt-0.5 h-3 w-3 shrink-0 text-[#fc4c02]" />
                    <span><span className="font-medium text-[var(--viz-ink)]">Trade-off:</span> {d.tradeoff}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {review && (review.reasoning.length > 0 || review.watch.length > 0) && (
        <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
          {review.reasoning.length > 0 && (
            <section>
              <SectionTitle>Why this week</SectionTitle>
              <ul className="space-y-1.5 text-sm leading-snug text-[var(--viz-ink-2)]">
                {review.reasoning.map((r, i) => (
                  <li key={i} className="flex gap-2"><span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--viz-muted)]" />{r}</li>
                ))}
              </ul>
            </section>
          )}
          {review.watch.length > 0 && (
            <section>
              <SectionTitle>Watch for</SectionTitle>
              <ul className="space-y-1.5 text-sm leading-snug text-[var(--viz-ink-2)]">
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
          <dl className="divide-y rounded-lg border text-sm">
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

/** The week's load against the last 4 weeks, and fitness and form going in and coming out. */
function Outlook({ outlook, rows }: { outlook: WeekOutlook | null | undefined; rows: ProposalRow[] }) {
  const sessions = rows.filter((r) => r.activityType !== 'rest');
  const min = sessions.reduce((n, r) => n + (r.duration ?? 0), 0);
  const tss = outlook?.plannedTss ?? Math.round(sessions.reduce((n, r) => n + (r.tss ?? 0), 0));
  const vsAvg = outlook?.avgTss ? Math.round(((tss - outlook.avgTss) / outlook.avgTss) * 100) : null;
  const cells: { label: string; value: React.ReactNode; note: React.ReactNode }[] = [
    {
      label: 'Load',
      value: <>{tss} <span className="text-xs font-normal text-[var(--viz-muted)]">TSS</span></>,
      note: outlook?.avgTss ? `${vsAvg != null && vsAvg >= 0 ? '+' : ''}${vsAvg} % vs ${outlook.avgTss}/wk avg` : outlook === undefined ? '…' : 'No recent weeks',
    },
    { label: 'Time', value: dur(min) || '0:00', note: `${sessions.length} sessions` },
    {
      label: 'Fitness',
      value: outlook?.start && outlook.end ? <Arrow from={Math.round(outlook.start.ctl)} to={Math.round(outlook.end.ctl)} /> : '–',
      note: outlook?.start && outlook.end ? `CTL ${signed(outlook.end.ctl - outlook.start.ctl)} by Sunday` : outlook === undefined ? '…' : 'No load history',
    },
    {
      label: 'Form',
      value: outlook?.start && outlook.end ? <Arrow from={signed(outlook.start.tsb)} to={signed(outlook.end.tsb)} /> : '–',
      note: outlook?.end ? `${formWord(outlook.end.tsb)} on Sunday` : outlook === undefined ? '…' : '',
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className="min-w-0 bg-card px-3 py-2.5">
          <div className="text-[11px] text-[var(--viz-muted)]">{c.label}</div>
          <div className="text-lg font-semibold leading-7 tabular-nums text-[var(--viz-ink)]">{c.value}</div>
          <div className="truncate text-xs text-[var(--viz-ink-2)]">{c.note}</div>
        </div>
      ))}
    </div>
  );
}

function Arrow({ from, to }: { from: React.ReactNode; to: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[var(--viz-muted)]">{from}</span>
      <ArrowRight aria-label="to" className="h-3.5 w-3.5 text-[var(--viz-muted)]" />
      {to}
    </span>
  );
}

/** The picked session: time, load, the reason and the full coach's description, with its chart. */
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
      {row.intensity && <p className="mt-2 text-sm text-[var(--viz-ink)]">{row.intensity}</p>}
      {row.steps && <WorkoutChart workout={row.steps} height={96} className="mt-2" />}
      {row.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-snug text-[var(--viz-ink-2)]">{row.description}</p>}
    </div>
  );
}
