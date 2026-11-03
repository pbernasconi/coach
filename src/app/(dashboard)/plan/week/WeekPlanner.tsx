'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button, buttonVariants, cn } from '@kobo/web';
import CoachMark from '@/components/brand/CoachMark';
import type { PlannerWeek } from '@/lib/plan/planner-week';
import { STEPS, firstStep, suggestAway, upcomingWeeks } from '@/lib/plan/planner-steps.mjs';
import PlanWeekMenu from '@/components/plan/PlanWeekMenu';
import { acceptDraftAction, draftWeekAction, editDraftAction, plannerWeekAction, reviseDraftAction, undoDraftAction } from './actions';
import WeekGrid from './WeekGrid';
import { CoachPanel, Composer, SessionPanel, type Answers } from './PlannerPanels';
import StepLastWeek from './StepLastWeek';
import StepYourWeek from './StepYourWeek';
import StepShape from './StepShape';
import StepAccept from './StepAccept';
import { hm, weekLabel } from './plannerUi';

type Step = (typeof STEPS)[number];
const NAMES: Record<Step, string> = { last: 'Last week', week: 'Your week', shape: 'Priorities', draft: 'Draft', accept: 'Review' };
const POLL_MS = 10_000;

function answersFrom(data: PlannerWeek): Answers {
  const r = data.proposal?.request;
  const daysOff = r?.daysOff ?? [];
  return {
    feel: r?.feel ?? null,
    hours: r?.hours ?? null,
    gym: r?.gym ?? null,
    hard: r?.hard ?? null,
    longDay: r?.longDay ?? null,
    daysOff,
    // No draft yet: Coach suggests the travel days on the calendar as away.
    away: r ? r.away ?? [] : suggestAway(data.calendar, data.weekStart, data.today).filter((d) => !daysOff.includes(d)),
    lock: r?.lock ?? '',
  };
}

/**
 * The planning screen, full screen over the app, in five steps: how last week went, the week on the calendar,
 * what the week should do, Coach's draft on the calendar (tune it there), and Accept. Once there is a draft it opens
 * on the draft; the steps before stay one click away.
 */
