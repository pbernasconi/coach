// The Lift overview page (/lift): this week, consistency, main lifts and PRs, sets per muscle against the
// 10-20 band, the session list, and plain rule-based tips. Pure, so it is tested with `node --test`.
//
// Every number comes from the synced Lift rows (./stats.mjs). The tips are fixed rules over those numbers, each
// with the numbers that triggered it; nothing is generated.

import { MUSCLE_TARGET, convert, epley, exerciseList, isCountedSet, muscleSets, sessionSummaries, weekStart } from './stats.mjs';

const DAY_MS = 86_400_000;
/** @param {string} a @param {string} b */
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
/** @param {string} day @param {number} n */
export const shiftDay = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** Muscles that make the arms, as the Lift catalog names them. */
export const ARMS = ['biceps', 'triceps'];
/** The big muscle groups a week of training should reach (catalog names). */
const MAJOR = ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes', 'biceps', 'triceps'];

/**
 * @typedef {'good' | 'warn' | 'info'} Tone
 * @typedef {{ id: string, tone: Tone, title: string, body: string, href?: string }} Tip
 */

/**
 * Personal records: each time a session's best estimated 1RM for an exercise beats every earlier session's.
 * The first session of an exercise sets a baseline, not a record. Newest first.
 * @param {ReturnType<typeof import('./stats.mjs').buildModel>} model
 * @param {'kg' | 'lb'} unit
 */
export function personalRecords(model, unit) {
  /** @type {Map<string, Map<string, { day: string, sessionId: string, key: string, name: string, e1rm: number, reps: number, weight: number }>>} */
  const byExercise = new Map();
  for (const set of model.sets) {
    if (!isCountedSet(set) || set.reps === null || set.weight === null) continue;
    const weight = convert(set.weight, set.unit, unit);
    const e1rm = epley(set.reps, weight);
    if (e1rm === null) continue;
    let sessions = byExercise.get(set.exerciseKey);
    if (!sessions) byExercise.set(set.exerciseKey, (sessions = new Map()));
    const prev = sessions.get(set.sessionId);
    if (!prev || e1rm > prev.e1rm) {
      sessions.set(set.sessionId, { day: set.day, sessionId: set.sessionId, key: set.exerciseKey, name: set.exerciseName, e1rm, reps: set.reps, weight });
    }
  }
  const records = [];
  for (const sessions of byExercise.values()) {
    const ordered = [...sessions.values()].sort((a, b) => a.day.localeCompare(b.day) || a.sessionId.localeCompare(b.sessionId));
    let best = null;
    for (const s of ordered) {
      // Half a unit of noise is not a record (a rounding of the same set).
      if (best !== null && s.e1rm > best + 0.5) records.push({ ...s, previous: best, catalogId: model.library.get(s.key)?.catalogId ?? null });
      best = best === null ? s.e1rm : Math.max(best, s.e1rm);
    }
  }
  return records.sort((a, b) => b.day.localeCompare(a.day) || b.e1rm - a.e1rm);
}

/**
 * Everything the /lift overview shows, for `today` ('YYYY-MM-DD' in the athlete's time zone).
 * @param {ReturnType<typeof import('./stats.mjs').buildModel>} model
 * @param {'kg' | 'lb'} unit
 * @param {string} today
 * @param {{ strengthTarget?: number, weightKg?: number | null, weeks?: number }} [options]
 */
