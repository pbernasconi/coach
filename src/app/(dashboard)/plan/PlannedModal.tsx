'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, Copy, Pencil } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@kobo/web';
import SportIcon from '@/components/SportIcon';
import { totals } from '@/lib/workouts/steps.mjs';
import { sport } from '@/lib/sports';
import { cn } from '@/lib/utils';
import { plainTitle } from '@/lib/plan/calendar.mjs';
import { dur } from '@/lib/plan/cells.mjs';
import { LIFT_MARKER } from '@/lib/plan/lift-plan.mjs';
import { zonesFor } from '@/lib/plan/zones.mjs';
import type { CalendarWorkout } from '@/lib/plan/month';
import type { DayWeather } from '@/lib/plan/weather';
import { Card as PCard, Forecast, Structure, ZoneTime } from './PlannedDetails';
import LiftView, { liftStats } from './LiftView';
import { liftHref } from './ItemPreview';
import SyncStatus from './SyncStatus';
import EffortLog from './EffortLog';
import { Description, Header, Hero, StatusChip, longDay, type HeroStat } from './ModalParts';
import { EditWorkout } from './CreateWorkout';
import SkipWorkout from './SkipWorkout';
import MarkDone from './MarkDone';
import { SKIP_LABEL } from '@/lib/plan/skip.mjs';
import { strengthNotes } from '@/lib/plan/strength-text.mjs';
import SetTable, { isTextSession, setCounts, textNotes } from './SetTable';

/** Today on this device, as YYYY-MM-DD. */
const todayLocal = () => new Date().toLocaleDateString('en-CA');

// ---------------------------------------------------------------------------------------------------------------
// A planned workout that is not done yet

/** Hero numbers for a Lift session: exercises, working sets and the planned volume. */
function liftHero(lift: NonNullable<CalendarWorkout['lift']>): HeroStat[] {
  const st = liftStats(lift);
  return [
    { label: 'Exercises', value: String(st.exercises) },
    { label: 'Working sets', value: String(st.workingSets) },
    st.plannedVolume > 0 && { label: 'Planned volume', value: Math.round(st.plannedVolume).toLocaleString('en-US'), unit: lift.unit },
  ].filter(Boolean) as HeroStat[];
}

