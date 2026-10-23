'use client';

import { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { toast } from 'sonner';
import { sport } from '@/lib/sports';
import { plainTitle } from '@/lib/plan/calendar.mjs';
import { dur } from '@/lib/plan/cells.mjs';
import { LIFT_MARKER } from '@/lib/plan/lift-plan.mjs';
import type { CalendarActivity, CalendarWorkout } from '@/lib/plan/month';
import { Card as PCard } from './PlannedDetails';
import EffortLog from './EffortLog';
import LiftView, { liftStats } from './LiftView';
import ResetLift from './ResetLift';
import { editLiftAction, liftPreviewAction } from './actions';
import { liftHref } from './ItemPreview';
import { Description, Failed, Header, Hero, Loading, OpenButton, PlanTable, longDay, useLoad } from './ModalParts';

// ---------------------------------------------------------------------------------------------------------------
// Lift

/** "Thu, Oct 22 5:21 PM" when the session was started on another day than it is planned for, else "5:21 PM". */
function startText(startedAt: string | null, day: string) {
  if (!startedAt) return null;
  const at = new Date(startedAt);
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const local = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  if (local === day) return time;
  return `started ${at.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`;
}

/**
 * `watch`: the Strava strength activity the watch recorded for the same lift (its TSS and a link), or null.
 * `onLiftChanged`: reloads the calendar week of a day after a reset; the modal then closes, as the item is planned again.
 */
export default function LiftModal({ id, planned, watch = null, onClose, onLiftChanged }: { id: string; planned: CalendarWorkout | null; watch?: CalendarActivity | null; onClose: () => void; onLiftChanged?: (date: string) => Promise<void> | void }) {
  const [version, setVersion] = useState(0);
  const [unlogging, setUnlogging] = useState<string | null>(null);
  const state = useLoad(() => liftPreviewAction(id), [id, version]);
  const icon = <Dumbbell aria-hidden className="h-5 w-5" style={{ color: sport('strength').color }} />;
  if (state.status === 'loading') return (<><Header icon={icon} title={planned ? plainTitle(planned.title) : 'Lift session'} sub="Loading…" onClose={onClose} /><Loading /></>);
  if (state.status === 'error' || !state.value) {
    return (
      <>
        <Header icon={icon} title="Lift session" sub="" onClose={onClose} />
        <Failed text={state.status === 'error' ? 'The session did not load. Try again.' : 'This session is not in Coach.'} />
      </>
    );
  }
  const { detail: d, unit } = state.value;
  const reps = d.exercises.reduce((n, e) => n + e.sets.reduce((m, s) => m + (s.status === 'done' && s.reps ? s.reps : 0), 0), 0);
  const exercisesDone = d.exercises.filter((e) => e.setsLogged > 0).length;
  const vol = (x: number) => `${Math.round(x).toLocaleString('en-US')} ${unit}`;
  const start = startText(d.startedAt, d.day);
  /** Un-logs one set (the check on a logged set), then loads the session and the calendar day again. */
  async function unlog(setId: string) {
    setUnlogging(setId);
    try {
      const r = await editLiftAction(d.id, [{ type: 'unlogSet', setId }]);
      if ('error' in r) toast.error(r.error);
      else {
        setVersion((v) => v + 1);
        // The set is un-logged; a failed calendar reload only leaves the calendar behind until the next load.
        Promise.resolve(onLiftChanged?.(d.day)).catch(() => toast.error('Set un-logged; reload the page to update the calendar'));
      }
    } catch {
      toast.error('Could not un-log the set');
    } finally {
      setUnlogging(null);
    }
  }
  return (
    <>
      <Header
        icon={icon}
        title={d.title || 'Lift session'}
        sub={[longDay(d.day), start, 'Lift'].filter(Boolean).join(' · ')}
        right={
          <>
            {watch && <OpenButton href={`/activities/${watch.id}`} label="Watch activity" />}
            <OpenButton href={liftHref(d.id)} label="Full page" />
          </>
        }
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Hero
          stats={[
            d.minutes != null && { label: 'Duration', value: dur(d.minutes) },
            { label: 'Volume', value: Math.round(d.volume).toLocaleString('en-US'), unit },
            { label: 'Sets logged', value: `${d.setsLogged}/${d.setsTotal}` },
            { label: 'Reps', value: String(reps) },
            { label: 'Exercises', value: String(d.exercises.length) },
            watch?.tss != null && { label: 'TSS', value: String(Math.round(watch.tss)) },
            planned?.tss != null && { label: 'Planned TSS', value: String(Math.round(planned.tss)) },
          ]}
        />
        <LiftView
          lift={d}
          onUnlog={onLiftChanged ? unlog : undefined}
          unlogging={unlogging}
          extra={
            <>
              <PCard title="Planned vs done">
                <PlanTable
                  showPlanned
                  rows={[
                    ['Exercises', String(d.exercises.length), String(exercisesDone)],
                    ['Sets', String(d.setsTotal), String(d.setsLogged)],
                    ['Reps', null, String(reps)],
                    ['Volume', liftStats(d).plannedVolume > 0 ? vol(liftStats(d).plannedVolume) : null, vol(d.volume)],
                    ['Duration', planned?.duration ? dur(planned.duration) : null, d.minutes != null ? dur(d.minutes) : null],
                  ]}
                />
              </PCard>
              <EffortLog item={`lift:${d.id}`} date={d.day} title={d.title || 'Lift session'} planActivityId={planned?.id ?? null} />
              {d.note && <Description title="Session note" text={d.note} />}
              {onLiftChanged && (d.setsLogged > 0 || d.startedAt || d.finishedAt) && (
                <ResetLift
                  sessionId={d.id}
                  onReset={async () => {
                    await onLiftChanged(d.day);
                    onClose();
                  }}
                />
              )}
              {planned?.description && planned.description.split(LIFT_MARKER)[0].trim() && (
                <Description title="The plan" text={planned.description.split(LIFT_MARKER)[0].trim()} />
              )}
            </>
          }
        />
      </div>
    </>
  );
}
