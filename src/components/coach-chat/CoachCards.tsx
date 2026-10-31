'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Button, ChatBreakdownCard, StatusPill, cn } from '@kobo/web';
import SportIcon from '@/components/SportIcon';
import { breakdownHref, shortDay, tintSwatch, workoutHref } from './coachText.mjs';
import type { Attachment } from './types';

type Json = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const list = (v: unknown) => (Array.isArray(v) ? (v as Json[]) : []);

const CARD = 'w-full rounded-card border border-line bg-surface p-4';

/** One planned or done workout as a row: sport icon, title, the subtitle, its state. Opens it on the Plan page. */
function WorkoutRow({ item }: { item: Json }) {
  const sport = str(item.sport) ?? 'other';
  const done = (item.done as Json | null) ?? null;
  return (
    <Link
      href={workoutHref(item)}
      className="group flex items-center gap-3 rounded-inner px-1 py-2 outline-none hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-inner bg-surface-raised">
        <SportIcon id={sport} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body text-ink">{str(item.title) ?? 'Workout'}</span>
        <span className="block truncate text-footnote text-ink-muted">{str(done?.text) ?? str(item.subtitle) ?? ''}</span>
      </span>
      {str(item.stateLabel) && <span className="min-w-[4.75rem] shrink-0 text-right text-footnote whitespace-nowrap text-ink-muted">{str(item.stateLabel)}</span>}
      <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-faint group-hover:text-ink-muted" />
    </Link>
  );
}

