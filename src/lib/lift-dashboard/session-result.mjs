// @ts-check
// What a Lift session achieved, for the phone's session page (lift/APP-API.md, "Session"): one result line per
// exercise (the sets done, the top set, the e1RM and its change against last time, a record), the headline stats, and
// the watch's heart rate from the Strava activity that recorded the same lift. No plan totals: tonnage adds loads of
// different lifts, so it says nothing to act on. Pure; node --test (session-result.test.mjs).

import { epley } from './stats.mjs';
import { fmtDay, loadText, num, repsText } from './text.mjs';
import { cellItems } from '../plan/cells.mjs';

/** @param {number} n */
const r1 = (n) => Math.round(n * 10) / 10;

/**
 * @typedef {{ kind: string, status: string, reps: number | null, weight: number | null, target: import('./text.mjs').SetTarget }} ResultSet
 * @typedef {{ loadMode: string | null, sets: ResultSet[], history: { last: { day: string, sessionId: string, sets: { reps: number | null, weight: number | null }[] } | null, best: { day: string, e1rm: number } | null, trend: { day: string, e1rm: number }[] } }} ResultExercise
 */

/** The best Epley estimate of these sets, or null. @param {{ reps: number | null, weight: number | null }[]} sets */
export function bestE1rm(sets) {
  let best = null;
  for (const s of sets) {
    const e = s.reps != null && s.weight != null ? epley(s.reps, s.weight) : null;
    if (e != null && (best == null || e > best)) best = e;
  }
  return best;
}

/**
 * Done sets as one short line, a load once for each run of the same load: "245 lb × 8, 8, 7", "225 lb × 8 · 245 lb × 6".
 * @param {{ reps: number | null, weight: number | null }[]} sets @param {string | null} loadMode @param {string} unit
 */
export function setsLine(sets, loadMode, unit) {
  /** @type {{ load: string, reps: string[] }[]} */
  const runs = [];
  for (const s of sets) {
    const load = loadText(s.weight, loadMode, unit) || '–';
    const reps = String(s.reps ?? '?');
    const last = runs.at(-1);
    if (last && last.load === load) last.reps.push(reps);
    else runs.push({ load, reps: [reps] });
  }
  return runs.map((r) => `${r.load} × ${r.reps.join(', ')}`).join(' · ');
}

/**
 * The plan of the working sets: "3 × 5 · 230 lb" when every set is the same, else each target: "230 lb × 5 · 240 lb × 3".
 * @param {ResultSet[]} sets @param {string | null} loadMode @param {string} unit
 */
export function targetLine(sets, loadMode, unit) {
  if (!sets.length) return '';
  const parts = sets.map((s) => ({ load: loadText(s.target.weight, loadMode, unit), reps: repsText(s.target) }));
  const same = parts.every((p) => p.load === parts[0].load && p.reps === parts[0].reps);
  if (same) return [`${sets.length} × ${parts[0].reps || '?'}`, parts[0].load].filter(Boolean).join(' · ');
  return parts.map((p) => [p.load, p.reps && `× ${p.reps}`].filter(Boolean).join(' ') || '–').join(' · ');
}

/**
 * One exercise's result. `state`: `done` (a working set logged), `skipped` (every working set skipped) or `planned`.
 * Loaded work compares the e1RM with last time; bodyweight work (no honest e1RM) compares the most reps in a set.
 * `progress`: the e1RM of the earlier sessions and this one, oldest first (null under 2 points).
 * @param {ResultExercise} e @param {string} unit
 */