export function liftOverview(model, unit, today, { strengthTarget = 2, weightKg = null, weeks: weekCount = 16 } = {}) {
  const monday = weekStart(today);
  const all = sessionSummaries(model, unit, { planned: true });
  // Logged sessions up to today; anything dated later is a plan, even with a set ticked by mistake.
  const logged = all.filter((s) => s.setsLogged > 0 && s.day <= today);
  const planned = all
    .filter((s) => s.setsLogged === 0 && s.day >= today)
    .sort((a, b) => a.day.localeCompare(b.day));

  // ---- Per-session extras: exercises, minutes, muscles, records ----
  const prs = personalRecords(model, unit);
  const prsBySession = new Map();
  for (const r of prs) prsBySession.set(r.sessionId, [...(prsBySession.get(r.sessionId) ?? []), r]);
  const exercisesBySession = new Map();
  const musclesBySession = new Map();
  for (const set of model.sets) {
    if (!isCountedSet(set)) continue;
    let ex = exercisesBySession.get(set.sessionId);
    if (!ex) exercisesBySession.set(set.sessionId, (ex = new Set()));
    ex.add(set.exerciseKey);
    const m = model.muscles.get(set.exerciseKey);
    if (!m) continue;
    let tally = musclesBySession.get(set.sessionId);
    if (!tally) musclesBySession.set(set.sessionId, (tally = new Map()));
    for (const muscle of m.primary) tally.set(muscle, (tally.get(muscle) ?? 0) + 1);
    for (const muscle of m.secondary) tally.set(muscle, (tally.get(muscle) ?? 0) + 0.5);
  }
  const minutesOf = (/** @type {string} */ id) => {
    const s = model.sessions.get(id);
    const a = s?.startedAt ? Date.parse(s.startedAt) : NaN;
    const b = s?.finishedAt ? Date.parse(s.finishedAt) : NaN;
    const m = Math.round((b - a) / 60000);
    return Number.isFinite(m) && m > 0 && m < 600 ? m : null;
  };
  const plannedSets = new Map();
  for (const set of model.sets) {
    if (set.kind !== 'warmUp') plannedSets.set(set.sessionId, (plannedSets.get(set.sessionId) ?? 0) + 1);
  }
  const plannedExercises = new Map();
  for (const se of model.sessionExercises.values()) plannedExercises.set(se.sessionId, (plannedExercises.get(se.sessionId) ?? 0) + 1);

  const sessions = logged.map((s) => ({
    id: s.id,
    day: s.day,
    title: s.title,
    sets: s.setsLogged,
    volume: s.volume,
    exercises: exercisesBySession.get(s.id)?.size ?? 0,
    minutes: minutesOf(s.id),
    muscles: [...(musclesBySession.get(s.id) ?? new Map()).entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([muscle]) => muscle),
    prs: (prsBySession.get(s.id) ?? []).map((/** @type {{ name: string }} */ r) => r.name),
  }));
  const upcoming = planned.slice(0, 3).map((s) => ({
    id: s.id,
    day: s.day,
    title: s.title,
    exercises: plannedExercises.get(s.id) ?? 0,
    sets: plannedSets.get(s.id) ?? 0,
  }));

  // ---- Weeks and days ----
  const firstMonday = shiftDay(monday, -7 * (weekCount - 1));
  /** @type {{ week: string, sessions: number, sets: number, volume: number }[]} */
  const weeks = Array.from({ length: weekCount }, (_, i) => ({ week: shiftDay(firstMonday, 7 * i), sessions: 0, sets: 0, volume: 0 }));
  const weekIndex = new Map(weeks.map((w, i) => [w.week, i]));
  /** @type {Map<string, { sets: number, sessionId: string, title: string }>} */
  const days = new Map();
  for (const s of logged) {
    const w = weeks[weekIndex.get(weekStart(s.day)) ?? -1];
    if (w) {
      w.sessions += 1;
      w.sets += s.setsLogged;
      w.volume += s.volume;
    }
    const d = days.get(s.day);
    days.set(s.day, { sets: (d?.sets ?? 0) + s.setsLogged, sessionId: d?.sessionId ?? s.id, title: d ? `${d.title} + ${s.title}` : s.title });
  }
  const calendar = weeks.map((w) =>
    Array.from({ length: 7 }, (_, i) => {
      const day = shiftDay(w.week, i);
      const d = days.get(day);
      return { day, future: day > today, sets: d?.sets ?? 0, sessionId: d?.sessionId ?? null, title: d?.title ?? null };
    })
  );

  const thisWeek = weeks.at(-1) ?? { week: monday, sessions: 0, sets: 0, volume: 0 };
  const pastWeeks = weeks.slice(0, -1);
  const last8 = pastWeeks.slice(-8);
  const hits = last8.filter((w) => w.sessions >= strengthTarget).length;
  let streak = 0;
  // A streak counts finished weeks at target, and this week once it is at target.
  for (const w of [...(thisWeek.sessions >= strengthTarget ? weeks : pastWeeks)].reverse()) {
    if (w.sessions >= strengthTarget) streak += 1;
    else break;
  }
  const avg8 = last8.reduce((n, w) => n + w.sessions, 0) / Math.max(1, last8.length);

  const last = logged[0] ?? null;
  const daysSince = last ? daysBetween(last.day, today) : null;

  // ---- Sets per muscle: this week, and the average of the 4 weeks before ----
  const weekRows = muscleSets(model, monday, today);
  const fourRows = muscleSets(model, shiftDay(monday, -28), shiftDay(monday, -1));
  const names = new Set([...weekRows.map((r) => r.muscle), ...fourRows.map((r) => r.muscle), ...MAJOR]);
  const muscles = [...names]
    .map((muscle) => ({
      muscle,
      week: weekRows.find((r) => r.muscle === muscle)?.sets ?? 0,
      avg: (fourRows.find((r) => r.muscle === muscle)?.sets ?? 0) / 4,
      arm: ARMS.includes(muscle),
    }))
    .sort((a, b) => Number(b.arm) - Number(a.arm) || b.avg - a.avg || b.week - a.week || a.muscle.localeCompare(b.muscle));

  // ---- Main lifts: the exercises done most in 12 weeks, with their whole history ----
  const since = shiftDay(monday, -77);
  const lifts = exerciseList(model, unit)
    .map((e) => {
      const perSession = new Map();
      for (const set of model.sets) {
        if (set.exerciseKey !== e.key || !isCountedSet(set) || set.reps === null || set.weight === null || set.day > today) continue;
        const weight = convert(set.weight, set.unit, unit);
        const est = epley(set.reps, weight);
        if (est === null) continue;
        const prev = perSession.get(set.sessionId);
        if (!prev || est > prev.e1rm) perSession.set(set.sessionId, { day: set.day, sessionId: set.sessionId, e1rm: est, reps: set.reps, weight });
      }
      const points = [...perSession.values()].sort((a, b) => a.day.localeCompare(b.day));
      const recent = points.filter((p) => p.day >= since);
      const best = points.reduce((m, p) => (m === null || p.e1rm > m.e1rm ? p : m), /** @type {null | typeof points[number]} */ (null));
      const first = recent[0]?.e1rm ?? null;
      const latest = recent.at(-1) ?? null;
      return {
        key: e.key,
        name: e.name,
        catalogId: model.library.get(e.key)?.catalogId ?? null,
        sessions: recent.length,
        points: points.slice(-16),
        latest,
        best,
        change: first && latest && recent.length > 1 ? (latest.e1rm - first) / first : null,
        prDay: prs.find((r) => r.key === e.key)?.day ?? null,
      };
    })
    .filter((l) => l.sessions > 0)
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name))
    .slice(0, 6);

  // ---- Ready to add weight: every working set of the last session reached the top of its rep range ----
  /** @type {Map<string, { day: string, name: string, sets: { reps: number | null, max: number | null }[] }>} */
  const lastByExercise = new Map();
  for (const set of model.sets) {
    if (!isCountedSet(set) || set.day > today) continue;
    const cur = lastByExercise.get(set.exerciseKey);
    if (cur && cur.day > set.day) continue;
    const entry = cur && cur.day === set.day ? cur : { day: set.day, name: set.exerciseName, sets: [] };
    entry.sets.push({ reps: set.reps, max: set.targetRepMax ?? set.targetReps });
    lastByExercise.set(set.exerciseKey, entry);
  }
  const ready = [...lastByExercise.entries()]
    .filter(([, e]) => e.day >= shiftDay(today, -42) && e.sets.length > 0 && e.sets.every((s) => s.max !== null && s.reps !== null && s.reps >= s.max))
    .sort((a, b) => b[1].day.localeCompare(a[1].day))
    .map(([key, e]) => ({ key, name: e.name, day: e.day }));

  const tips = buildTips({
    today, monday, strengthTarget, daysSince, last, thisWeek, avg8, hits, last8: last8.length, muscles, lifts, prs, ready, upcoming, weightKg, unit,
  });

  return {
    today,
    monday,
    unit,
    strengthTarget,
    thisWeek,
    weeks,
    calendar,
    streak,
    hits,
    avg8,
    last,
    daysSince,
    upcoming,
    sessions,
    muscles,
    lifts,
    prs: prs.filter((r) => r.day <= today).slice(0, 8),
    ready,
    tips,
    totals: { sessions: logged.length, exercises: exerciseList(model, unit).length, volume: logged.reduce((n, s) => n + s.volume, 0) },
    band: MUSCLE_TARGET,
  };
}

