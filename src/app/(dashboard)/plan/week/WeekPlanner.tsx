'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Loader2, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, cn } from '@kobo/web';
import CoachMark from '@/components/brand/CoachMark';
import type { PlannerWeek } from '@/lib/plan/planner-week';
import { acceptDraftAction, draftWeekAction, editDraftAction, plannerWeekAction, reviseDraftAction, undoDraftAction } from './actions';
import WeekGrid from './WeekGrid';
import { CoachPanel, Composer, LastWeekPanel, SessionPanel, ShapePanel, type Answers } from './PlannerPanels';
import { addDays, mondayOf } from '@/lib/plan/week.mjs';
import { clock, days, hm, sportVar, weekLabel, weekday } from './plannerUi';

type Tab = 'last' | 'shape' | 'coach';
const TABS: { id: Tab; label: string }[] = [
  { id: 'last', label: 'Last week' },
  { id: 'shape', label: 'Shape' },
  { id: 'coach', label: 'Coach' },
];
const POLL_MS = 10_000;

function answersFrom(data: PlannerWeek): Answers {
  const r = data.proposal?.request;
  return {
    feel: r?.feel ?? null,
    hours: r?.hours ?? null,
    gym: r?.gym ?? null,
    hard: r?.hard ?? null,
    longDay: r?.longDay ?? null,
    daysOff: r?.daysOff ?? [],
    lock: r?.lock ?? '',
  };
}

/**
 * The planning screen, full screen over the app: Coach's draft on Paolo's calendar, the side panel (Last week,
 * Shape, Coach, or one session), and one Accept. Changes are drags, the session panel, or a note to Coach; each
 * note or redraw is a new version with Undo.
 */
