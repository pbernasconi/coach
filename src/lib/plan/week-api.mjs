// GET /api/lift/week (lift/WEEK-API.md): the weekly plan for the Lift iPhone app, with every display text computed
// here, so the phone renders it and never ports plan logic. Pure: the loader (week-api.ts) reads the rows through
// loadRange (month.ts), the same data the web calendar shows. No framework or database imports; node --test
// (week-api.test.mjs).

import { plainTitle } from './calendar.mjs';
import { weekColumnMode } from './cells.mjs';
import { LIFT_MARKER } from './lift-plan.mjs';
import { addDays, mondayOf, sportOf, todayIn } from './week.mjs';
import { keyTargets, profileBars, stepLines } from '../workouts/steps.mjs';

export const DEFAULT_ZONE = 'America/Los_Angeles';
export const MAX_WEEKS = 4;
const DAY = /^[1-9]\d{3}-\d{2}-\d{2}$/;

/** True for a real calendar day 'YYYY-MM-DD' (years 1000–9999). */
const isDay = (v) => {
  if (!DAY.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

/** Minutes as "h:mm" ("9:00", "0:45"), as the web's week column. */
export function hm(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/** An IANA zone, or DEFAULT_ZONE when it is missing or not valid. */
export function zoneOrDefault(tz) {
  try {
    if (tz) {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    }
  } catch {}
  return DEFAULT_ZONE;
}

/**
 * The request's query: `start` (any day, snapped to its Monday; default this week), `weeks` (1–4, default 2), `tz`.
 * A malformed `start` or `weeks` is an error (400); a bad `tz` falls back to DEFAULT_ZONE.
 * @param {URLSearchParams} params
 * @returns {{ start: string, weeks: number, timeZone: string, today: string } | { error: string }}
 */
export function parseWeekQuery(params, now = new Date()) {
  const timeZone = zoneOrDefault(params.get('tz'));
  const today = todayIn(timeZone, now);
  const rawStart = params.get('start');
  if (rawStart != null && !isDay(rawStart)) {
    return { error: 'start must be YYYY-MM-DD' };
  }
  const rawWeeks = params.get('weeks');
  const weeks = rawWeeks == null ? 2 : Number(rawWeeks);
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_WEEKS || (rawWeeks != null && !/^\d+$/.test(rawWeeks))) {
    return { error: `weeks must be 1 to ${MAX_WEEKS}` };
  }
  return { start: mondayOf(rawStart ?? today), weeks, timeZone, today };
}

/** "60 min · 45 TSS" for minutes and TSS; empty when both are unknown. */
export function loadText(minutes, tss, fmt = (m) => `${Math.round(m)} min`) {
  return [minutes ? fmt(minutes) : null, tss ? `${Math.round(tss)} TSS` : null].filter(Boolean).join(' · ');
}

/** The plan's free text without the generated Lift session block (the coach's note above LIFT_MARKER). */
export function notesOf(description) {
  const text = String(description ?? '').split(LIFT_MARKER)[0].trim();
  return text || null;
}

/** A sport id from design/sports.json: the plan's activity type when it is one, else from the type and title. */
export function sportId(w, known) {
  return known.has(w.sport) ? w.sport : sportOf(w);
}

/** Minutes as a clock, "1:30:00" (hours, minutes, seconds). */
export function clockOf(min) {
  const s = Math.max(0, Math.round(Number(min) * 60));
  const pad = (n) => String(n).padStart(2, '0');
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/**
 * The row's three numbers, as text: time ("1:30:00"), distance ("18.2 km") and TSS ("95"), each null when unknown.
 * A done item shows what was done; any other item what is planned.
 */
export function statsOf({ minutes, km, tss }) {
  return {
    time: minutes ? clockOf(minutes) : null,
    distance: km ? `${(Math.round(km * 10) / 10).toFixed(1)} km` : null,
    tss: tss ? String(Math.round(tss)) : null,
  };
}

const RATED = new Set(['good', 'partial', 'off']);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * One planned workout as an API item.
 * @param {object} w  a CalendarWorkout (month.ts loadRange): the workout, its state, match, actual, compliance, lift
 * @param {{ known: Set<string>, label: (id: string) => string }} sports  ids and labels of design/sports.json
 */
export function weekItem(w, sports) {
  const sport = sportId(w, sports.known);
  const steps = w.steps && Array.isArray(w.steps.steps) ? w.steps : null;
  const duration = num(w.duration);
  const tss = num(w.tss);
  const match = w.state === 'done' ? w.match : null;
  const doneMinutes = match ? (num(w.actual?.min) ?? (match.source === 'lift' ? num(w.lift?.minutes) : null)) : null;
  const doneTss = match ? num(w.actual?.tss) : null;
  const planned = loadText(duration, tss);
  return {
    id: String(w.id),
    date: w.date,
    startTime: w.startTime ?? null,
    endTime: w.endTime ?? null,
    title: plainTitle(w.title),
    sport,
    workoutType: w.workoutType ?? null,
    intensity: w.intensity ?? null,
    durationMinutes: duration,
    tss,
    subtitle: [w.startTime, planned].filter(Boolean).join(' · ') || sports.label(sport),
    state: w.state,
    stateLabel: w.compliance?.label ?? w.state,
    compliance: w.state === 'done' && RATED.has(w.compliance?.level) ? w.compliance.level : null,
    adapted: Boolean(w.adaptedFrom),
    why: w.why ?? null,
    notes: notesOf(w.description),
    keyTargets: steps ? keyTargets(steps).map((l) => l.text) : [],
    steps: steps ? stepLines(steps) : [],
    profile: steps ? profileBars(steps) : [],
    stats: match
      ? statsOf({ minutes: doneMinutes, km: num(w.actual?.km), tss: doneTss })
      : statsOf({ minutes: duration, km: num(w.distance) ? num(w.distance) / 1000 : null, tss }),
    liftSessionId: w.liftSessionId ? String(w.liftSessionId).toLowerCase() : null,
    done: match
      ? {
          source: match.source,
          // The Strava activity id (GET /api/app/activities/:id takes it); null for a Lift session.
          activityId: match.source === 'strava' && match.id != null ? String(match.id) : null,
          name: match.name ?? null,
          minutes: doneMinutes,
          tss: doneTss,
          // As the web's chip: "1:02 · 70 TSS / 1:00 · 45 TSS" (done / planned).
          text: [loadText(doneMinutes, doneTss), planned].filter(Boolean).join(' / ') || null,
        }
      : null,
  };
}

/** The week's totals line: "2/9 done · 2:10 of 9:00 · 140 of 520 TSS", or "9 planned · 9:00 · 520 TSS" ahead. */
export function totalsText(summary, today) {
  const { done, planned } = summary;
  const mode = weekColumnMode(summary, today);
  if (mode === 'empty') return 'Nothing planned';
  if (mode === 'planned') {
    return [`${planned.count} planned`, planned.min ? hm(planned.min) : null, planned.tss ? `${planned.tss} TSS` : null].filter(Boolean).join(' · ');
  }
  return [
    planned.count ? `${planned.done}/${planned.count} done` : null,
    planned.min ? `${hm(done.min)} of ${hm(planned.min)}` : done.min ? `${hm(done.min)} done` : null,
    planned.tss ? `${done.tss} of ${planned.tss} TSS` : done.tss ? `${done.tss} TSS` : null,
  ]
    .filter(Boolean)
    .join(' · ') || 'Nothing planned';
}

const byOrder = (a, b) => a.date.localeCompare(b.date) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.startTime ?? '99').localeCompare(b.startTime ?? '99');

/**
 * The whole response.
 * @param {{
 *   timeZone: string, today: string, mondays: string[], now: Date,
 *   range: { workouts: object[], summaries: object[] },
 *   plans: Map<string, { title: string | null }>,
 *   sports: { known: Set<string>, label: (id: string) => string },
 * }} input  `plans`: the plan rows by Monday (a week without a row has no plan)
 */
export function weekResponse({ timeZone, today, mondays, now, range, plans, sports }) {
  const summaries = new Map(range.summaries.map((s) => [s.monday, s]));
  const workouts = [...range.workouts].sort(byOrder);
  return {
    generatedAt: now.toISOString(),
    timeZone,
    today,
    weeks: mondays.map((monday) => {
      const s = summaries.get(monday) ?? {
        monday,
        done: { min: 0, km: 0, tss: 0, count: 0, liftSessions: 0, bySport: {} },
        planned: { min: 0, tss: 0, count: 0, done: 0, missed: 0 },
        fitness: null,
      };
      const plan = plans.get(monday);
      return {
        start: monday,
        title: plan?.title ?? null,
        hasPlan: Boolean(plan),
        totals: {
          plannedMinutes: s.planned.min,
          plannedTss: s.planned.tss,
          doneMinutes: s.done.min,
          doneTss: s.done.tss,
          plannedCount: s.planned.count,
          doneCount: s.planned.done,
          missedCount: s.planned.missed,
          text: totalsText(s, today),
        },
        days: Array.from({ length: 7 }, (_, i) => {
          const date = addDays(monday, i);
          return { date, items: workouts.filter((w) => w.date === date).map((w) => weekItem(w, sports)) };
        }),
      };
    }),
  };
}
