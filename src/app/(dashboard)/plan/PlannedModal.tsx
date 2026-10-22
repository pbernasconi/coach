'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Copy, Pencil } from 'lucide-react';
import SportIcon from '@/components/SportIcon';
import { totals } from '@/lib/workouts/steps.mjs';
import { sport } from '@/lib/sports';
import { plainTitle } from '@/lib/plan/calendar.mjs';
import { dur } from '@/lib/plan/cells.mjs';
import { LIFT_MARKER } from '@/lib/plan/lift-plan.mjs';
import { zonesFor } from '@/lib/plan/zones.mjs';
import type { CalendarWorkout } from '@/lib/plan/month';
import type { DayWeather } from '@/lib/plan/weather';
import { Card as PCard, Forecast, KeyTargets, Structure, ZoneTime } from './PlannedDetails';
import LiftView, { liftStats } from './LiftView';
import { liftHref } from './ItemPreview';
import DevicesPanel from './DevicesPanel';
import { Description, Header, Hero, StatusChip, longDay, type HeroStat } from './ModalParts';
import { EditWorkout } from './CreateWorkout';
import SkipWorkout from './SkipWorkout';
import { SKIP_LABEL } from '@/lib/plan/skip.mjs';

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

export default function PlannedModal({ w, onClose, onCopy, wx, onLiftChanged, onEdited, onSkip }: { w: CalendarWorkout; onClose: () => void; onCopy?: (w: CalendarWorkout) => void; wx?: DayWeather; onLiftChanged?: (date: string) => Promise<void> | void; onEdited?: (days: { from: string; to: string }) => void; onSkip?: (w: CalendarWorkout, reason?: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const targets = zonesFor(w) as { zone: string; label: string; target: string }[];
  // With the Lift session shown set by set, the text copy of the sets (scripts/lift-plan.mjs) is left out.
  const text = w.lift && w.description ? w.description.split(LIFT_MARKER)[0].trim() : w.description;
  const plan = w.steps ? totals(w.steps as never) : null;
  return (
    <>
      <Header
        icon={<SportIcon id={w.sport} className="h-5 w-5" />}
        title={plainTitle(w.title)}
        sub={[longDay(w.date), w.startTime, sport(w.sport).label].filter(Boolean).join(' · ')}
        right={
          <>
            {w.adaptedFrom && <span className="hidden text-xs text-[var(--plan-partial)] sm:inline">Changed for how you feel</span>}
            <StatusChip level={w.compliance.level} ratio={w.compliance.ratio} basis={w.compliance.basis} />
            {w.status === 'skipped' && w.skipReason && (
              <span className="hidden text-xs text-[var(--viz-ink-2)] sm:inline">{(SKIP_LABEL as Record<string, string>)[w.skipReason] ?? w.skipReason}</span>
            )}
            {onSkip && <SkipWorkout w={w} onSkip={onSkip} />}
            {onEdited && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <Pencil aria-hidden className="h-3.5 w-3.5" /> Edit
              </button>
            )}
            {onCopy && (
              <button
                type="button"
                onClick={() => onCopy(w)}
                className="hidden items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent sm:inline-flex"
              >
                <Copy aria-hidden className="h-3.5 w-3.5" /> Copy
              </button>
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
        <Hero
          stats={[
            { label: 'Planned time', value: w.duration ? dur(w.duration) : '–' },
            w.tss != null && { label: 'Planned TSS', value: String(Math.round(w.tss)) },
            plan && plan.if > 0 && { label: 'Planned IF', value: plan.if.toFixed(2) },
            ...(w.lift ? liftHero(w.lift) : []),
          ]}
        />
        {w.lift ? (
          <LiftView
            lift={w.lift}
            onChanged={onLiftChanged ? () => onLiftChanged(w.date) : undefined}
            extra={
              <>
                {w.why && (
                  <PCard title="Why">
                    <p className="text-sm leading-relaxed text-[var(--viz-ink-2)]">{w.why}</p>
                  </PCard>
                )}
                {text && <Description title="Notes" text={text} />}
                <Link href={liftHref(w.lift.id)} className="block rounded-xl border px-4 py-3 text-sm font-medium text-[var(--viz-ink)] hover:bg-accent/50">
                  Open the session in full →
                </Link>
              </>
            }
          />
        ) : (
        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="space-y-4">
            {w.steps && <Structure workout={w.steps} />}
            {text ? <Description title={w.steps ? 'Notes' : 'The workout'} text={text} /> : !w.steps && <p className="text-sm text-muted-foreground">No description.</p>}
          </div>
          <div className="space-y-4">
            {w.steps && <KeyTargets workout={w.steps} />}
            {w.steps && <ZoneTime workout={w.steps} />}
            {!w.steps && w.intensity && !w.lift && (
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
            {w.why && (
              <PCard title="Why">
                <p className="text-sm leading-relaxed text-[var(--viz-ink-2)]">{w.why}</p>
              </PCard>
            )}
            {wx && <Forecast w={wx} sport={w.sport} />}
            {w.steps && <DevicesPanel w={w} />}
          </div>
        </div>
        )}
      </div>
    </>
  );
}