export default function PlannedModal({ w, onClose, onCopy, wx, onLiftChanged, onEdited, onSkip, onMarkDone }: { w: CalendarWorkout; onClose: () => void; onCopy?: (w: CalendarWorkout) => void; wx?: DayWeather; onLiftChanged?: (date: string) => Promise<void> | void; onEdited?: (days: { from: string; to: string }) => void; onSkip?: (w: CalendarWorkout, reason?: string | null) => void; onMarkDone?: (w: CalendarWorkout, done: boolean) => void }) {
  const [editing, setEditing] = useState(false);
  const targets = zonesFor(w) as { zone: string; label: string; target: string }[];
  // With the Lift session shown set by set, the text copy of the sets (scripts/lift-plan.mjs) and the coach's
  // exercise lines it was made from are left out.
  // A home session written as text shows its sets as a table to log, from the workout's day on.
  const home = isTextSession(w);
  const text = home ? textNotes(w) : w.lift && w.description ? strengthNotes(w.description.split(LIFT_MARKER)[0].trim()) : w.description;
  const loggable = home && Boolean(onLiftChanged) && w.status !== 'skipped' && w.date <= todayLocal();
  const sets = home ? setCounts(w) : null;
  const plan = w.steps ? totals(w.steps as never) : null;
  // The coach's reason for the workout (plan imports set it), unless the notes already say it.
  const why = w.sport !== 'rest' && w.why && w.why !== text ? w.why : null;
  // How it went: for any workout from today back (a future one has nothing to log yet).
  // A rest day has nothing to rate, skip or measure; a skipped workout has no effort to rate.
  const rest = w.sport === 'rest';
  const effort = !rest && w.status !== 'skipped' && w.date <= todayLocal() && <EffortLog item={`plan:${w.id}`} date={w.date} title={plainTitle(w.title)} planActivityId={w.id} />;
  return (
    <>
      <Header
        icon={<SportIcon id={w.sport} className="h-5 w-5" />}
        title={plainTitle(w.title)}
        sub={[longDay(w.date), w.startTime, sport(w.sport).label].filter(Boolean).join(' · ')}
        right={
          <>
            {w.adaptedFrom && <span className="hidden text-xs text-[var(--plan-partial)] sm:inline">Changed for how you feel</span>}
            {/* "Today" or "Planned" says nothing the date line does not: the chip shows only a real status. */}
            {!rest && w.compliance.level !== 'today' && w.compliance.level !== 'planned' && (
              <StatusChip level={w.compliance.level} ratio={w.compliance.ratio} basis={w.compliance.basis} />
            )}
            {w.status === 'skipped' && w.skipReason && (
              <span className="hidden text-xs text-[var(--viz-ink-2)] sm:inline">{(SKIP_LABEL as Record<string, string>)[w.skipReason] ?? w.skipReason}</span>
            )}
            {/* A future workout cannot be done yet (one marked done by mistake can still be unmarked). */}
            {onMarkDone && !rest && w.status !== 'skipped' && (w.status === 'done' || (w.state !== 'done' && w.date <= todayLocal())) && <MarkDone w={w} onMarkDone={onMarkDone} />}
            {onSkip && !rest && w.status !== 'done' && <SkipWorkout w={w} onSkip={onSkip} />}
            <SyncStatus w={w} />
            {(onEdited || onCopy) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent">
                    <Pencil aria-hidden className="h-3.5 w-3.5" /> Edit <ChevronDown aria-hidden className="h-3 w-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                {/* No close animation: while a menu fades out it still takes Escape, so a quick second Escape didn't close the window. */}
                <DropdownMenuContent align="end" className="z-[60] data-[state=closed]:animate-none!">
                  {onEdited && (
                    <DropdownMenuItem onSelect={() => setEditing(true)}>
                      <Pencil aria-hidden className="h-3.5 w-3.5" /> Edit workout
                    </DropdownMenuItem>
                  )}
                  {onCopy && (
                    <DropdownMenuItem onSelect={() => onCopy(w)}>
                      <Copy aria-hidden className="h-3.5 w-3.5" /> Copy
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
        onClose={onClose}
      />
      {editing && onEdited && (
        <EditWorkout
          w={w}
          onClose={() => setEditing(false)}
          onSaved={(days) => {
            setEditing(false);
            onEdited(days);
          }}
        />
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!rest && <Hero
          stats={[
            { label: 'Planned time', value: w.duration ? dur(w.duration) : '–' },
            w.tss != null && { label: 'Planned TSS', value: String(Math.round(w.tss)) },
            plan && plan.if > 0 && { label: 'Planned IF', value: plan.if.toFixed(2) },
            sets && { label: 'Sets done', value: `${sets.done}/${sets.total}` },
            sets && sets.done > 0 && { label: 'Reps', value: String(sets.reps) },
            ...(w.lift && !home ? liftHero(w.lift) : []),
          ]}
        />}
        {w.lift && !home ? (
          <LiftView
            lift={w.lift}
            onChanged={onLiftChanged ? () => onLiftChanged(w.date) : undefined}
            extra={
              <>
                {effort}
                {text && <Description title="Notes" text={text} />}
                <Link href={liftHref(w.lift.id)} className="block rounded-xl border px-4 py-3 text-sm font-medium text-[var(--viz-ink)] hover:bg-accent/50">
                  Open the session in full →
                </Link>
              </>
            }
          />
        ) : (
        <div className={cn('grid gap-4 p-4 sm:p-6', !rest && 'lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]')}>
          <div className="space-y-4">
            {home && (
              <PCard title="Sets">
                <SetTable w={w} loggable={loggable} onChanged={onLiftChanged} />
              </PCard>
            )}
            {home ? null : w.steps ? <Structure workout={w.steps} notes={text} /> : text ? <Description title={rest ? 'Notes' : 'The workout'} text={text} /> : why ? <Description title="Why" text={why} /> : <p className="text-sm text-muted-foreground">No notes.</p>}
          </div>
          <div className="space-y-4">
            {w.steps && <ZoneTime workout={w.steps} />}
            {home && text && <Description title="Notes" text={text} />}
            {effort}
            {why && (w.steps || text) && (
              <PCard title="Why">
                <p className="text-sm text-[var(--viz-ink)]">{why}</p>
              </PCard>
            )}
            {!w.steps && w.intensity && !w.lift && !home && !rest && (
              <PCard title="Intensity">
                <p className="text-sm text-[var(--viz-ink)]">{w.intensity}</p>
              </PCard>
            )}
            {targets.length > 0 && !w.steps && (
              <PCard title="Zone targets">
                <ul className="divide-y text-sm">
                  {targets.map((t) => (
                    <li key={`${t.zone}-${t.label}`} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                      <b className="w-8 tabular-nums">{t.zone}</b>
                      <span className="flex-1 text-[var(--viz-ink-2)]">{t.label}</span>
                      <span className="tabular-nums text-[var(--viz-ink)]">{t.target}</span>
                    </li>
                  ))}
                </ul>
              </PCard>
            )}
            {wx && <Forecast w={wx} sport={w.sport} />}
          </div>
        </div>
        )}
      </div>
    </>
  );
}