function WorkoutCard({ item }: { item: Json }) {
  const steps = list(item.steps);
  return (
    <section aria-label={str(item.title) ?? 'Workout'} className={CARD}>
      <WorkoutRow item={item} />
      {str(item.intensity) && <p className="mt-2 text-footnote text-ink-muted">{str(item.intensity)}</p>}
      {steps.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
          {steps.slice(0, 6).map((s, i) => (
            <li key={i} className="flex gap-2 text-footnote">
              <span className="w-16 shrink-0 text-ink-muted">{str(s.label)}</span>
              <span className="text-ink">{str(s.detail)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WeekCard({ week }: { week: Json }) {
  const days = list(week.days);
  const totals = (week.totals as Json | null) ?? null;
  return (
    <section aria-label={str(week.title) ?? 'Week'} className={CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-headline text-ink">{str(week.title) ?? 'This week'}</h3>
        {str(totals?.text) && <span className="text-footnote text-ink-muted">{str(totals?.text)}</span>}
      </div>
      <ul className="mt-2 divide-y divide-line">
        {days.map((d) => {
          const items = list(d.items);
          return (
            <li key={String(d.date)} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 py-1.5">
              <span className="pt-2 text-footnote text-ink-muted">{shortDay(String(d.date))}</span>
              <div className="min-w-0">
                {items.length ? items.map((it) => <WorkoutRow key={String(it.id)} item={it} />) : <p className="py-2 text-footnote text-ink-faint">Free</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const BLOCK_STYLE: Record<string, string> = {
  busy: 'border-l-line-strong bg-surface-raised',
  session: 'border-l-brand bg-brand-soft',
  free: 'border-l-success-line bg-success-soft',
};

function DayCard({ day }: { day: Json }) {
  const blocks = list(day.blocks);
  const allDay = Array.isArray(day.allDay) ? (day.allDay as string[]) : [];
  return (
    <section aria-label={str(day.title) ?? 'Day'} className={CARD}>
      <h3 className="text-headline text-ink">{str(day.title) ?? 'Day'}</h3>
      {allDay.length > 0 && <p className="mt-1 text-footnote text-ink-muted">All day: {allDay.join(', ')}</p>}
      <ul className="mt-2 flex flex-col gap-1">
        {blocks.map((b, i) => (
          <li key={i} className={cn('flex items-center gap-3 rounded-inner border-l-4 px-2.5 py-1.5', BLOCK_STYLE[String(b.kind)] ?? BLOCK_STYLE.busy)}>
            <span className="w-24 shrink-0 text-footnote text-ink-muted tabular-nums">{str(b.start)}–{str(b.end)}</span>
            <span className="truncate text-subhead text-ink">{str(b.title) ?? (b.kind === 'free' ? 'Free' : 'Busy')}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const CHIP_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { good: 'success', warn: 'warning', bad: 'danger', neutral: 'neutral' };

function ReadinessCard({ readiness }: { readiness: Json }) {
  const header = (readiness.header as Json | null) ?? null;
  const chips = list(header?.chips);
  return (
    <section aria-label="Readiness" className={CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-headline text-ink">Today</h3>
        <Link href="/" className="text-footnote text-brand-ink hover:underline">Open Today</Link>
      </div>
      {chips.length ? (
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {chips.map((c) => (
            <div key={String(c.key)}>
              <dt className="text-footnote text-ink-muted">{str(c.label)}</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 text-body font-semibold text-ink">
                {str(c.valueText)}
                {c.tone !== 'neutral' && <StatusPill tone={CHIP_TONE[String(c.tone)] ?? 'neutral'} className="px-1.5 py-0 font-normal">{c.tone === 'good' ? 'Good' : c.tone === 'warn' ? 'Watch' : 'Low'}</StatusPill>}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-footnote text-ink-muted">{str(header?.emptyText) ?? 'No readiness data today.'}</p>
      )}
      {str(readiness.cue) && <p className="mt-3 border-t border-line pt-2 text-subhead text-ink">{str(readiness.cue)}</p>}
    </section>
  );
}

function ExerciseCard({ exercise }: { exercise: Json }) {
  const item = (exercise.item as Json | null) ?? null;
  const sets = list(item?.sets);
  const key = str(exercise.exerciseKey);
  const lastTime = (item?.lastTime as Json | null) ?? null;
  const best = (item?.best as Json | null) ?? null;
  return (
    <section aria-label={str(exercise.name) ?? 'Exercise'} className={CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-headline text-ink">{str(exercise.name)}</h3>
        {key && <Link href={`/lift/exercises/${encodeURIComponent(key)}`} className="text-footnote text-brand-ink hover:underline">History</Link>}
      </div>
      {sets.length > 0 && (
        <ol className="mt-2 flex flex-col gap-0.5">
          {sets.slice(0, 8).map((s, i) => (
            <li key={String(s.id ?? i)} className="flex gap-3 text-footnote">
              <span className="w-16 text-ink-muted">{str(s.label) ?? `Set ${i + 1}`}</span>
              <span className="text-ink tabular-nums">{str(s.text)}</span>
            </li>
          ))}
        </ol>
      )}
      {lastTime && (
        <p className="mt-2 text-footnote text-ink-muted">
          {str(lastTime.title) ?? 'Last time'}: {(Array.isArray(lastTime.sets) ? (lastTime.sets as string[]) : []).join(', ')}
        </p>
      )}
      {best && <p className="text-footnote text-ink-muted">Best e1RM {str(best.text)}</p>}
    </section>
  );
}

function BreakdownCard({ b }: { b: Json }) {
  const href = breakdownHref(b.link);
  return (
    <ChatBreakdownCard
      caption={str(b.caption)}
      title={str(b.title) ?? 'Training time'}
      total={str(b.total) ?? ''}
      rows={list(b.rows).map((r) => ({
        label: String(r.label ?? ''),
        value: Number(r.value ?? 0),
        display: String(r.display ?? ''),
        swatch: tintSwatch(r.tint),
        icon: <SportIcon id={String(r.tint ?? 'other')} />,
      }))}
      action={href ? <Button variant="outline" size="compact" asChild><Link href={href}>Open the plan</Link></Button> : undefined}
    />
  );
}

/** A card Coach showed under its reply (lift/APP-API.md, "Coach"), drawn for the web. Unknown kinds are left out. */
export default function CoachCard({ card }: { card: Attachment }) {
  switch (card.kind) {
    case 'workout': return card.workout ? <WorkoutCard item={card.workout as Json} /> : null;
    case 'week': return card.week ? <WeekCard week={card.week as Json} /> : null;
    case 'day': return card.day ? <DayCard day={card.day as Json} /> : null;
    case 'readiness': return card.readiness ? <ReadinessCard readiness={card.readiness as Json} /> : null;
    case 'exercise': return card.exercise ? <ExerciseCard exercise={card.exercise as Json} /> : null;
    case 'breakdown': return <BreakdownCard b={card} />;
    default: return null;
  }
}