export default function WeekPlanner({ initial }: { initial: PlannerWeek }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  // A week already on the plan with no draft open opens on Review, which shows what is planned.
  const [step, setStep] = useState<Step>(() =>
    initial.planned.length && !initial.proposal ? 'accept' : (firstStep(initial.proposal?.status) as Step));
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answers>(() => answersFrom(initial));
  const [pending, start] = useTransition();
  const p = data.proposal;
  const drafting = p?.status === 'requested' || p?.status === 'running';
  const ready = p?.status === 'proposed';
  const onPlan = !ready && !drafting && data.planned.length > 0;

  const refresh = async () => {
    const next = await plannerWeekAction(data.weekStart);
    if (next) setData(next);
    return next;
  };

  // While Coach drafts, look again every 10 s for up to 6 minutes (the planner stops at 5).
  useEffect(() => {
    if (!drafting) return;
    const started = Date.now();
    const t = setInterval(async () => {
      if (Date.now() - started > 6 * 60_000) return clearInterval(t);
      try {
        const next = await plannerWeekAction(data.weekStart);
        if (!next) return;
        setData(next);
        if (next.proposal?.status === 'proposed') toast.success(next.change ? `Draft ${next.proposal.version} is ready.` : 'Your draft is ready.');
        if (next.proposal?.status === 'failed') toast.error(next.proposal.error ?? 'The draft failed. Try again.');
      } catch {
        // The next tick tries again.
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [drafting, data.weekStart]);

  // Escape closes an open session.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selected != null) setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const run = (label: string, fn: () => Promise<{ ok: true } | { error: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if ('error' in r) toast.error(r.error);
      else {
        after?.();
        if (label) toast.success(label);
      }
      await refresh();
    });

  const draft = () => run(ready ? 'Coach is redrawing the week.' : 'Coach is drafting your week.', () => draftWeekAction(data.weekStart, { ...answers }), () => setStep('draft'));

  const ask = (note: string) => {
    if (!p || !ready) return;
    setSelected(null);
    run('Coach is redrawing the week.', () => reviseDraftAction(p.id, note));
  };

  const move = (index: number, date: string, time: string) => {
    if (!p || !ready) return;
    // Show the move at once; the server checks it and the plan checks run again.
    setData((d) => ({ ...d, events: d.events.map((e) => (e.index === index ? { ...e, date, start: time } : e)) }));
    run('', () => editDraftAction(p.id, { kind: 'move', index, date, time }));
  };

  const accept = () => p && start(async () => {
    const r = await acceptDraftAction(p.id);
    if ('error' in r) {
      toast.error(r.error);
      return;
    }
    toast.success(`${weekLabel(r.weekStart)} is planned. ${r.note}`);
    router.push(`/plan?week=${r.weekStart}`);
  });

  const changed = useMemo(() => {
    const s = new Set<string>();
    if (!data.change) return s;
    for (const e of data.events) if (data.change.changed.some((c) => c.what.includes(e.title))) s.add(`${e.date}|${e.title}`);
    return s;
  }, [data]);

  const total = data.events.reduce((n, e) => n + (e.minutes ?? 0), 0);
  const event = selected != null ? data.events.find((e) => e.index === selected) ?? null : null;
  const at = STEPS.indexOf(step);
  const open = (s: Step) => s === 'accept' ? ready || onPlan : s === 'draft' ? Boolean(p) : true;
  const go = (s: Step) => {
    if (!open(s)) return;
    setSelected(null);
    setStep(s);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={`Plan ${weekLabel(data.weekStart)}`}>
      <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-card px-6">
        <div className="flex w-[320px] shrink-0 items-center gap-3">
          <div className="flex items-center gap-2.5 text-base font-semibold whitespace-nowrap">
            <CoachMark />
            Plan {weekLabel(data.weekStart)}
          </div>
          <WeekSwitch weekStart={data.weekStart} today={data.today} />
        </div>
        <nav aria-label="Planning steps" className="mx-auto flex items-center gap-2.5 text-sm">
          {STEPS.map((s, i) => {
            const done = i < at;
            const on = s === step;
            return (
              <div key={s} className="flex items-center gap-2.5">
                {i > 0 && <span aria-hidden className={cn('h-0.5 w-7 rounded-full', i <= at ? 'bg-foreground' : 'bg-border')} />}
                <button type="button" disabled={!open(s)} onClick={() => go(s)} aria-current={on ? 'step' : undefined}
                  className={cn('flex items-center gap-2 rounded-full py-1 pr-1 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50', on ? 'font-semibold' : done ? '' : 'text-muted-foreground')}>
                  <span className={cn('flex size-6 items-center justify-center rounded-full text-xs font-bold',
                    on ? 'bg-brand text-on-brand' : done ? 'bg-foreground text-background' : 'border-[1.5px] border-border')}>
                    {done ? <Check aria-hidden className="size-3" strokeWidth={3.4} /> : i + 1}
                  </span>
                  {NAMES[s]}
                </button>
              </div>
            );
          })}
        </nav>
        <div className="flex w-[320px] shrink-0 items-center justify-end gap-3 whitespace-nowrap">
          {drafting && <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Loader2 aria-hidden className="size-4 animate-spin" />Coach is drafting…</span>}
          {!drafting && <span className="text-[13px] text-muted-foreground">Saved as you go</span>}
          <Link href="/plan" aria-label="Close" className="inline-flex size-9 items-center justify-center rounded-full bg-muted hover:bg-muted/70">
            <X aria-hidden className="size-4" />
          </Link>
        </div>
      </header>

      <div className={cn('flex min-h-0 flex-1 flex-col', step === 'draft' ? '' : 'overflow-auto px-10 py-7')}>
        {step === 'last' && <StepLastWeek data={data} answers={answers} setAnswers={setAnswers} />}
        {step === 'week' && <StepYourWeek data={data} answers={answers} setAnswers={setAnswers} />}
        {step === 'shape' && <StepShape data={data} answers={answers} setAnswers={setAnswers} />}
        {step === 'accept' && (ready || onPlan) && <StepAccept data={data} events={ready ? data.events : data.planned} onPlan={!ready} />}
        {step === 'draft' && (
          <DraftStep data={data} ready={ready} drafting={drafting} pending={pending} changed={changed} selected={selected}
            setSelected={setSelected} event={event} move={move} ask={ask} onDraft={draft}
            onLength={(index, minutes) => p && run('', () => editDraftAction(p.id, { kind: 'length', index, minutes }))}
            onRemove={(index) => p && run('Removed.', () => editDraftAction(p.id, { kind: 'remove', index }), () => setSelected(null))}
            onUndo={() => p && run('Back to the version before.', () => undoDraftAction(p.id))} />
        )}
      </div>

      <footer className="flex h-[76px] shrink-0 items-center justify-between border-t bg-card px-10">
        <span className="text-sm text-muted-foreground">
          Step {at + 1} of 5
          {step === 'draft' && ready ? ` · ${hm(total)} · click a session to change it, or drag it` : ''}
          {step === 'shape' ? ' · Coach drafts in a minute or two' : ''}
        </span>
        <div className="flex items-center gap-3">
          {at > 0 && <Button variant="secondary" onClick={() => go(STEPS[at - 1])}>Back</Button>}
          {step === 'last' && ready && <Button variant="plain" onClick={() => go('draft')}>Skip to the draft</Button>}
          {step === 'last' && <Button onClick={() => go('week')}>Next: your week<ArrowRight aria-hidden /></Button>}
          {step === 'week' && <Button onClick={() => go('shape')}>Next: priorities<ArrowRight aria-hidden /></Button>}
          {step === 'shape' && ready && <Button variant="secondary" onClick={() => go('draft')}>Keep this draft</Button>}
          {step === 'shape' && (
            <Button loading={pending} disabled={drafting} onClick={draft}>
              <Sparkles aria-hidden />{ready ? 'Redraw with these answers' : drafting ? 'Coach is drafting' : 'Draft my week'}
            </Button>
          )}
          {step === 'draft' && <Button disabled={!ready || pending} onClick={() => go('accept')}>Next: review<ArrowRight aria-hidden /></Button>}
          {step === 'accept' && ready && <Button loading={pending} onClick={accept}><Check aria-hidden />Accept and sync</Button>}
          {step === 'accept' && !ready && (
            <Link href={`/plan?week=${data.weekStart}`} className={buttonVariants()}>Open in Plan<ArrowRight aria-hidden /></Link>
          )}
        </div>
      </footer>
    </div>
  );
}

/** Step 4: Coach's draft on the calendar with its checks; the side panel explains it, or opens one session. */
function DraftStep({
  data, ready, drafting, pending, changed, selected, setSelected, event, move, ask, onDraft, onLength, onRemove, onUndo,
}: {
  data: PlannerWeek; ready: boolean; drafting: boolean; pending: boolean; changed: Set<string>; selected: number | null;
  setSelected: (i: number | null) => void; event: PlannerWeek['events'][number] | null;
  move: (index: number, date: string, time: string) => void; ask: (note: string) => void; onDraft: () => void;
  onLength: (index: number, minutes: number) => void; onRemove: (index: number) => void; onUndo: () => void;
}) {
  const p = data.proposal;
  const total = data.events.reduce((n, e) => n + (e.minutes ?? 0), 0);
  const lifts = data.events.filter((e) => e.sport === 'strength' && !/physio|stretch/i.test(e.title)).length;
  const hard = data.events.filter((e) => e.hard).length;
  const fails = p?.checks?.fails ?? 0;
  const warns = p?.checks?.warns ?? 0;
  const pills = ready
    ? [
        { ok: total >= 480 && total <= 600, text: `${hm(total)}${total >= 480 && total <= 600 ? ' in 8–10 h' : ''}` },
        { ok: lifts >= 2, text: `${lifts} lift${lifts === 1 ? '' : 's'}` },
        { ok: hard >= 1, text: `${hard} hard` },
        { ok: !fails && !warns, text: fails ? `${fails} check${fails > 1 ? 's' : ''} failed` : warns ? `${warns} to watch` : 'Plan checks pass' },
      ]
    : [];
  return (
    <div className="flex min-h-0 flex-1">
      <main className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-3 px-6 pt-5 pb-3">
          <h1 className="text-2xl font-semibold tracking-tight">{ready ? `Coach's draft · ${hm(total)}` : drafting ? 'Coach is drafting' : 'No draft yet'}</h1>
          {ready && p && p.version > 1 && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">Draft {p.version}</span>}
          <div className="ml-2 flex flex-wrap gap-2">
            {pills.map((x) => (
              <span key={x.text} className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                x.ok ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-800 dark:text-amber-300')}>
                {x.ok && <Check aria-hidden className="size-3" strokeWidth={3} />}{x.text}
              </span>
            ))}
          </div>
        </div>
        <div className="relative min-h-0 flex-1 overflow-auto px-4 pb-6">
          <WeekGrid weekStart={data.weekStart} events={ready ? data.events : []} calendar={data.calendar} selected={selected}
            changed={changed} today={data.today} onSelect={(i) => setSelected(i)} onMove={move} />
        </div>
        {!ready && (
          <div className="absolute inset-0 z-30 flex items-start justify-center bg-background/50 pt-40 backdrop-blur-[1px]">
            <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-5 text-center shadow-lg">
              {drafting ? (
                <>
                  <Loader2 aria-hidden className="size-6 animate-spin text-brand-ink" />
                  <span className="font-semibold">Coach is drafting {weekLabel(data.weekStart)}</span>
                  <span className="text-sm text-muted-foreground">Usually 2 to 3 minutes. You can close this and come back.</span>
                </>
              ) : (
                <>
                  <span className="font-semibold">{p?.status === 'failed' ? 'The last draft failed' : `No draft for ${weekLabel(data.weekStart)} yet`}</span>
                  <span className="text-sm text-muted-foreground">{p?.status === 'failed' ? p.error : 'Answer the steps before, then Coach drafts it on your calendar.'}</span>
                  <Button size="compact" loading={pending} onClick={onDraft}><RefreshCw aria-hidden />{p?.status === 'failed' ? 'Try again' : 'Draft my week'}</Button>
                </>
              )}
            </div>
          </div>
        )}
      </main>
      <aside className="flex w-[400px] shrink-0 flex-col border-l bg-card">
        <div className="flex-1 overflow-auto p-5">
          {event && ready ? (
            <SessionPanel key={event.index} data={data} event={event} busy={pending} onClose={() => setSelected(null)}
              onMove={(date, time) => move(event.index, date, time)} onLength={(m) => onLength(event.index, m)}
              onRemove={() => onRemove(event.index)} onAsk={ask} />
          ) : (
            <CoachPanel data={data} busy={pending} onAsk={ask} onUndo={onUndo} />
          )}
        </div>
        <div className="border-t p-4">
          <Composer disabled={!ready || pending} onSend={ask} />
        </div>
      </aside>
    </div>
  );
}

/** ‹ Next week ▾ ›: step a week back or ahead, or pick any of the coming weeks (this week and the seven after it). */
function WeekSwitch({ weekStart, today }: { weekStart: string; today: string }) {
  const weeks = upcomingWeeks(today);
  const at = weeks.findIndex((w) => w.monday === weekStart);
  const step = (d: number) => weeks[at + d];
  const arrow = 'flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';
  const prev = step(-1);
  const next = at === -1 ? weeks[0] : step(1);
  return (
    <nav aria-label="Week to plan" className="flex items-center">
      {prev ? (
        <Link href={`/plan/week?week=${prev.monday}`} aria-label={`Plan ${prev.label.toLowerCase()}`} className={arrow}><ChevronLeft aria-hidden className="size-4" /></Link>
      ) : <span aria-hidden className={cn(arrow, 'opacity-30 hover:bg-transparent')}><ChevronLeft className="size-4" /></span>}
      <PlanWeekMenu weekStart={weekStart} today={today}>
        <button type="button" className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium whitespace-nowrap hover:text-foreground">
          {at === -1 ? 'Pick a week' : weeks[at].label}
          <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
        </button>
      </PlanWeekMenu>
      {next ? (
        <Link href={`/plan/week?week=${next.monday}`} aria-label={`Plan ${next.label.toLowerCase()}`} className={arrow}><ChevronRight aria-hidden className="size-4" /></Link>
      ) : <span aria-hidden className={cn(arrow, 'opacity-30 hover:bg-transparent')}><ChevronRight className="size-4" /></span>}
    </nav>
  );
}
