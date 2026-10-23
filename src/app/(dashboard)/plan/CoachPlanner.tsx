'use client';

import { useEffect, useState, useTransition } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { Proposal } from '@/lib/plan/proposals';
import type { WeekOutlook } from '@/lib/plan/planning-context';
import type { DayWeather } from '@/lib/plan/weather';
import { openProposalAction, rejectProposalAction } from './coachActions';
import PlanRequestDialog from './PlanRequestDialog';
import PlanReviewDialog from './PlanReviewDialog';

const weekLabel = (monday: string) =>
  `the week of ${new Date(`${monday}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
const POLL_MS = 20_000;

/**
 * The cloud coach on the Plan page: "Plan with Coach" sends a request (how you feel, the focus, what to lock) to the
 * cloud job; the bar then shows its state, and a ready plan opens for review with Accept and Reject. Nothing reaches
 * the calendar before Accept.
 */
export default function CoachPlanner({
  initial,
  thisWeek,
  nextWeek,
  today,
  outlook = null,
  weather,
}: {
  initial: Proposal | null;
  thisWeek: string;
  nextWeek: string;
  today: string;
  /** The initial proposal's load outlook, loaded with the page. */
  outlook?: WeekOutlook | null;
  /** The forecast by day (/plan's), for the day heads. */
  weather: Record<string, DayWeather>;
}) {
  const [proposal, setProposal] = useState(initial);
  const [asking, setAsking] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const busy = proposal?.status === 'requested' || proposal?.status === 'running';

  // While the job runs, look again every 20 s (one small query), for at most 15 minutes.
  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const t = setInterval(async () => {
      if (Date.now() - started > 15 * 60_000) return clearInterval(t);
      try {
        const p = await openProposalAction();
        setProposal(p);
        if (p?.status === 'proposed') toast.success(`Coach's plan for ${weekLabel(p.weekStart)} is ready.`);
      } catch {
        // The next tick tries again.
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [busy]);

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card py-1 pl-3 pr-1 text-sm">
      <Sparkles aria-hidden className="h-4 w-4 shrink-0 text-[#fc4c02]" />
      <span className="min-w-0 flex-1 truncate text-[var(--viz-ink-2)]">
        {!proposal && 'Coach plans next week every Sunday morning. Plan any week now, with how you feel.'}
        {busy && (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> Coach is planning {weekLabel(proposal.weekStart)}. This takes a few minutes.
          </span>
        )}
        {proposal?.status === 'proposed' && `Coach's plan for ${weekLabel(proposal.weekStart)} is ready for you.`}
        {proposal?.status === 'failed' && <span className="text-rose-600 dark:text-rose-400">The plan for {weekLabel(proposal.weekStart)} failed: {proposal.error}</span>}
      </span>
      {proposal?.status === 'proposed' && (
        <Button size="sm" onClick={() => setReviewing(true)} className="bg-[#fc4c02] text-white hover:opacity-90">Review</Button>
      )}
      {proposal?.status === 'failed' && <DismissButton id={proposal.id} onDone={() => setProposal(null)} />}
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setAsking(true)}>Plan with Coach</Button>
      {asking && (
        <PlanRequestDialog
          thisWeek={thisWeek}
          nextWeek={nextWeek}
          today={today}
          weather={weather}
          onClose={() => setAsking(false)}
          onSent={(p) => {
            setAsking(false);
            setProposal(p);
          }}
        />
      )}
      {reviewing && proposal?.status === 'proposed' && (
        <PlanReviewDialog proposal={proposal} today={today} weather={weather} outlook={proposal.id === initial?.id ? outlook : null} onClose={() => setReviewing(false)} onDecided={() => { setReviewing(false); setProposal(null); }} />
      )}
    </div>
  );
}

function DismissButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await rejectProposalAction(id); onDone(); })}>
      Dismiss
    </Button>
  );
}
