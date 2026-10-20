'use client';

import { Dumbbell } from 'lucide-react';
import { sport } from '@/lib/sports';
import { plainTitle } from '@/lib/plan/calendar.mjs';
import { dur } from '@/lib/plan/cells.mjs';
import { LIFT_MARKER } from '@/lib/plan/lift-plan.mjs';
import type { CalendarWorkout } from '@/lib/plan/month';
import { Card as PCard } from './PlannedDetails';
import LiftView, { liftStats } from './LiftView';
import { liftPreviewAction } from './actions';
import { liftHref } from './ItemPreview';
import { Description, Failed, Header, Hero, Loading, OpenButton, PlanTable, longDay, useLoad } from './ModalParts';

// ---------------------------------------------------------------------------------------------------------------
// Lift

export default function LiftModal({ id, planned, onClose }: { id: string; planned: CalendarWorkout | null; onClose: () => void }) {
  const state = useLoad(() => liftPreviewAction(id), [id]);
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
  const start = d.startedAt ? new Date(d.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;
  return (
    <>
      <Header
        icon={icon}
        title={d.title || 'Lift session'}
        sub={[longDay(d.day), start, 'Lift'].filter(Boolean).join(' · ')}
        right={<OpenButton href={liftHref(d.id)} label="Full page" />}
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
            planned?.tss != null && { label: 'Planned TSS', value: String(Math.round(planned.tss)) },
          ]}
        />
        <LiftView
          lift={d}
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
              {d.note && <Description title="Session note" text={d.note} />}
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
