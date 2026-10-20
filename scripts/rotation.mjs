#!/usr/bin/env node
/**
 * Workout rotation state: which bank workout comes next, and how each one went last time.
 *
 * plans/PLAN-STRUCTURE.md (the coach's "Paolo Plan" PDF) gives a fixed order for the workout days:
 *   Threshold A → VO2 A → VO2 B → Threshold B → Threshold A → VO2 A → (repeat)
 * Each bank workout has its own progression, applied only when the last one was done.
 *
 * A planned workout names its bank workout in workoutType as `<sport>-<bank>`, e.g. `ride-threshold-a`,
 * `run-vo2-b`. A 10k test is `run-test-10k`; it is outside the order. Older types (`ride-vo2`, `run-intervals`)
 * are not bank workouts and are ignored.
 *
 * `rotationFromPlans` is pure (tested in rotation.test.mjs); `loadRotation` reads the database.
 */

export const ORDER = ['threshold-a', 'vo2-a', 'vo2-b', 'threshold-b', 'threshold-a', 'vo2-a'];
export const BANK = ['threshold-a', 'threshold-b', 'vo2-a', 'vo2-b', 'tempo'];
export const TEST_10K = 'run-test-10k';

/** `ride-threshold-a` → { sport: 'ride', bank: 'threshold-a' }; null when the type is not a bank workout. */
export function parseType(type) {
  const m = /^(ride|run)-(threshold-[ab]|vo2-[ab]|tempo)$/.exec(String(type ?? ''));
  return m ? { sport: m[1], bank: m[2] } : null;
}

/**
 * The place in ORDER after the history. The order repeats names (Threshold A and VO2 A are in it twice), so the
 * place comes from the longest end of the history that matches the order; a tie takes the earliest place.
 * @param {string[]} history bank names of the ORDER workouts, oldest first
 * @returns {number} the index in ORDER of the next workout
 */
export function nextIndex(history) {
  const h = history.filter((b) => ORDER.includes(b));
  if (h.length === 0) return 0;
  let best = { len: -1, pos: 0 };
  for (let pos = 0; pos < ORDER.length; pos++) {
    let len = 0;
    while (len < h.length && h[h.length - 1 - len] === ORDER[(pos - len + ORDER.length * h.length) % ORDER.length]) len++;
    if (len > best.len) best = { len, pos };
  }
  return (best.pos + 1) % ORDER.length;
}

const LABEL = { 'threshold-a': 'Threshold A', 'threshold-b': 'Threshold B', 'vo2-a': 'VO2 A', 'vo2-b': 'VO2 B', tempo: 'Tempo' };
export const label = (bank) => LABEL[bank] ?? bank;

/**
 * @param {{ weekStart: string, events?: { workoutType?: string | null, start?: string, intensity?: string | null, done?: boolean }[] | null }[]} plans
 * @param {string} targetKey the Monday being planned ('YYYY-MM-DD'); plans on/after it are ignored, so re-running
 *   /plan for a week does not read its own output.
 */
export function rotationFromPlans(plans, targetKey) {
  const events = plans
    .filter((p) => typeof p?.weekStart === 'string' && p.weekStart < targetKey)
    .flatMap((p) => (Array.isArray(p.events) ? p.events : []))
    .filter((e) => e && typeof e.start === 'string')
    .sort((a, b) => a.start.localeCompare(b.start));

  const bankEvents = events.flatMap((e) => {
    const t = parseType(e.workoutType);
    return t ? [{ ...t, date: e.start.slice(0, 10), intensity: e.intensity ?? null, level: e.level ?? null, done: Boolean(e.done) }] : [];
  });
  const i = nextIndex(bankEvents.map((e) => e.bank));
  const next = [0, 1, 2].map((k) => ORDER[(i + k) % ORDER.length]);

  /** The newest of each bank workout: what it was, and whether it was done (then progress it; else repeat). */
  const last = {};
  for (const e of bankEvents) last[e.bank] = { date: e.date, sport: e.sport, intensity: e.intensity, ...(e.level != null ? { level: e.level } : {}), done: e.done };

  const tests = events.filter((e) => e.workoutType === TEST_10K);
  const lastTest = tests.at(-1)?.start.slice(0, 10) ?? null;
  const weeksSinceTest = lastTest
    ? Math.floor((Date.parse(`${targetKey}T00:00:00Z`) - Date.parse(`${lastTest}T00:00:00Z`)) / (7 * 86_400_000))
    : null;

  return {
    next, // the next three workouts in order; a week with 3 workout days uses all three
    nextLabels: next.map(label),
    last,
    lastTest10k: lastTest,
    weeksSinceTest10k: weeksSinceTest,
    test10kDue: weeksSinceTest == null || weeksSinceTest >= 6,
  };
}

/** The rotation for `targetKey` from the user's plans in the database, with done = a Strava activity of that sport that day. */
export async function loadRotation(sql, userId, targetKey) {
  try {
    const rows = await sql`
      SELECT to_char(p.week_start_date, 'YYYY-MM-DD') AS week, to_char(a.scheduled_date, 'YYYY-MM-DD') AS day,
        a.workout_type, a.start_time, a.intensity, (a.steps->>'level')::int AS level,
        EXISTS (
          SELECT 1 FROM strava_activities s
          WHERE s.user_id = p.user_id AND s.start_date_local::date = a.scheduled_date::date
            AND s.sport_type ILIKE CASE WHEN a.workout_type LIKE 'ride-%' THEN '%ride%' ELSE '%run%' END
        ) AS done
      FROM training_plans p JOIN training_plan_activities a ON a.plan_id = p.id
      WHERE p.user_id = ${userId} AND p.week_start_date < ${targetKey} AND a.status <> 'skipped'`;
    const byWeek = new Map();
    for (const r of rows) {
      if (!byWeek.has(r.week)) byWeek.set(r.week, { weekStart: r.week, events: [] });
      byWeek.get(r.week).events.push({
        workoutType: r.workout_type, start: `${r.day}T${r.start_time ?? '00:00'}`, intensity: r.intensity, level: r.level, done: Boolean(r.done),
      });
    }
    return rotationFromPlans([...byWeek.values()], targetKey);
  } catch (e) {
    console.error('rotation state failed (starting the order at Threshold A):', e.message);
    return rotationFromPlans([], targetKey);
  }
}
