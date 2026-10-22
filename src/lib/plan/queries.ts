import { sql } from '@/db';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { sessionSummaries } from '@/lib/lift-dashboard/stats.mjs';
import { addDays, adaptForFeel, matchWeek, mondayOf, sportOfStrava, undoAdapts } from './week.mjs';
import { toDay } from '@/lib/db-time.mjs';
import { cleanReason, feelForSkip } from './skip.mjs';
import { followWorkoutInLift } from '@/lib/lift/edit-store';

/** A structured workout (src/lib/workouts/steps.mjs). */
export type StructuredWorkout = { version: 1; sport: 'ride' | 'run'; name: string; bank?: string; level?: number; notes?: string; steps: unknown[] };

export type Feel = 'wrecked' | 'tired' | 'ok' | 'fresh';
export const FEELS: Feel[] = ['wrecked', 'tired', 'ok', 'fresh'];

export type Workout = {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  title: string;
  sport: string;
  workoutType: string | null;
  intensity: string | null;
  duration: number | null;
  /** Planned distance in meters, when the plan has one. */
  distance?: number | null;
  tss: number | null;
  why: string | null;
  description: string | null;
  status: 'planned' | 'skipped';
  /** Why it was skipped (src/lib/plan/skip.mjs), or null. */
  skipReason: string | null;
  adaptedFrom: Record<string, unknown> | null;
  sortOrder: number;
  /** The workout as steps (src/lib/workouts/steps.mjs), or null for a text-only workout. */
  steps?: StructuredWorkout | null;
  // Derived for display
  state: 'done' | 'skipped' | 'missed' | 'today' | 'planned';
  /** For a Lift match, `activityId` is the day's Strava strength activity (the watch), when there is one. */
  match: { source: 'strava' | 'lift'; id: string; name: string; activityId?: string | null } | null;
};

export type DayActivity = { id: string; date: string; sport: string; sportType: string; name: string; km: number; min: number };
export type DayLift = { id: string; date: string; name: string; setsLogged: number };

export type Week = {
  weekStart: string;
  today: string;
  planId: string | null;
  title: string | null;
  workouts: Workout[];
  activities: DayActivity[];
  lifts: DayLift[];
  feel: Feel | null;
};

type Row = Record<string, unknown>;

