'use client';

import { Dumbbell } from 'lucide-react';
import SportIcon from '@/components/SportIcon';
import ComplianceMark, { levelStyle } from '@/components/plan/ComplianceMark';
import { cn } from '@/lib/utils';
import { sport } from '@/lib/sports';
import { plainTitle } from '@/lib/plan/calendar.mjs';
import { dur } from '@/lib/plan/cells.mjs';
import { loadText } from '@/lib/plan/week-api.mjs';
import { skipText } from '@/lib/plan/skip.mjs';
import type { CalendarActivity, CalendarLift, CalendarWorkout } from '@/lib/plan/month';
import type { Item } from './ItemPreview';
import { WORKOUT_MIME } from './WorkoutLibrary';
import type { Handlers } from './calendarShared';

export function Chip({ item, h, roomy = false }: { item: Item; h: Handlers; roomy?: boolean }) {
  const open = (e: React.MouseEvent<HTMLElement>) => h.open({ kind: 'item', key: item.key }, e.currentTarget);
  if (item.kind === 'planned') return <PlannedChip w={item.w} actual={item.actual} roomy={roomy} onOpen={open} />;
  if (item.kind === 'activity') return <ActivityChip a={item.a} roomy={roomy} onOpen={open} />;
  return <LiftChip l={item.l} a={item.a} roomy={roomy} onOpen={open} />;
}

const chipBase = 'group/chip relative flex min-w-0 flex-col justify-center rounded-[5px] border border-l-[3px] px-1.5 text-[11px] leading-[15px] transition-shadow';
const chipFocus = 'rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

type OnOpen = (e: React.MouseEvent<HTMLElement>) => void;

function PlannedChip({ w, actual, roomy, onOpen }: { w: CalendarWorkout; actual: CalendarActivity | null; roomy: boolean; onOpen: OnOpen }) {
  const lvl = levelStyle(w.compliance.level);
  const done = w.state === 'done';
  const missed = w.state === 'missed';
  const skipped = w.state === 'skipped';
  // Done, partly done and not done (missed or skipped) are filled in their status colour; planned is an outline.
  const filled = done || missed || skipped;
  const pct = w.compliance.ratio != null ? `${Math.round(w.compliance.ratio * 100)} % of planned ${w.compliance.basis === 'tss' ? 'TSS' : 'time'}` : null;
  const plannedText = loadText(w.duration, w.tss, dur);
  const doneText = actual ? loadText(actual.min, actual.tss, dur) || dur(0) : w.match?.name ?? null;
  const status = skipped ? skipText(w.skipReason) : `${w.compliance.label}${pct ? ` (${pct})` : ''}`;
  const tooltip = [plainTitle(w.title), `Planned: ${plannedText || 'no target'}`, doneText && `Done: ${doneText}`, status]
    .filter(Boolean)
    .join('\n');
  const draggable = !done;
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData(WORKOUT_MIME, w.id);
        e.dataTransfer.setData('text/plain', w.id);
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.classList.add('plan-dragging');
      }}
      onDragEnd={(e) => e.currentTarget.classList.remove('plan-dragging')}
      className={cn(
        chipBase,
        roomy ? 'py-1.5' : 'h-[34px] shrink-0',
        filled ? 'plan-done shadow-sm' : 'border-dashed border-[var(--viz-axis)] bg-transparent',
        draggable && 'cursor-grab hover:shadow-md active:cursor-grabbing'
      )}
      style={{ borderLeftColor: filled ? sport(w.sport).color : `color-mix(in srgb, ${sport(w.sport).color} 45%, transparent)`, borderLeftStyle: 'solid', '--chip-tint': lvl.color } as React.CSSProperties}
      title={tooltip}
    >
      <button type="button" onClick={onOpen} draggable={false} className={cn('block min-w-0 text-left', chipFocus)}>
        <span className="flex min-w-0 items-center gap-1">
          <SportIcon id={w.sport} className={cn('h-3 w-3', !filled && 'opacity-70')} />
          <span className={cn('min-w-0 flex-1 truncate font-medium', filled ? 'text-[var(--viz-ink)]' : 'text-[var(--viz-ink-2)]')}>{plainTitle(w.title)}</span>
          <ComplianceMark level={w.compliance.level} title={status} />
        </span>
        <span className={cn('block truncate tabular-nums', filled ? 'text-[var(--viz-ink-2)]' : 'text-[var(--viz-muted)]')}>
          {done && actual ? (
            <>
              {doneText}
              {plannedText && <span className="text-[var(--viz-muted)]"> / {plannedText}</span>}
            </>
          ) : skipped ? (
            skipText(w.skipReason)
          ) : missed ? (
            `Not done${plannedText ? ` · ${plannedText}` : ''}`
          ) : (
            plannedText || sport(w.sport).label
          )}
        </span>
      </button>
    </div>
  );
}

function ActivityChip({ a, roomy, onOpen }: { a: CalendarActivity; roomy: boolean; onOpen: OnOpen }) {
  const text = [dur(a.min), a.km >= 0.5 ? `${a.km} km` : null, a.tss ? `${Math.round(a.tss)} TSS` : null].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${a.name}\n${text}\nCompleted, not planned.`}
      className={cn(chipBase, 'text-left', roomy ? 'py-1.5' : 'h-[34px] shrink-0', 'plan-done shadow-sm hover:shadow-md', chipFocus, 'rounded-[5px]')}
      style={{ borderLeftColor: sport(a.sport).color, '--chip-tint': 'var(--plan-good)' } as React.CSSProperties}
    >
      <span className="flex min-w-0 items-center gap-1">
        <SportIcon id={a.sport} className="h-3 w-3" />
        <span className="min-w-0 flex-1 truncate font-medium text-[var(--viz-ink)]">{a.name || sport(a.sport).label}</span>
        <ComplianceMark level="done" title="Completed, not planned" />
      </span>
      <span className="block truncate tabular-nums text-[var(--viz-ink-2)]">{text}</span>
    </button>
  );
}

function LiftChip({ l, a, roomy, onOpen }: { l: CalendarLift; a: CalendarActivity | null; roomy: boolean; onOpen: OnOpen }) {
  // `a`: the watch recorded the same lift; its time and TSS go on the one chip.
  const watch = a ? loadText(a.min, a.tss, dur) : '';
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${l.name}\n${l.setsLogged} sets logged in Lift`}
      className={cn(chipBase, 'text-left', roomy ? 'py-1.5' : 'h-[34px] shrink-0', 'plan-done shadow-sm hover:shadow-md', chipFocus, 'rounded-[5px]')}
      style={{ borderLeftColor: sport('strength').color, '--chip-tint': 'var(--plan-good)' } as React.CSSProperties}
    >
      <span className="flex min-w-0 items-center gap-1">
        <Dumbbell aria-hidden className="h-3 w-3 shrink-0" style={{ color: sport('strength').color }} />
        <span className="min-w-0 flex-1 truncate font-medium text-[var(--viz-ink)]">{l.name}</span>
        <ComplianceMark level="done" title="Logged in Lift" />
      </span>
      <span className="block truncate tabular-nums text-[var(--viz-ink-2)]">{watch ? `${watch} · ${l.setsLogged} sets` : `${l.setsLogged} sets · Lift`}</span>
    </button>
  );
}
