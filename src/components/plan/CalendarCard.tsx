'use client';

import Link from 'next/link';
import { Dumbbell } from 'lucide-react';
import SportIcon from '@/components/SportIcon';
import { MiniWorkoutChart } from '@/components/workouts/WorkoutChart';
import ComplianceMark, { levelStyle } from '@/components/plan/ComplianceMark';
import { cn } from '@/lib/utils';
import { sport } from '@/lib/sports';
import { plainTitle } from '@/lib/plan/calendar.mjs';
import { dur } from '@/lib/plan/cells.mjs';
import { loadText } from '@/lib/plan/week-api.mjs';
import { skipText } from '@/lib/plan/skip.mjs';
import type { CalendarActivity, CalendarLift, CalendarWorkout } from '@/lib/plan/month';

/** One item in a calendar day: a planned workout, an unplanned activity, or a Lift session. */
export type CalendarItem =
  | { kind: 'planned'; key: string; w: CalendarWorkout; actual: CalendarActivity | null }
  | { kind: 'activity'; key: string; a: CalendarActivity }
  | { kind: 'lift'; key: string; l: CalendarLift; a: CalendarActivity | null };

/** What a click on the card does: follow a link (home page) or run a handler (the /plan calendar). */
export type CardAction = { href: string } | { onClick: (e: React.MouseEvent<HTMLElement>) => void };

/** Drag handlers for a planned card that can be moved to another day (/plan only). */
export type CardDrag = Pick<React.HTMLAttributes<HTMLDivElement>, 'onDragStart' | 'onDragEnd'>;

const cardBase = 'plan-chip group/chip relative flex min-w-0 flex-col justify-center rounded-[5px] border border-l-[3px] px-2 text-[12px] leading-4';
const actionBase = 'block min-w-0 rounded-[4px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * The workout card of the calendar, used by /plan and the home page's week strip so both look the same.
 * Upcoming workouts are white with a solid grey outline; done, partly done and not done are filled in their status
 * colour; unplanned activities and Lift sessions count as done. `roomy` drops the fixed height (agenda view).
 */
export default function CalendarCard({ item, action, roomy = false, drag }: { item: CalendarItem; action: CardAction; roomy?: boolean; drag?: CardDrag }) {
  if (item.kind === 'planned') return <PlannedCard w={item.w} actual={item.actual} roomy={roomy} action={action} drag={drag} />;
  if (item.kind === 'activity') return <ActivityCard a={item.a} roomy={roomy} action={action} />;
  return <LiftCard l={item.l} a={item.a} roomy={roomy} action={action} />;
}

function Action({ action, children }: { action: CardAction; children: React.ReactNode }) {
  if ('href' in action) {
    return (
      <Link href={action.href} draggable={false} className={actionBase}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} draggable={false} className={actionBase}>
      {children}
    </button>
  );
}

