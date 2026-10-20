#!/usr/bin/env node
/**
 * Quality-rotation state — which above-threshold session comes next.
 *
 * The variety mandate alternates bike VO2 ↔ run intervals week to week. This derives the last quality session
 * actually *planned* (from the plans in the database) so the next one is deterministic rather than eyeballed.
 * Eyeballing is how the weeks of 2026-07-06 and 2026-07-13 both ended up as ride-vo2.
 *
 * `rotationFromPlans` is pure (tested in rotation.test.mjs); `loadRotation` reads the database.
 */

const QUALITY_TYPES = ['ride-vo2', 'run-intervals', 'run-tempo', 'ride-sst'];
const DEFAULT = { lastQuality: null, lastQualityWeek: null, nextQuality: 'ride-vo2' };

/**
 * @param {{ weekStart: string, events?: { workoutType?: string | null, start?: string }[] | null }[]} plans
 * @param {string} targetKey the Monday being planned ('YYYY-MM-DD'); plans on/after it are ignored, so re-running
 *   /plan for a week doesn't read its own output and flip the rotation.
 */
export function rotationFromPlans(plans, targetKey) {
  const prior = plans
    .filter((p) => typeof p?.weekStart === 'string' && p.weekStart < targetKey)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  for (const plan of prior) {
    const q = (Array.isArray(plan.events) ? plan.events : [])
      .filter((e) => QUALITY_TYPES.includes(e?.workoutType))
      .sort((a, b) => String(a.start).localeCompare(String(b.start)))
      .at(-1);
    if (q) {
      return {
        lastQuality: q.workoutType,
        lastQualityWeek: plan.weekStart,
        nextQuality: q.workoutType.startsWith('ride') ? 'run-intervals' : 'ride-vo2',
      };
    }
  }
  return { ...DEFAULT };
}

/** The rotation for `targetKey` from the user's plans in the database (training_plans and their workouts). */
export async function loadRotation(sql, userId, targetKey) {
  try {
    const rows = await sql`
      SELECT p.week_start_date, a.workout_type, a.scheduled_date, a.start_time
      FROM training_plans p JOIN training_plan_activities a ON a.plan_id = p.id
      WHERE p.user_id = ${userId} AND p.week_start_date < ${targetKey} AND a.status <> 'skipped'`;
    const byWeek = new Map();
    for (const r of rows) {
      const week = new Date(r.week_start_date).toISOString().slice(0, 10);
      const day = new Date(r.scheduled_date).toISOString().slice(0, 10);
      if (!byWeek.has(week)) byWeek.set(week, { weekStart: week, events: [] });
      byWeek.get(week).events.push({ workoutType: r.workout_type, start: `${day}T${r.start_time ?? '00:00'}` });
    }
    return rotationFromPlans([...byWeek.values()], targetKey);
  } catch (e) {
    console.error('rotation state fail (defaulting to ride-vo2):', e.message);
    return { ...DEFAULT };
  }
}