/** The single user (Coach is personal): the first row in users. */
export async function ownerId(): Promise<string | null> {
  const [u] = (await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`) as Row[];
  return u ? String(u.id) : null;
}

async function planRow(userId: string, weekStart: string) {
  const [p] = (await sql`
    SELECT id, context_data, feel_log FROM training_plans
    WHERE user_id = ${userId} AND week_start_date = ${weekStart} LIMIT 1`) as Row[];
  return p ?? null;
}

async function workoutRows(planId: string) {
  return (await sql`
    SELECT id, scheduled_date, start_time, end_time, title, activity_type, workout_type, intensity, duration, tss,
           why, description, status, skip_reason, adapted_from, sort_order
    FROM training_plan_activities WHERE plan_id = ${planId}
    ORDER BY scheduled_date, sort_order, start_time NULLS LAST`) as Row[];
}

function toWorkout(r: Row): Omit<Workout, 'state' | 'match'> {
  return {
    id: String(r.id),
    date: toDay(r.scheduled_date) ?? '',
    startTime: (r.start_time as string) ?? null,
    endTime: (r.end_time as string) ?? null,
    title: String(r.title),
    sport: String(r.activity_type ?? 'other'),
    workoutType: (r.workout_type as string) ?? null,
    intensity: (r.intensity as string) ?? null,
    duration: (r.duration as number) ?? null,
    tss: (r.tss as number) ?? null,
    why: (r.why as string) ?? null,
    description: (r.description as string) ?? null,
    status: r.status === 'skipped' ? 'skipped' : 'planned',
    skipReason: r.status === 'skipped' ? ((r.skip_reason as string) ?? null) : null,
    adaptedFrom: (r.adapted_from as Record<string, unknown>) ?? null,
    sortOrder: Number(r.sort_order ?? 0),
  };
}

async function activitiesBetween(userId: string, from: string, to: string): Promise<DayActivity[]> {
  const rows = (await sql`
    SELECT strava_activity_id, start_date_local, sport_type, name, distance, moving_time
    FROM strava_activities
    WHERE user_id = ${userId} AND start_date_local >= ${from} AND start_date_local < ${addDays(to, 1)}
    ORDER BY start_date_local`) as Row[];
  return rows.map((r) => ({
    id: String(r.strava_activity_id),
    date: toDay(r.start_date_local) ?? '',
    sport: sportOfStrava(r.sport_type),
    sportType: String(r.sport_type ?? ''),
    name: String(r.name ?? ''),
    km: Math.round(Number(r.distance ?? 0) / 100) / 10,
    min: Math.round(Number(r.moving_time ?? 0) / 60),
  }));
}

async function liftsBetween(from: string, to: string): Promise<DayLift[]> {
  const { model, unit } = await loadLiftModel();
  return sessionSummaries(model, unit)
    // Planned Lift sessions with nothing logged are not done lifts.
    .filter((s: { day: string; setsLogged: number }) => s.day >= from && s.day <= to && s.setsLogged > 0)
    .map((s: { id: string; day: string; title: string; setsLogged: number }) => ({
      id: s.id,
      date: s.day,
      name: s.title || 'Lift session',
      setsLogged: s.setsLogged,
    }));
}

export async function loadWeek(userId: string, weekStart: string, today: string): Promise<Week> {
  const weekEnd = addDays(weekStart, 6);
  const [plan, activities, lifts] = await Promise.all([
    planRow(userId, weekStart),
    activitiesBetween(userId, weekStart, weekEnd),
    liftsBetween(weekStart, weekEnd),
  ]);
  const base = plan ? (await workoutRows(String(plan.id))).map(toWorkout) : [];
  const matched = matchWeek(base, activities, lifts, today);
  const workouts: Workout[] = base.map((w) => {
    const m = matched.get(w.id) as { status: Workout['state']; match: Workout['match'] };
    return { ...w, state: m.status, match: m.match };
  });
  const feelLog = (plan?.feel_log as { date: string; feel: Feel }[] | undefined) ?? [];
  const context = (plan?.context_data as { title?: string } | null) ?? null;
  return {
    weekStart,
    today,
    planId: plan ? String(plan.id) : null,
    title: context?.title ?? null,
    workouts,
    activities,
    lifts,
    feel: feelLog.filter((f) => f.date === today).at(-1)?.feel ?? null,
  };
}

/** Plan id for a week, creating an empty plan when the week has none (so a workout can be added or moved in). */
export async function ensurePlan(userId: string, weekStart: string): Promise<string> {
  const existing = await planRow(userId, weekStart);
  if (existing) return String(existing.id);
  const [p] = (await sql`
    INSERT INTO training_plans (id, user_id, week_start_date, week_end_date, plan_content, ai_model, status)
    VALUES (${crypto.randomUUID()}, ${userId}, ${weekStart}, ${addDays(weekStart, 6)}, '', 'web', 'active')
    ON CONFLICT (user_id, week_start_date) DO UPDATE SET updated_at = NOW()
    RETURNING id`) as Row[];
  return String(p.id);
}

const COLUMN: Record<string, string> = {
  date: 'scheduled_date',
  title: 'title',
  intensity: 'intensity',
  duration: 'duration',
  tss: 'tss',
  description: 'description',
  workoutType: 'workout_type',
  status: 'status',
  skipReason: 'skip_reason',
};

/** Applies field changes to one workout the user owns. Marks it edited, so a re-import keeps the change. */
async function applyChanges(userId: string, id: string, changes: Record<string, unknown>) {
  const [owned] = (await sql`
    SELECT a.id FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
    WHERE a.id = ${id} AND p.user_id = ${userId}`) as Row[];
  if (!owned) throw new Error('workout not found');
  for (const [key, value] of Object.entries(changes)) {
    if (key === 'adaptedFrom') {
      await sql`UPDATE training_plan_activities SET adapted_from = ${value == null ? null : JSON.stringify(value)} WHERE id = ${id}`;
      continue;
    }
    const col = COLUMN[key];
    if (!col) continue;
    // Column names come from the fixed map above, never from input.
    await sql.query(`UPDATE training_plan_activities SET ${col} = $1 WHERE id = $2`, [value, id]);
  }
  await sql`UPDATE training_plan_activities SET edited_at = NOW(), updated_at = NOW() WHERE id = ${id}`;
  // A new day or status moves or removes its Lift session now, not at the next lift-plan.mjs run.
  if ('date' in changes || 'status' in changes) await followWorkoutInLift(id, { restore: changes.status === 'planned' });
}

/** A workout's day ('YYYY-MM-DD') when the user owns it, else null. */
export async function workoutDate(userId: string, id: string): Promise<string | null> {
  const [r] = (await sql`
    SELECT a.scheduled_date FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
    WHERE a.id = ${id} AND p.user_id = ${userId}`) as Row[];
  return r ? toDay(r.scheduled_date) : null;
}

/** Moves a workout to another day (and plan week, when the day is in another week). */
export async function moveWorkout(userId: string, id: string, date: string) {
  const planId = await ensurePlan(userId, mondayOf(date));
  await applyChanges(userId, id, { date });
  await sql`UPDATE training_plan_activities SET plan_id = ${planId} WHERE id = ${id}`;
}

/**
 * Skips a workout (with why) or puts it back. A skip of today's workout for fatigue also records how you feel, which
 * eases the next quality session (src/lib/plan/skip.mjs). Returns the number of other workouts changed.
 */
export async function setSkipped(userId: string, id: string, skipped: boolean, reason: string | null = null, today?: string) {
  const why = skipped ? cleanReason(reason) : null;
  await applyChanges(userId, id, { status: skipped ? 'skipped' : 'planned', skipReason: why });
  const date = today ? await workoutDate(userId, id) : null;
  const feel = skipped && date && today ? feelForSkip(why, date, today) : null;
  return feel ? setFeel(userId, mondayOf(today!), today!, feel) : 0;
}

/** Records how I feel today and adapts the rest of the week. Returns the number of workouts changed. */
export async function setFeel(userId: string, weekStart: string, today: string, feel: Feel) {
  const week = await loadWeek(userId, weekStart, today);
  if (!week.planId) return 0;
  const done = new Set(week.workouts.filter((w) => w.state === 'done').map((w) => w.id));
  const updates = adaptForFeel(week.workouts, feel, today, { done });
  for (const u of updates) await applyChanges(userId, u.id, u.changes);
  const entry = JSON.stringify([{ date: today, feel, at: new Date().toISOString() }]);
  await sql`UPDATE training_plans SET feel_log = feel_log || ${entry}::jsonb, updated_at = NOW() WHERE id = ${week.planId}`;
  return updates.length;
}

/** Undoes every adapt from today on. */
export async function undoWeek(userId: string, weekStart: string, today: string) {
  const week = await loadWeek(userId, weekStart, today);
  const updates = undoAdapts(week.workouts, today);
  for (const u of updates) await applyChanges(userId, u.id, u.changes);
  return updates.length;
}