export function exerciseResult(e, unit) {
  const working = e.sets.filter((s) => s.kind !== 'warmUp');
  const done = working.filter((s) => s.status === 'done');
  const state = done.length ? 'done' : working.length && working.every((s) => s.status === 'skipped') ? 'skipped' : 'planned';
  const bodyweight = e.loadMode === 'bodyweight';
  const h = e.history;
  const base = { state, summaryText: '', topSetText: null, e1rm: null, e1rmText: null, change: null, record: false, progress: null };
  if (state !== 'done') return { ...base, summaryText: state === 'skipped' ? 'Skipped' : targetLine(working, e.loadMode, unit) };

  const top = done.reduce((a, s) => ((s.weight ?? 0) > (a.weight ?? 0) || ((s.weight ?? 0) === (a.weight ?? 0) && (s.reps ?? 0) > (a.reps ?? 0)) ? s : a));
  const result = {
    ...base,
    summaryText: setsLine(done, e.loadMode, unit),
    topSetText: `${loadText(top.weight, e.loadMode, unit) || '–'} × ${top.reps ?? '?'}`,
  };
  const since = h.last ? `vs ${fmtDay(h.last.day)}` : null;
  if (bodyweight) {
    const most = Math.max(...done.map((s) => s.reps ?? 0));
    const before = h.last ? Math.max(...h.last.sets.map((s) => s.reps ?? 0)) : null;
    const diff = before ? most - before : null;
    return { ...result, change: diff == null || !since ? null : changeOf(diff, `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${Math.abs(diff)} reps`, since) };
  }
  const e1rm = bestE1rm(done);
  if (e1rm == null) return result;
  const lastE1rm = h.last ? bestE1rm(h.last.sets) : null;
  const diff = lastE1rm == null ? null : r1(e1rm - lastE1rm);
  const points = [...h.trend.map((p) => p.e1rm), e1rm].slice(-10).map(r1);
  return {
    ...result,
    e1rm: r1(e1rm),
    e1rmText: `${num(e1rm, 0)} ${unit}`,
    change: diff == null || !since ? null : changeOf(diff, `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${num(Math.abs(diff), 0)} ${unit}`, since),
    record: h.best != null && e1rm > h.best.e1rm + 0.05,
    progress: points.length >= 2 ? { values: points, caption: `e1RM · last ${points.length} sessions` } : null,
  };
}

/** @param {number} diff @param {string} text @param {string} caption */
function changeOf(diff, text, caption) {
  // Under one unit (or one rep) is the same: plates do not move by less.
  const tone = Math.abs(diff) < 1 ? 'same' : diff > 0 ? 'up' : 'down';
  return { value: diff, text: tone === 'same' ? 'Same' : text, tone, caption };
}

/** "52 min" or "1:05 h" as a value and a unit. @param {number | null} minutes */
function durationStat(minutes) {
  if (minutes == null) return { label: 'Duration', valueText: '–', unit: null };
  if (minutes < 60) return { label: 'Duration', valueText: String(minutes), unit: 'min' };
  return { label: 'Duration', valueText: `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`, unit: 'h' };
}

/**
 * The headline numbers of the page, at most 6, `{ label, valueText, unit }` as the activity page's grid. Done:
 * duration, sets, the watch's heart rate, calories and Coach TSS, then the records (exercises without a watch).
 * Not done yet: exercises and sets.
 * @param {{ minutes: number | null, setsLogged: number, setsTotal: number, exercises: unknown[] }} d
 * @param {{ state: string, record: boolean }[]} results
 * @param {{ stats: Array<{ label: string, valueText: string, unit?: string }> } | null} watch  the watch activity's stats
 * @param {string} state  the session's state
 */
export function summaryGrid(d, results, watch, state) {
  const sets = { label: 'Sets', valueText: d.setsLogged < d.setsTotal && state === 'done' ? `${d.setsLogged}/${d.setsTotal}` : String(state === 'done' ? d.setsLogged : d.setsTotal), unit: null };
  const exercises = { label: 'Exercises', valueText: String(d.exercises.length), unit: null };
  if (state !== 'done') return [exercises, sets];
  const fromWatch = (/** @type {string} */ label, /** @type {string} */ as) => {
    const s = watch?.stats.find((x) => x.label === label);
    return s ? { label: as, valueText: s.valueText, unit: s.unit ?? null } : null;
  };
  const records = results.filter((r) => r.record).length;
  const minutes = d.minutes ?? watchMinutes(watch);
  const watchStats = [fromWatch('Avg Heart Rate', 'Avg HR'), fromWatch('Calories', 'Calories'), fromWatch('Coach TSS', 'TSS')].filter(Boolean);
  const grid = [durationStat(minutes), sets, ...watchStats, { label: 'Records', valueText: String(records), unit: null }];
  if (grid.length < 6) grid.splice(2, 0, exercises);
  return grid.slice(0, 6);
}