/** @param {number} n */
const r1 = (n) => Math.round(n * 10) / 10;
/** @param {string} m */
const label = (m) => m.charAt(0).toUpperCase() + m.slice(1);
/** @param {string[]} list */
const join = (list) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);

/**
 * Fixed rules over the numbers, most pressing first. Each tip names the numbers behind it.
 * @param {any} x
 * @returns {Tip[]}
 */
function buildTips(x) {
  /** @type {Tip[]} */
  const tips = [];
  const daysLeft = 7 - daysBetween(x.monday, x.today) - 1;

  // 1. Time since the last lift.
  if (x.daysSince === null) {
    tips.push({ id: 'none', tone: 'info', title: 'No sessions logged yet', body: 'Log a session in Lift and it shows up here after the next sync.' });
  } else if (x.daysSince >= 10) {
    tips.push({
      id: 'gap',
      tone: 'warn',
      title: `${x.daysSince} days since your last lift`,
      body: 'Ease back in: 2 sets per exercise at about 3 reps in reserve for the first week, so soreness does not cost you the long run. Back to full sets the week after.',
      href: x.last ? `/lift/sessions/${x.last.id}` : undefined,
    });
  }

  // 2. This week against the target.
  const done = x.thisWeek.sessions;
  if (done >= x.strengthTarget) {
    tips.push({ id: 'week', tone: 'good', title: `Strength target hit: ${done} of ${x.strengthTarget} this week`, body: 'Anything more this week is a bonus. Keep the legs fresh for the long run.' });
  } else if (daysLeft >= 0) {
    const need = x.strengthTarget - done;
    const next = x.upcoming.find((/** @type {{ day: string }} */ u) => u.day <= weekEnd(x.monday));
    tips.push({
      id: 'week',
      tone: need > daysLeft + 1 ? 'warn' : 'info',
      title: `${done} of ${x.strengthTarget} sessions this week`,
      body: next
        ? `${next.title || 'A session'} is planned for ${weekday(next.day)}.${need > 1 ? ` Put the other one at least 48 hours later.` : ''}`
        : `${need} to go with ${daysLeft + 1} ${daysLeft ? 'days' : 'day'} left. Keep 48 hours between them, and away from the day before the long run.`,
      href: next ? `/lift/sessions/${next.id}` : '/plan',
    });
  }

  // 3. Arms, the goal of this block.
  const arm = (/** @type {string} */ m) => x.muscles.find((/** @type {{ muscle: string }} */ r) => r.muscle === m) ?? { week: 0, avg: 0 };
  const bi = arm('biceps');
  const tri = arm('triceps');
  const lowArms = [bi, tri].some((r) => r.avg < MUSCLE_TARGET.min);
  tips.push({
    id: 'arms',
    tone: lowArms ? 'warn' : 'good',
    title: lowArms ? 'Arms are under the growth range' : 'Arms are in the growth range',
    body: `Biceps ${r1(bi.avg)} and triceps ${r1(tri.avg)} hard sets a week over the last 4 weeks (${r1(bi.week)} and ${r1(tri.week)} so far this week); 10–20 a week grows them. ${
      lowArms ? 'Put 3–4 sets of curls and 3–4 of triceps work in each upper day, close to failure on the last set.' : 'Keep adding a rep or a little weight each week.'
    }`,
    href: '#muscles',
  });

  // 4. Big muscle groups below the band (not arms, already above).
  const low = x.muscles.filter((/** @type {{ arm: boolean, avg: number, muscle: string }} */ r) => !r.arm && MAJOR.includes(r.muscle) && r.avg < 10 / 2);
  if (low.length && x.daysSince !== null) {
    tips.push({
      id: 'low',
      tone: 'info',
      title: `Light on ${join(low.slice(0, 3).map((/** @type {{ muscle: string }} */ r) => r.muscle))}`,
      body: `${join(low.slice(0, 3).map((/** @type {{ muscle: string, avg: number }} */ r) => `${label(r.muscle)} ${r1(r.avg)}`))} sets a week over 4 weeks. Half the target keeps them; 10+ grows them.`,
      href: '#muscles',
    });
  }

  // 5. Records in the last 2 weeks.
  const fresh = x.prs.filter((/** @type {{ day: string }} */ r) => r.day >= shiftDay(x.today, -14) && r.day <= x.today);
  if (fresh.length) {
    tips.push({
      id: 'prs',
      tone: 'good',
      title: `${fresh.length} new ${fresh.length === 1 ? 'record' : 'records'} in 2 weeks`,
      body: `${join([...new Set(fresh.map((/** @type {{ name: string }} */ r) => r.name))].slice(0, 3))}. Strength is coming up while you train for the long runs.`,
      href: '#records',
    });
  }

  // 6. Ready to add weight.
  if (x.ready.length) {
    tips.push({
      id: 'ready',
      tone: 'good',
      title: 'Ready to add weight',
      body: `${join(x.ready.slice(0, 3).map((/** @type {{ name: string }} */ r) => r.name))}: every set reached the top of the rep range last time. Add the smallest step (2.5 kg / 5 lb, 1–2 kg on dumbbells) next session.`,
      href: `/lift/exercises/${encodeURIComponent(x.ready[0].key)}`,
    });
  }

  // 7. Stalled main lifts: no new best in the last 3 sessions, with at least 4 in 12 weeks.
  const stalled = x.lifts.filter((/** @type {any} */ l) => {
    if (l.sessions < 4) return false;
    const pts = l.points;
    const before = Math.max(...pts.slice(0, -3).map((/** @type {{ e1rm: number }} */ p) => p.e1rm));
    return pts.slice(-3).every((/** @type {{ e1rm: number }} */ p) => p.e1rm <= before);
  });
  if (stalled.length) {
    tips.push({
      id: 'stalled',
      tone: 'info',
      title: `${join(stalled.slice(0, 2).map((/** @type {{ name: string }} */ l) => l.name))} ${stalled.length === 1 ? 'has' : 'have'} stalled`,
      body: 'No new best in the last 3 sessions. Change the rep range for 3 weeks (from 5s to 8–10s, or the reverse), or add one set.',
      href: `/lift/exercises/${encodeURIComponent(stalled[0].key)}`,
    });
  }

  // 8. Consistency over 8 weeks.
  if (x.last8 > 0 && x.daysSince !== null) {
    tips.push({
      id: 'consistency',
      tone: x.avg8 >= x.strengthTarget ? 'good' : 'info',
      title: `${r1(x.avg8)} sessions a week over 8 weeks`,
      body: `${x.hits} of the last ${x.last8} weeks reached ${x.strengthTarget}. ${
        x.avg8 >= x.strengthTarget ? 'That is enough to keep growing.' : 'Two short sessions beat one long one: 45 minutes, 5–6 exercises.'
      }`,
      href: '#consistency',
    });
  }

  // 9. Lean: protein for the cut.
  if (x.weightKg) {
    const lo = Math.round((x.weightKg * 1.8) / 5) * 5;
    const hi = Math.round((x.weightKg * 2.2) / 5) * 5;
    tips.push({
      id: 'protein',
      tone: 'info',
      title: `Protein: ${lo}–${hi} g a day`,
      body: `1.8–2.2 g per kg at ${r1(x.weightKg)} kg keeps the muscle while you lose the belly. 30–40 g within 2 hours of each lift, and a deficit of 300–500 kcal, not more.`,
      href: '/health',
    });
  }
  return tips;
}

/** @param {string} monday */
const weekEnd = (monday) => shiftDay(monday, 6);
/** @param {string} day */
const weekday = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

