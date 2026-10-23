// GET /api/app/plan/{id} (lift/APP-API.md, "Planned workout"): one planned workout for the Lift iPhone app, as the
// web's workout window shows it (src/app/(dashboard)/plan/PlannedModal.tsx, PlannedDetails.tsx): the status, the
// numbers at the top, the main work, the interval chart, every step, the time in each zone and the coach's notes.
// Every text is ready to show. Pure: the loader (app-workout.ts) finds the workout through loadRange. node --test.

import { plainTitle } from './calendar.mjs';
import { dur } from './cells.mjs';
import { LIFT_MARKER } from './lift-plan.mjs';
import { sportId, notesOf } from './week-api.mjs';
import { ANCHORS, STEP_KIND, ZONE_RANGES, clock, flatten, keyTargets, profileBars, stepLength, stepSeconds, stepTarget, stepZone, totals } from '../workouts/steps.mjs';

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

/**
 * The steps as a tree: a step's length, kind, target, zone and cue (the coach's words, shown when the step is picked);
 * a repeat's "6 ×" and its own steps. `id` ties a step to its bars in the chart (`workoutBars`): "3" for a top-level
 * step, "1.0" for the first step inside the second top-level repeat.
 */
export function stepTree(steps, sport, prefix = '') {
  return (steps ?? []).map((s, i) => {
    const id = prefix ? `${prefix}.${i}` : String(i);
    return s.kind === 'repeat'
      ? { kind: 'repeat', id, label: `${s.count} ×`, steps: stepTree(s.steps, sport, id) }
      : {
          kind: 'step',
          id,
          length: stepLength(s),
          label: STEP_KIND[s.kind] ?? s.kind,
          cue: s.notes || null,
          target: stepTarget(s),
          zone: stepZone(s, sport),
        };
  });
}

/** The leaf steps in time order, each with the id of its place in the step tree. */
function leaves(steps, prefix = '') {
  const out = [];
  (steps ?? []).forEach((s, i) => {
    const id = prefix ? `${prefix}.${i}` : String(i);
    if (s.kind === 'repeat') {
      for (let r = 1; r <= s.count; r++) for (const leaf of leaves(s.steps, id)) out.push({ ...leaf, rep: leaf.rep ?? `${r} of ${s.count}` });
    } else out.push({ step: s, id, rep: null });
  });
  return out;
}

/**
 * The chart's bars with what a tap on one shows, as the web chart's tooltip: the kind and which repeat, the length and
 * target, the % of FTP or LTHR, when it runs, and the cue. `stepId` ties the bar to its row in the step list.
 */
export function workoutBars(w) {
  const bars = profileBars(w);
  const anchor = w.sport === 'ride' ? 'FTP' : 'LTHR';
  let t = 0;
  return leaves(w.steps).map(({ step, id, rep }, i) => {
    const bar = bars[i];
    const start = t;
    t += bar.seconds;
    const target = step.target ?? {};
    const percent = (target.type === 'power' || target.type === 'hr') && target.low != null
      ? `${target.low}–${target.high}% ${anchor}`
      : null;
    return {
      ...bar,
      stepId: id,
      title: [STEP_KIND[step.kind] ?? step.kind, rep].filter(Boolean).join(' · '),
      lengthText: stepLength(step),
      targetText: stepTarget(step),
      percentText: percent,
      timeText: `${start === 0 ? '0:00' : clock(start)} → ${clock(t)}`,
      cue: step.notes || null,
    };
  });
}

/** The zones' names, as Strava and the coach's zone table call them. */
const ZONE_NAMES = { Z1: 'Recovery', Z2: 'Endurance', Z3: 'Tempo', Z4: 'Threshold', Z5: 'VO2 max' };

/**
 * A zone's range in watts or beats, at the anchors: "< 146 W", "148–199 W", "> 283 W". Each zone runs to where the
 * next one starts, so the rows meet.
 */
export function zoneRange(zone, sport, anchors = ANCHORS) {
  const key = sport === 'ride' ? 'power' : 'hr';
  const anchor = sport === 'ride' ? anchors.ftp : anchors.lthr;
  const unit = sport === 'ride' ? 'W' : 'bpm';
  const at = (pct) => Math.round((pct / 100) * anchor);
  const i = ZONES.indexOf(zone);
  const low = ZONE_RANGES[zone][key][0];
  const next = ZONES[i + 1];
  if (i === 0) return `< ${at(ZONE_RANGES[next][key][0])} ${unit}`;
  if (!next) return `> ${at(low)} ${unit}`;
  return `${at(low)}–${at(ZONE_RANGES[next][key][0]) - 1} ${unit}`;
}

/** "58 min", "1 h 05 min", "45 s"; "" for none. */
function zoneClock(seconds) {
  if (!seconds) return '';
  if (seconds < 60) return `${seconds} s`;
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

/**
 * Planned time in each zone, as Strava lists it: Z1–Z5, each with its name and its range in watts or beats, the time
 * and a whole percentage.
 */
export function zoneTime(workout) {
  const by = Object.fromEntries(ZONES.map((z) => [z, 0]));
  for (const s of flatten(workout.steps)) by[stepZone(s, workout.sport)] += stepSeconds(s);
  const total = ZONES.reduce((a, z) => a + by[z], 0);
  if (!total) return null;
  return {
    basis: workout.sport === 'ride' ? 'by power' : 'by heart rate',
    items: ZONES.map((zone) => ({
      zone,
      name: ZONE_NAMES[zone],
      rangeText: zoneRange(zone, workout.sport),
      seconds: by[zone],
      timeText: zoneClock(by[zone]),
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
          // The main work in a line each, without the coach's cue (the picked step shows it).
          keyTargets: keyTargets(steps).map((l) => ({ ...l, text: l.text.split(' · ')[0] })),
          profile: workoutBars(steps),
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