/** The watch's moving time in minutes, when Lift has no finish time. @param {{ stats: Array<{ label: string, valueText: string }> } | null} watch */
function watchMinutes(watch) {
  const t = watch?.stats.find((s) => s.label === 'Moving Time')?.valueText;
  if (!t) return null;
  const parts = t.split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  const seconds = parts.reduce((a, n) => a * 60 + n, 0);
  return Math.round(seconds / 60);
}

/**
 * The watch card from the activity page's body (src/lib/activity/app-api.mjs detailResponse) of the Strava activity
 * that recorded this lift: its stats, the heart-rate line on its clock and the time in each zone. Null without a body.
 * @param {any} body
 */
export function watchSection(body) {
  if (!body?.header?.ok) return null;
  const overview = body.overview?.ok ? [...(body.overview.big ?? []), ...(body.overview.small ?? [])] : [];
  const analysis = body.analysis?.ok ? body.analysis : null;
  const hr = analysis?.streams?.find((/** @type {{ key: string }} */ s) => s.key === 'hr') ?? null;
  const want = ['Avg Heart Rate', 'Max Heart Rate', 'Calories', 'Coach TSS', 'Moving Time'];
  return {
    activityId: String(body.activityId ?? body.header.activityId),
    name: body.header.name ?? null,
    deviceText: body.equipment?.ok ? (body.equipment.device ?? null) : null,
    stats: want.map((label) => overview.find((s) => s.label === label)).filter(Boolean),
    heartRate:
      hr && analysis.x?.timeS
        ? { timeS: analysis.x.timeS, values: hr.values, avgText: hr.avgText ?? null, maxText: overview.find((s) => s.label === 'Max Heart Rate')?.valueText ?? null }
        : null,
    zones: body.heartRate?.ok ? body.heartRate.zones : null,
    note: body.header.fetch?.note ?? null,
  };
}

/**
 * The plan workout and the watch activity of one Lift session, as the web calendar pairs them (one lift on Lift and on
 * the watch shows once): a planned strength workout that matched the session (or is linked to it) carries the day's
 * Strava strength activity as `match.activityId`; an unplanned session takes the day's unmatched strength activity
 * (cellItems). From one loadRange of the session's week.
 * @param {string} sessionId @param {string} day
 * @param {{ workouts: Array<{ id: string, date: string, sortOrder: number, startTime: string | null, match: any, liftSessionId?: string | null }>, activities: Array<{ id: string, date: string, sport?: string }>, lifts: Array<{ id: string, date: string }> }} range
 * @returns {{ planned: { id: string } | null, activityId: string | null }}
 */
export function sessionPairing(sessionId, day, range) {
  const id = sessionId.toLowerCase();
  const planned =
    range.workouts.find((w) => w.match?.source === 'lift' && String(w.match.id).toLowerCase() === id) ??
    range.workouts.find((w) => String(w.liftSessionId ?? '').toLowerCase() === id) ??
    null;
  if (planned) return { planned, activityId: planned.match?.source === 'lift' ? (planned.match.activityId ?? null) : null };
  const items = cellItems(
    range.workouts.filter((w) => w.date === day),
    range.activities.filter((a) => a.date === day),
    range.lifts.filter((l) => l.date === day)
  );
  const mine = /** @type {any} */ (items.find((i) => i.kind === 'lift' && 'l' in i && String(i.l.id).toLowerCase() === id));
  return { planned: null, activityId: mine?.a?.id ?? null };
}
