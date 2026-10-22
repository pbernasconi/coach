// GET /api/app/plan/{id} (lift/APP-API.md, "Planned workout"): one planned workout for the Lift iPhone app, as the
// web's workout window shows it (src/app/(dashboard)/plan/PlannedModal.tsx, PlannedDetails.tsx): the status, the
// numbers at the top, the main work, the interval chart, every step, the time in each zone and the coach's notes.
// Every text is ready to show. Pure: the loader (app-workout.ts) finds the workout through loadRange. node --test.

import { plainTitle } from './calendar.mjs';
import { dur } from './cells.mjs';
import { LIFT_MARKER } from './lift-plan.mjs';
import { sportId, notesOf } from './week-api.mjs';
import { STEP_KIND, clock, flatten, keyTargets, profileBars, stepLength, stepSeconds, stepTarget, stepZone, totals } from '../workouts/steps.mjs';

const ZONES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** "Wednesday, October 21" for a plain day. */
export function longDayText(day) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** Time labels under the chart, as the web: every 15, 30 or 60 minutes, each with its place 0…1 along the chart. */
export function chartTicks(totalSeconds) {
  const total = totalSeconds || 1;
  const every = total > 3 * 3600 ? 3600 : total > 5400 ? 1800 : 900;
  const out = [];
  for (let s = 0; s <= total; s += every) out.push({ at: s / total, text: s === 0 ? '0' : clock(s).replace(/:00$/, '') });
  return out;
}

/** The steps as a tree: a step's length, kind (and cue), target and zone; a repeat's "6 ×" and its own steps. */
export function stepTree(steps, sport) {
  return (steps ?? []).map((s) =>
    s.kind === 'repeat'
      ? { kind: 'repeat', label: `${s.count} ×`, steps: stepTree(s.steps, sport) }
      : {
          kind: 'step',
          length: stepLength(s),
          label: `${STEP_KIND[s.kind] ?? s.kind}${s.notes ? ` · ${s.notes}` : ''}`,
          target: stepTarget(s),
          zone: stepZone(s, sport),
        }
  );
}

/** Planned time in each zone, as the web's "Time in zones" card: Z1–Z5 with the time and a whole percentage. */
export function zoneTime(workout) {
  const by = Object.fromEntries(ZONES.map((z) => [z, 0]));
  for (const s of flatten(workout.steps)) by[stepZone(s, workout.sport)] += stepSeconds(s);
  const total = ZONES.reduce((a, z) => a + by[z], 0);
  if (!total) return null;
  return {
    basis: workout.sport === 'ride' ? 'by power' : 'by heart rate',
    items: ZONES.map((zone) => ({
      zone,
      seconds: by[zone],
      timeText: by[zone] ? clock(by[zone]).replace(/:00$/, '') : '–',
      percent: Math.round((by[zone] / total) * 100),
    })),
  };
}

/**
 * One planned workout as the phone's workout page.
 * @param {object} w  a CalendarWorkout (month.ts loadRange)
 * @param {{ known: Set<string>, label: (id: string) => string }} sports
 */
export function appWorkout(w, sports) {
  const sport = sportId(w, sports.known);
  const steps = w.steps && Array.isArray(w.steps.steps) ? w.steps : null;
  const plan = steps ? totals(steps) : null;
  const done = w.state === 'done' ? w.match : null;
  const doneMin = done ? num(w.actual?.min) ?? (done.source === 'lift' ? num(w.lift?.minutes) : null) : null;
  const doneTss = done ? num(w.actual?.tss) : null;
  const text = w.lift && w.description ? String(w.description).split(LIFT_MARKER)[0].trim() || null : notesOf(w.description);
  const hero = [
    { label: 'Planned time', valueText: w.duration ? dur(w.duration) : '–', unit: null },
    num(w.tss) != null && { label: 'Planned TSS', valueText: String(Math.round(w.tss)), unit: null },
    plan && plan.if > 0 && { label: 'Planned IF', valueText: plan.if.toFixed(2), unit: null },
    doneMin != null && { label: 'Done time', valueText: dur(doneMin), unit: null },
    doneTss != null && { label: 'Done TSS', valueText: String(Math.round(doneTss)), unit: null },
  ].filter(Boolean);
  return {
    id: String(w.id),
    date: w.date,
    title: plainTitle(w.title),
    sport,
    sportLabel: sports.label(sport),
    subtitle: [sports.label(sport), longDayText(w.date), w.startTime].filter(Boolean).join(' · '),
    state: w.state,
    stateLabel: w.compliance?.label ?? w.state,
    compliance: w.state === 'done' && ['good', 'partial', 'off'].includes(w.compliance?.level) ? w.compliance.level : null,
    adapted: Boolean(w.adaptedFrom),
    hero,
    workout: steps
      ? {
          summaryText: `${clock(plan.seconds)} · ${plan.tss} TSS · IF ${plan.if.toFixed(2)}`,
          keyTargets: keyTargets(steps),
          profile: profileBars(steps),
          ticks: chartTicks(plan.seconds),
          steps: stepTree(steps.steps, steps.sport),
          zones: zoneTime(steps),
        }
      : null,
    intensity: w.intensity ?? null,
    notes: text,
    liftSessionId: w.liftSessionId ? String(w.liftSessionId).toLowerCase() : null,
    done: done
      ? {
          activityId: done.source === 'strava' && done.id != null ? String(done.id) : null,
          name: done.name ?? null,
        }
      : null,
  };
}