export default function WeekPlanner({ initial }: { initial: PlannerWeek }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>(initial.proposal?.status === 'proposed' ? (initial.change ? 'coach' : 'last') : 'last');
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answers>(() => answersFrom(initial));
  const [accepting, setAccepting] = useState(false);
  const [pending, start] = useTransition();
  const p = data.proposal;
  const drafting = p?.status === 'requested' || p?.status === 'running';
  const ready = p?.status === 'proposed';

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
        if (next.proposal?.status === 'proposed') {
          setTab(next.change ? 'coach' : 'last');
          toast.success(next.change ? `Draft v${next.proposal.version} is ready.` : 'Your draft is ready.');
        }
        if (next.proposal?.status === 'failed') toast.error(next.proposal.error ?? 'The draft failed. Try again.');
      } catch {
        // The next tick tries again.
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [drafting, data.weekStart]);

  // Escape closes a session, then the screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || accepting) return;
      if (selected != null) setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, accepting]);

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

  const ask = (note: string) => {
    if (!p || !ready) return;
    setSelected(null);
    setTab('coach');
    run('Coach is redrawing the week.', () => reviseDraftAction(p.id, note));
  };

  const move = (index: number, date: string, time: string) => {
    if (!p || !ready) return;
    // Show the move at once; the server checks it and the plan checks run again.
    setData((d) => ({ ...d, events: d.events.map((e) => (e.index === index ? { ...e, date, start: time } : e)) }));
    run('', () => editDraftAction(p.id, { kind: 'move', index, date, time }));
  };

  const changed = useMemo(() => {
    const s = new Set<string>();
    if (!data.change) return s;
    for (const e of data.events) if (data.change.changed.some((c) => c.what.includes(e.title))) s.add(`${e.date}|${e.title}`);
    return s;
  }, [data]);

  const total = data.events.reduce((n, e) => n + (e.minutes ?? 0), 0);
  const lifts = data.events.filter((e) => e.sport === 'strength' && !/physio|stretch/i.test(e.title)).length;
  const hard = data.events.filter((e) => e.hard).length;
  const fails = p?.checks?.fails ?? 0;
  const warns = p?.checks?.warns ?? 0;
  const event = selected != null ? data.events.find((e) => e.index === selected) ?? null : null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={`Plan ${weekLabel(data.weekStart)}`}>
      <header className="flex h-16 shrink-0 items-center gap-4 border-b px-5">
        <div className="flex items-center gap-2.5 text-base font-semibold">
          <CoachMark />
          Plan {weekLabel(data.weekStart)}
        </div>
        <WeekSwitch weekStart={data.weekStart} today={data.today} />
        {ready && (
          <span className="text-sm text-muted-foreground">
            {hm(total)}{p?.request.hours ? ` of ${p.request.hours}h` : ''} · {lifts} lift{lifts === 1 ? '' : 's'} · {hard} hard
          </span>
        )}
        {ready && p?.checks && (
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
            fails ? 'bg-rose-500/12 text-rose-700 dark:text-rose-300' : warns ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300' : 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300')}>
            {!fails && !warns && <Check aria-hidden className="size-3.5" />}
            {fails ? `${fails} check${fails > 1 ? 's' : ''} failed` : warns ? `${warns} to watch` : 'Plan checks pass'}
          </span>
        )}
        {ready && p && p.version > 1 && <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-semibold text-background">v{p.version}</span>}
        <div className="ml-auto flex items-center gap-2">
          {drafting && <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Loader2 aria-hidden className="size-4 animate-spin" />Coach is drafting…</span>}
          <Button disabled={!ready || pending} onClick={() => setAccepting(true)}>Accept week</Button>
          <Link href="/plan" aria-label="Close" className="inline-flex size-9 items-center justify-center rounded-full bg-muted hover:bg-muted/70">
            <X aria-hidden className="size-4" />
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 overflow-auto px-4 pb-6">
          <WeekGrid
            weekStart={data.weekStart}
            events={ready ? data.events : []}
            calendar={data.calendar}
            selected={selected}
            changed={changed}
            today={data.today}
            onSelect={(i) => setSelected(i)}
            onMove={move}
          />
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
                    <span className="text-sm text-muted-foreground">{p?.status === 'failed' ? p.error : (data.weekStart === mondayOf(data.today) ? 'Coach plans the days left, from today on. ' : '') + 'Check last week and the shape, then Coach drafts it on your calendar.'}</span>
                    <Button size="compact" loading={pending} onClick={() => run('Coach is drafting your week.', () => draftWeekAction(data.weekStart, { ...answers }))}>
                      <RefreshCw aria-hidden />{p?.status === 'failed' ? 'Try again' : 'Draft my week'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </main>

        <aside className="flex w-[400px] shrink-0 flex-col border-l bg-card">
          {event && ready ? (
            <div className="flex-1 overflow-auto p-5">
              <SessionPanel
                key={event.index}
                data={data}
                event={event}
                busy={pending}
                onClose={() => setSelected(null)}
                onMove={(date, time) => move(event.index, date, time)}
                onLength={(minutes) => p && run('', () => editDraftAction(p.id, { kind: 'length', index: event.index, minutes }))}
                onRemove={() => p && run('Removed.', () => editDraftAction(p.id, { kind: 'remove', index: event.index }), () => setSelected(null))}
                onAsk={ask}
              />
            </div>
          ) : (
            <>
              <div className="p-4 pb-0">
                <div className="flex rounded-full bg-muted p-1" role="tablist">
                  {TABS.map((t) => (
                    <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                      className={cn('flex-1 rounded-full py-1.5 text-sm font-semibold', tab === t.id ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-auto p-5">
                {tab === 'last' && <LastWeekPanel data={data} answers={answers} setAnswers={setAnswers} onNext={() => setTab('shape')} />}
                {tab === 'shape' && (
                  <ShapePanel data={data} answers={answers} setAnswers={setAnswers} busy={pending || drafting}
                    onDraft={() => run(ready ? 'Coach is redrawing the week.' : 'Coach is drafting your week.', () => draftWeekAction(data.weekStart, { ...answers }), () => setTab('coach'))} />
                )}
                {tab === 'coach' && (
                  <CoachPanel data={data} busy={pending} onAsk={ask}
                    onUndo={() => p && run('Back to the version before.', () => undoDraftAction(p.id))} />
                )}
              </div>
            </>
          )}
          <div className="border-t p-4">
            <Composer disabled={!ready || pending} onSend={ask} />
          </div>
        </aside>
      </div>

      <Dialog open={accepting} onOpenChange={setAccepting}>
        <DialogContent className="max-w-2xl">
          <div className="flex flex-col gap-4 p-6">
            <DialogTitle className="text-xl font-semibold">Accept {weekLabel(data.weekStart)} · {hm(total)}</DialogTitle>
            <DialogDescription className="sr-only">The week, and where it goes.</DialogDescription>
            <div className="grid grid-cols-[1.4fr_1fr] gap-6">
              <div className="flex flex-col divide-y text-sm">
                {days(data.weekStart).map((d) => {
                  const items = data.events.filter((e) => e.date === d);
                  return (
                    <div key={d} className="flex gap-3 py-2">
                      <span className="w-12 shrink-0 font-semibold">{weekday(d)}</span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        {items.length === 0 && <span className="text-brand-ink">Off</span>}
                        {items.map((e) => (
                          <div key={e.index} className="flex items-center gap-2">
                            <span className="size-2 shrink-0 rounded-full" style={{ background: sportVar(e) }} />
                            <span className="w-11 shrink-0 tabular-nums text-muted-foreground">{clock(e.start)}</span>
                            <span className="min-w-0 flex-1 truncate">{e.title}</span>
                            <span className="text-muted-foreground">{hm(e.minutes)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Always syncs to</div>
                {['Google Calendar', 'Lift on iPhone', 'Garmin', 'Zwift'].map((s) => (
                  <div key={s} className="flex items-center justify-between border-b py-1.5">
                    <span>{s}</span>
                    <RefreshCw aria-hidden className="size-3.5 text-emerald-600" />
                  </div>
                ))}
                <span className="text-xs text-muted-foreground">Later changes sync again on their own. Moves on your calendar still win.</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAccepting(false)}>Back</Button>
              <Button loading={pending} onClick={() => p && start(async () => {
                const r = await acceptDraftAction(p.id);
                if ('error' in r) {
                  toast.error(r.error);
                  return;
                }
                toast.success(`${weekLabel(r.weekStart)} is planned. ${r.note}`);
                setAccepting(false);
                router.push(`/plan?week=${r.weekStart}`);
              })}><Check aria-hidden />Accept week</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * This week or next week. This week plans only the days left from today: Coach keeps what is done (a check-in).
 */
function WeekSwitch({ weekStart, today }: { weekStart: string; today: string }) {
  const thisWeek = mondayOf(today);
  const weeks = [
    { monday: thisWeek, label: 'This week' },
    { monday: addDays(thisWeek, 7), label: 'Next week' },
  ];
  return (
    <nav aria-label="Week to plan" className="inline-flex rounded-full bg-muted p-0.5 text-sm">
      {weeks.map((w) => (
        <Link
          key={w.monday}
          href={`/plan/week?week=${w.monday}`}
          aria-current={w.monday === weekStart ? 'page' : undefined}
          className={cn(
            'rounded-full px-3 py-1 font-medium transition-colors',
            w.monday === weekStart ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {w.label}
        </Link>
      ))}
    </nav>
  );
}
