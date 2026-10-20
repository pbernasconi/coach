'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Proposal } from '@/lib/plan/proposals';
import { acceptProposalAction, openProposalAction, rejectProposalAction, requestPlanAction } from './coachActions';

const FEELS = [
  { id: 'fresh', label: '🟢 Fresh' },
  { id: 'normal', label: '⚪ Normal' },
  { id: 'fatigued', label: '🟡 Fatigued' },
  { id: 'recovery', label: '🔴 Recovery week' },
] as const;
const FOCUSES = [
  { id: 'endurance', label: 'Endurance base' },
  { id: 'cycling', label: 'Cycling quality' },
  { id: 'running', label: 'Running quality' },
  { id: 'ski', label: 'Ski touring' },
  { id: 'test', label: 'Test week' },
] as const;

const weekLabel = (monday: string) =>
  `the week of ${new Date(`${monday}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
const POLL_MS = 20_000;

/**
 * The cloud coach on the Plan page: "Plan with Coach" sends a request (how you feel, the focus, what to lock) to the
 * cloud job; the bar then shows its state, and a ready plan opens for review with Accept and Reject. Nothing reaches
 * the calendar before Accept.
 */
export default function CoachPlanner({ initial, thisWeek, nextWeek }: { initial: Proposal | null; thisWeek: string; nextWeek: string }) {
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
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
      <Sparkles aria-hidden className="h-4 w-4 shrink-0 text-[#fc4c02]" />
      <span className="min-w-0 flex-1 text-[var(--viz-ink-2)]">
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
        <RequestDialog
          thisWeek={thisWeek}
          nextWeek={nextWeek}
          onClose={() => setAsking(false)}
          onSent={(p) => {
            setAsking(false);
            setProposal(p);
          }}
        />
      )}
      {reviewing && proposal?.status === 'proposed' && (
        <ReviewDialog proposal={proposal} onClose={() => setReviewing(false)} onDecided={() => { setReviewing(false); setProposal(null); }} />
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

function Shell({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background shadow-2xl outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[calc(100dvh-3rem)] sm:w-[min(48rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border"
        >
          <header className="flex shrink-0 items-center gap-2 border-b px-4 py-3 sm:px-6">
            <Dialog.Title className="flex-1 text-base font-semibold">{title}</Dialog.Title>
            <Dialog.Close aria-label="Close" className="rounded-md p-1.5 hover:bg-accent"><X aria-hidden className="h-5 w-5" /></Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">{children}</div>
          <footer className="flex shrink-0 justify-end gap-2 border-t px-4 py-3 sm:px-6">{footer}</footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: readonly { id: T; label: string }[]; value: T | null; onChange: (v: T | null) => void }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium text-[var(--viz-ink-2)]">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(value === o.id ? null : o.id)}
            className={cn('h-9 rounded-md border px-3 text-sm', value === o.id ? 'border-transparent bg-[#fc4c02] text-white' : 'hover:bg-accent')}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function RequestDialog({ thisWeek, nextWeek, onClose, onSent }: { thisWeek: string; nextWeek: string; onClose: () => void; onSent: (p: Proposal | null) => void }) {
  const [week, setWeek] = useState<'this' | 'next'>('next');
  const [feel, setFeel] = useState<(typeof FEELS)[number]['id'] | null>(null);
  const [focus, setFocus] = useState<(typeof FOCUSES)[number]['id'] | null>(null);
  const [lock, setLock] = useState('');
  const [pending, start] = useTransition();
  const send = () =>
    start(async () => {
      const r = await requestPlanAction({ kind: week === 'this' ? 'checkin' : 'weekly', weekStart: week === 'this' ? thisWeek : nextWeek, feel, focus, lock });
      if ('error' in r) {
        toast.error(r.error);
        return;
      }
      toast.success('Coach is planning. The plan shows here in a few minutes.');
      onSent(await openProposalAction());
    });
  return (
    <Shell
      title="Plan with Coach"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={send} className="bg-[#fc4c02] text-white hover:opacity-90">{pending ? 'Sending…' : 'Plan it'}</Button>
        </>
      }
    >
      <Choice
        label="Which week"
        options={[{ id: 'next', label: `Next week (${dayLabel(nextWeek)})` }, { id: 'this', label: 'The rest of this week (check-in)' }] as const}
        value={week}
        onChange={(v) => setWeek(v ?? 'next')}
      />
      <Choice label="How are you feeling? (empty: Coach reads it from the data)" options={FEELS} value={feel} onChange={setFeel} />
      <Choice label="This week's focus? (empty: Coach picks)" options={FOCUSES} value={focus} onChange={setFocus} />
      <label className="block space-y-1.5">
        <span className="block text-xs font-medium text-[var(--viz-ink-2)]">Anything to lock or skip?</span>
        <textarea
          value={lock}
          onChange={(e) => setLock(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Keep Bike Club on Thursday, no strength on Friday, travel on Saturday…"
          className="w-full rounded-md border bg-background px-2.5 py-2 text-sm"
        />
      </label>
    </Shell>
  );
}

function ReviewDialog({ proposal, onClose, onDecided }: { proposal: Proposal; onClose: () => void; onDecided: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const total = Math.round(proposal.rows.reduce((n, r) => n + (r.tss ?? 0), 0));
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
    <Shell
      title={`Coach's plan for ${weekLabel(proposal.weekStart)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" disabled={pending} onClick={reject}>Reject</Button>
          <Button disabled={pending} onClick={accept} className="bg-[#fc4c02] text-white hover:opacity-90">{pending ? 'Saving…' : 'Accept'}</Button>
        </>
      }
    >
      {proposal.summary && <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--viz-ink-2)]">{proposal.summary}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-[var(--viz-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Day</th>
              <th className="px-3 py-2 font-medium">Session</th>
              <th className="px-3 py-2 text-right font-medium">Time</th>
              <th className="px-3 py-2 text-right font-medium">TSS</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {proposal.rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">{dayLabel(r.date)}{r.startTime ? ` ${r.startTime}` : ''}</td>
                <td className="px-3 py-2">
                  <span className="text-[var(--viz-ink)]">{r.title}</span>
                  {r.why && <span className="block text-xs text-[var(--viz-muted)]">{r.why}</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.duration ? `${Math.floor(r.duration / 60)}:${String(r.duration % 60).padStart(2, '0')}` : '–'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.tss != null ? Math.round(r.tss) : '–'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t text-xs text-[var(--viz-muted)]">
            <tr><td className="px-3 py-2" colSpan={3}>Planned TSS for the week</td><td className="px-3 py-2 text-right tabular-nums">{total}</td></tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-[var(--viz-muted)]">
        Accept writes this week into Coach and onto your calendar, then plans the Lift sessions and the Garmin runs.
        Workouts you changed on the web stay as they are.
      </p>
    </Shell>
  );
}