function PlannedCard({ w, actual, roomy, action, drag }: { w: CalendarWorkout; actual: CalendarActivity | null; roomy: boolean; action: CardAction; drag?: CardDrag }) {
  const lvl = levelStyle(w.compliance.level);
  const done = w.state === 'done';
  const missed = w.state === 'missed';
  const skipped = w.state === 'skipped';
  const filled = done || missed || skipped;
  const pct = w.compliance.ratio != null ? `${Math.round(w.compliance.ratio * 100)} % of planned ${w.compliance.basis === 'tss' ? 'TSS' : 'time'}` : null;
  const plannedText = loadText(w.duration, w.tss, dur);
  const doneText = actual ? loadText(actual.min, actual.tss, dur) || dur(0) : w.match?.name ?? null;
  const status = skipped ? skipText(w.skipReason) : `${w.compliance.label}${pct ? ` (${pct})` : ''}`;
  const draggable = Boolean(drag) && !done;
  // Done with a matched activity: what was done leads (time, distance, TSS), the plan is a small line under it.
  const showDone = done && Boolean(actual);
  const doneParts = actual ? [dur(actual.min), actual.km >= 0.5 ? `${actual.km} km` : null, actual.tss ? `${Math.round(actual.tss)} TSS` : null].filter(Boolean) : [];
  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? drag?.onDragStart : undefined}
      onDragEnd={draggable ? drag?.onDragEnd : undefined}
      className={cn(
        cardBase,
        roomy ? 'py-1.5' : showDone ? 'h-[62px] shrink-0' : w.steps ? 'h-[70px] shrink-0' : 'h-[46px] shrink-0',
        filled ? 'plan-done shadow-sm' : 'plan-upcoming shadow',
        draggable && 'cursor-grab hover:shadow-md active:cursor-grabbing'
      )}
      style={{ borderLeftColor: sport(w.sport).color, '--chip-tint': lvl.color } as React.CSSProperties}
    >
      <Action action={action}>
        <span className="flex min-w-0 items-center gap-1">
          <SportIcon id={w.sport} className="h-3.5 w-3.5" />
          <span className={cn('min-w-0 flex-1 truncate font-medium', 'text-[var(--viz-ink)]')}>{plainTitle(w.title)}</span>
          <ComplianceMark level={w.compliance.level} title={status} tooltip={false} />
        </span>
        <span className="block truncate tabular-nums text-[var(--viz-ink-2)]">
          {showDone ? (
            <span className="font-semibold text-[var(--viz-ink)]">{doneParts.join(' · ') || doneText}</span>
          ) : skipped ? (
            skipText(w.skipReason)
          ) : missed ? (
            // The red ✕ already says not done; the line keeps the plan, struck through.
            <span className="line-through decoration-[var(--viz-muted)]">{plannedText || 'Not done'}</span>
          ) : (
            plannedText || sport(w.sport).label
          )}
        </span>
        {showDone && plannedText && <span className="block truncate text-[11px] tabular-nums text-[var(--viz-muted)]">P: {plannedText}</span>}
        {w.steps && !showDone && <MiniWorkoutChart workout={w.steps} className={cn('mt-1 block w-full text-[var(--viz-ink-2)]', roomy ? 'h-6' : 'h-5')} />}
      </Action>
    </div>
  );
}

function ActivityCard({ a, roomy, action }: { a: CalendarActivity; roomy: boolean; action: CardAction }) {
  const text = [dur(a.min), a.km >= 0.5 ? `${a.km} km` : null, a.tss ? `${Math.round(a.tss)} TSS` : null].filter(Boolean).join(' · ');
  return (
    <div
      className={cn(cardBase, roomy ? 'py-1.5' : 'h-[46px] shrink-0', 'plan-done shadow-sm hover:shadow-md')}
      style={{ borderLeftColor: sport(a.sport).color, '--chip-tint': 'var(--plan-good)' } as React.CSSProperties}
    >
      <Action action={action}>
        <span className="flex min-w-0 items-center gap-1">
          <SportIcon id={a.sport} className="h-3.5 w-3.5" />
          <span className="min-w-0 flex-1 truncate font-medium text-[var(--viz-ink)]">{a.name || sport(a.sport).label}</span>
          <ComplianceMark level="done" title="Completed, not planned" tooltip={false} />
        </span>
        <span className="block truncate font-semibold tabular-nums text-[var(--viz-ink)]">{text}</span>
      </Action>
    </div>
  );
}

function LiftCard({ l, a, roomy, action }: { l: CalendarLift; a: CalendarActivity | null; roomy: boolean; action: CardAction }) {
  // `a`: the watch recorded the same lift; its time and TSS go on the one card.
  const watch = a ? loadText(a.min, a.tss, dur) : '';
  return (
    <div
      className={cn(cardBase, roomy ? 'py-1.5' : 'h-[46px] shrink-0', 'plan-done shadow-sm hover:shadow-md')}
      style={{ borderLeftColor: sport('strength').color, '--chip-tint': 'var(--plan-good)' } as React.CSSProperties}
    >
      <Action action={action}>
        <span className="flex min-w-0 items-center gap-1">
          <Dumbbell aria-hidden className="h-3.5 w-3.5 shrink-0" style={{ color: sport('strength').color }} />
          <span className="min-w-0 flex-1 truncate font-medium text-[var(--viz-ink)]">{l.name}</span>
          <ComplianceMark level="done" title="Logged in Lift" tooltip={false} />
        </span>
        <span className="block truncate font-semibold tabular-nums text-[var(--viz-ink)]">{watch ? `${watch} · ${l.setsLogged} sets` : `${l.setsLogged} sets · Lift`}</span>
      </Action>
    </div>
  );
}
