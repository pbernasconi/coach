import { sql } from '@/db';
import { toDay, toIso } from '@/lib/db-time.mjs';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { sessionSummaries } from '@/lib/lift-dashboard/stats.mjs';
import { richSession, type RichSession } from '@/lib/lift/session';
import type { Workout } from './queries';
import { complianceOf } from './compliance.mjs';
import { libraryFrom, monthWeeks, weekSummary } from './calendar.mjs';
import { addDays, matchWeek, mondayOf, sportOf, sportOfStrava } from './week.mjs';

export type Compliance = { level: string; label: string; ratio: number | null; basis: 'duration' | 'tss' | null };

export type CalendarActivity = {
  id: string;
  date: string;
  sport: string;
  name: string;
  km: number;
  min: number;
  tss: number | null;
  commute: boolean;
  url: string;
};

export type CalendarLift = { id: string; date: string; name: string; setsLogged: number };

/** imported: the row came from plans/<week>.json (a re-import adds it again after a remove). */
/** A Lift session in full: each exercise with its picture, its sets, their targets and what was logged. */
export type LiftSessionDetail = RichSession;

export type CalendarWorkout = Workout & {
  compliance: Compliance;
  actual: { min: number | null; tss: number | null } | null;
  imported: boolean;
  /** Strength: the Lift session planned for it (lift_session_id), else the Lift session that matched it. */
  lift: LiftSessionDetail | null;
  /** Where its steps were sent (intervals.icu → Zwift, Garmin), or null when never sent. */
  sync: { status: string; error: string | null; syncedAt: string | null } | null;
};

export type LoadRow = { date: string; ctl: number; atl: number; tsb: number };

export type WeekSummary = {
  monday: string;
  done: { min: number; km: number; tss: number; count: number; liftSessions: number; bySport: Record<string, number> };
  planned: { min: number; tss: number; count: number; done: number; missed: number };
  fitness: LoadRow | null;
};

export type CalendarRange = {
  today: string;
  weeks: string[]; // Mondays
  workouts: CalendarWorkout[];
  activities: CalendarActivity[];
  lifts: CalendarLift[];
  summaries: WeekSummary[];
};

export type LibraryItem = {
  id: string; // 'plan:<training_plan_activities.id>' or 'lift:<template id>'
  source: 'plan' | 'lift';
  sport: string;
  title: string;
  duration: number | null;
  tss: number | null;
  intensity: string | null;
  description: string | null;
  lastUsed: string | null;
  uses: number;
};

type Row = Record<string, unknown>;
const dayOf = (v: unknown) => toDay(v) ?? '';
const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

function toWorkout(r: Row): Omit<Workout, 'state' | 'match'> {
  return {
    id: String(r.id),
    date: dayOf(r.scheduled_date),
    startTime: (r.start_time as string) ?? null,
    endTime: (r.end_time as string) ?? null,
    title: String(r.title),
    sport: String(r.activity_type ?? 'other'),
    workoutType: (r.workout_type as string) ?? null,
    intensity: (r.intensity as string) ?? null,
    duration: num(r.duration),
    tss: num(r.tss),
    why: (r.why as string) ?? null,
    description: (r.description as string) ?? null,
    status: r.status === 'skipped' ? 'skipped' : 'planned',
    adaptedFrom: (r.adapted_from as Record<string, unknown>) ?? null,
    sortOrder: Number(r.sort_order ?? 0),
    steps: (r.steps as Workout['steps']) ?? null,
  };
}

/**
 * Everything the calendar shows for the weeks from `fromMonday` to `toMonday` (inclusive): planned workouts with
 * their match and compliance, Strava activities, Lift sessions, and one summary per week.
 */
export async function loadRange(userId: string, fromMonday: string, toMonday: string, today: string): Promise<CalendarRange> {
  const from = mondayOf(fromMonday);
  const to = addDays(mondayOf(toMonday), 6);
  const end = addDays(to, 1);
  const [planRows, actRows, loadRows, lift] = await Promise.all([
    sql`
      SELECT a.id, a.scheduled_date, a.start_time, a.end_time, a.title, a.activity_type, a.workout_type, a.intensity,
             a.duration, a.tss, a.why, a.description, a.status, a.adapted_from, a.sort_order, a.source_key,
             a.lift_session_id, a.steps,
             (SELECT json_build_object('status', s.status, 'error', s.last_error, 'syncedAt', s.synced_at)
                FROM workout_syncs s WHERE s.activity_id = a.id AND s.target = 'intervals') AS sync
      FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
      WHERE p.user_id = ${userId} AND a.scheduled_date >= ${from} AND a.scheduled_date < ${end}
      ORDER BY a.scheduled_date, a.sort_order, a.start_time NULLS LAST` as Promise<Row[]>,
    sql`
      SELECT strava_activity_id, start_date_local, sport_type, name, distance, moving_time, tss, commute
      FROM strava_activities
      WHERE user_id = ${userId} AND start_date_local >= ${from} AND start_date_local < ${end}
      ORDER BY start_date_local` as Promise<Row[]>,
    sql`
      SELECT date, ctl, atl, tsb FROM daily_training_load
      WHERE user_id = ${userId} AND date >= ${from} AND date < ${end} ORDER BY date` as Promise<Row[]>,
    loadLiftModel().catch((e) => {
      console.error('Lift model failed:', e);
      return null;
    }),
  ]);

  const activities: CalendarActivity[] = actRows.map((r) => ({
    id: String(r.strava_activity_id),
    date: dayOf(r.start_date_local),
    sport: sportOfStrava(r.sport_type),
    name: String(r.name ?? ''),
    km: Math.round(Number(r.distance ?? 0) / 100) / 10,
    min: Math.round(Number(r.moving_time ?? 0) / 60),
    tss: num(r.tss),
    commute: Boolean(r.commute),
    url: `/activities/${r.strava_activity_id}`,
  }));

  const lifts: CalendarLift[] = lift
    ? (sessionSummaries(lift.model, lift.unit) as { id: string; day: string; title: string; setsLogged: number }[])
        .filter((s) => s.day >= from && s.day <= to)
        .map((s) => ({ id: s.id, date: s.day, name: s.title || 'Lift session', setsLogged: s.setsLogged }))
    : [];

  const base = planRows.map(toWorkout);
  const imported = new Set(planRows.filter((r) => r.source_key).map((r) => String(r.id)));
  const matched = matchWeek(base, activities, lifts, today) as Map<string, { status: Workout['state']; match: Workout['match'] }>;
  const byStrava = new Map(activities.map((a) => [a.id, a]));
  const linked = new Map(planRows.map((r) => [String(r.id), r.lift_session_id ? String(r.lift_session_id) : null]));
  const syncOf = new Map(
    planRows.map((r) => {
      const s = r.sync as { status: string; error: string | null; syncedAt: unknown } | null;
      return [String(r.id), s ? { status: s.status, error: s.error, syncedAt: toIso(s.syncedAt) } : null] as const;
    })
  );
  const liftOf = (id: string | null) => (lift && id ? richSession(lift.model, id, lift.unit) : null);
  const workouts: CalendarWorkout[] = base.map((w) => {
    const m = matched.get(w.id)!;
    const liftDetail = liftOf(linked.get(w.id) ?? (m.match?.source === 'lift' ? m.match.id : null));
    const act = m.match?.source === 'strava' ? byStrava.get(m.match.id) : null;
    const actual = m.match ? { min: act?.min ?? null, tss: act?.tss ?? null } : null;
    const compliance = complianceOf(w, m.status, actual, { rest: sportOf(w) === 'rest' }) as Compliance;
    return { ...w, state: m.status, match: m.match, actual, compliance, imported: imported.has(w.id), lift: liftDetail, sync: syncOf.get(w.id) ?? null };
  });

  const load: LoadRow[] = loadRows.map((r) => ({ date: dayOf(r.date), ctl: Number(r.ctl), atl: Number(r.atl), tsb: Number(r.tsb) }));
  const weeks: string[] = [];
  for (let w = from; w <= to; w = addDays(w, 7)) weeks.push(w);
  const summaries = weeks.map((w) => weekSummary(w, { activities, lifts, workouts, load, today }) as WeekSummary);
  return { today, weeks, workouts, activities, lifts, summaries };
}

/** The month calendar for 'YYYY-MM'. */
export function loadMonth(userId: string, month: string, today: string) {
  const weeks = monthWeeks(month);
  return loadRange(userId, weeks[0], weeks.at(-1)!, today);
}

/** Lift templates with their slots as text ("3 × 5 @ 225 lb Back squat"). */
async function liftTemplates(): Promise<{ id: string; name: string; position: number; slots: string[] }[]> {
  const rows = (await sql`
    SELECT entity, id, payload FROM lift_rows
    WHERE deleted_at IS NULL AND entity IN ('template', 'templateExercise', 'exercise')`) as { entity: string; id: string; payload: Record<string, unknown> }[];
  const names = new Map(rows.filter((r) => r.entity === 'exercise').map((r) => [String(r.id).toLowerCase(), String(r.payload.name ?? '')]));
  return rows
    .filter((r) => r.entity === 'template' && !r.payload.deletedAt)
    .map((t) => {
      const id = String(t.id).toLowerCase();
      const slots = rows
        .filter((r) => r.entity === 'templateExercise' && !r.payload.deletedAt && String(r.payload.templateID ?? '').toLowerCase() === id)
        .sort((a, b) => Number(a.payload.position ?? 0) - Number(b.payload.position ?? 0))
        .map((r) => {
          const p = r.payload;
          const reps = p.repMin === p.repMax ? `${p.repMin}` : `${p.repMin}–${p.repMax}`;
          const w = p.weightValue ? ` @ ${p.weightValue} ${p.weightUnit ?? ''}`.trimEnd() : '';
          const name = names.get(String(p.exerciseID ?? '').toLowerCase()) || String(p.displayName ?? 'Exercise');
          return `${p.setCount} × ${reps}${w} ${name}${p.note ? ` (${p.note})` : ''}`;
        });
      return { id, name: String(t.payload.name ?? 'Lift template'), position: Number(t.payload.position ?? 0), slots };
    });
}

/** The workout library: distinct planned workouts from the plan history, and the Lift templates. */
export async function loadLibrary(userId: string): Promise<LibraryItem[]> {
  const [rows, templates] = await Promise.all([
    sql`
      SELECT a.id, a.scheduled_date, a.title, a.activity_type, a.workout_type, a.intensity, a.duration, a.tss, a.description
      FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
      WHERE p.user_id = ${userId} AND a.activity_type <> 'rest'
      ORDER BY a.scheduled_date DESC LIMIT 1000` as Promise<Row[]>,
    liftTemplates().catch((e) => {
      console.error('Lift templates failed:', e);
      return [];
    }),
  ]);
  const plan = rows.map((r) => ({
    id: String(r.id),
    date: dayOf(r.scheduled_date),
    title: String(r.title),
    sport: String(r.activity_type ?? 'other'),
    workoutType: (r.workout_type as string) ?? null,
    intensity: (r.intensity as string) ?? null,
    duration: num(r.duration),
    tss: num(r.tss),
    description: (r.description as string) ?? null,
  }));
  return libraryFrom(plan, templates) as LibraryItem[];
}

/** Plan id for a week, creating an empty plan when the week has none (as queries.ts does for a move). */
async function ensurePlan(userId: string, weekStart: string): Promise<string> {
  const [p] = (await sql`
    INSERT INTO training_plans (id, user_id, week_start_date, week_end_date, plan_content, ai_model, status)
    VALUES (${crypto.randomUUID()}, ${userId}, ${weekStart}, ${addDays(weekStart, 6)}, '', 'web', 'active')
    ON CONFLICT (user_id, week_start_date) DO UPDATE SET updated_at = NOW()
    RETURNING id`) as Row[];
  return String(p.id);
}

/**
 * Adds a planned workout on `date` from a library item. The item is read again from the database (never from the
 * client), and the new row is marked edited, so a plan re-import keeps it. Returns the new workout id.
 */
export async function addFromLibrary(userId: string, itemId: string, date: string): Promise<string> {
  const [kind, ref] = [itemId.slice(0, itemId.indexOf(':')), itemId.slice(itemId.indexOf(':') + 1)];
  let fields: { sport: string; title: string; workoutType: string | null; intensity: string | null; duration: number | null; tss: number | null; description: string | null };
  if (kind === 'plan') {
    const [r] = (await sql`
      SELECT a.title, a.activity_type, a.workout_type, a.intensity, a.duration, a.tss, a.description
      FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
      WHERE a.id = ${ref} AND p.user_id = ${userId}`) as Row[];
    if (!r) throw new Error('library workout not found');
    fields = {
      sport: String(r.activity_type),
      title: String(r.title),
      workoutType: (r.workout_type as string) ?? null,
      intensity: (r.intensity as string) ?? null,
      duration: num(r.duration),
      tss: num(r.tss),
      description: (r.description as string) ?? null,
    };
  } else if (kind === 'lift') {
    const t = (await liftTemplates()).find((x) => x.id === ref.toLowerCase());
    if (!t) throw new Error('Lift template not found');
    fields = {
      sport: 'strength',
      title: `🏋️ Strength — ${t.name}`,
      workoutType: /dumbbell|hotel/i.test(t.name) ? 'strength-dumbbell' : 'strength-heavy',
      intensity: 'strength',
      duration: 45,
      tss: null,
      description: [`Lift template "${t.name}".`, ...t.slots].join('\n'),
    };
  } else {
    throw new Error('bad library item');
  }
  const planId = await ensurePlan(userId, mondayOf(date));
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO training_plan_activities
      (id, plan_id, activity_type, title, description, scheduled_date, duration, intensity, workout_type, tss, status, sort_order, edited_at)
    VALUES (${id}, ${planId}, ${fields.sport}, ${fields.title}, ${fields.description}, ${date}, ${fields.duration},
            ${fields.intensity}, ${fields.workoutType}, ${fields.tss}, 'planned',
            (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM training_plan_activities WHERE plan_id = ${planId} AND scheduled_date = ${date}),
            NOW())`;
  return id;
}

/** Stores a new workout from the calendar ("+" on a day). `w` comes from cleanNewWorkout (src/lib/plan/create.mjs). */
export async function createWorkout(
  userId: string,
  w: { sport: string; date: string; startTime: string | null; title: string; duration: number | null; distance: number | null; tss: number | null; intensity: string | null; description: string | null; steps: Record<string, unknown> | null }
): Promise<string> {
  const planId = await ensurePlan(userId, mondayOf(w.date));
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO training_plan_activities
      (id, plan_id, activity_type, title, description, scheduled_date, start_time, duration, distance, intensity, tss, steps, status, sort_order, edited_at)
    VALUES (${id}, ${planId}, ${w.sport}, ${w.title}, ${w.description}, ${w.date}, ${w.startTime}, ${w.duration}, ${w.distance},
            ${w.intensity}, ${w.tss}, ${w.steps ? JSON.stringify(w.steps) : null}::jsonb, 'planned',
            (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM training_plan_activities WHERE plan_id = ${planId} AND scheduled_date = ${w.date}),
            NOW())`;
  return id;
}

/** Copies one planned workout the user owns to another day (the calendar's Copy and Paste). Returns the new id. */
export async function duplicateWorkout(userId: string, id: string, date: string): Promise<string | null> {
  const [r] = (await sql`
    SELECT a.* FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
    WHERE a.id = ${id} AND p.user_id = ${userId}`) as Row[];
  if (!r) return null;
  const planId = await ensurePlan(userId, mondayOf(date));
  const copy = crypto.randomUUID();
  await sql`
    INSERT INTO training_plan_activities
      (id, plan_id, activity_type, title, description, scheduled_date, start_time, end_time, duration, distance, intensity,
       workout_type, tss, why, steps, status, sort_order, edited_at)
    VALUES (${copy}, ${planId}, ${r.activity_type}, ${r.title}, ${r.description}, ${date}, ${r.start_time}, ${r.end_time},
            ${r.duration}, ${r.distance}, ${r.intensity}, ${r.workout_type}, ${r.tss}, ${r.why},
            ${r.steps ? JSON.stringify(r.steps) : null}::jsonb, 'planned',
            (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM training_plan_activities WHERE plan_id = ${planId} AND scheduled_date = ${date}),
            NOW())`;
  return copy;
}

/** users.settings, for the weather location. */
export async function userSettings(userId: string): Promise<Record<string, unknown>> {
  const [u] = (await sql`SELECT settings FROM users WHERE id = ${userId}`) as Row[];
  return (u?.settings as Record<string, unknown>) ?? {};
}

/** Ids of the week's workouts that came from plans/<week>.json, for the remove notice on the week board. */
export async function importedIds(userId: string, weekStart: string): Promise<string[]> {
  const rows = (await sql`
    SELECT a.id FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
    WHERE p.user_id = ${userId} AND p.week_start_date = ${weekStart} AND a.source_key IS NOT NULL`) as Row[];
  return rows.map((r) => String(r.id));
}

/** Deletes one planned workout the user owns. Returns its day ('YYYY-MM-DD'), or null when there was no such workout. */
export async function removeWorkout(userId: string, id: string): Promise<string | null> {
  const rows = (await sql`
    DELETE FROM training_plan_activities a USING training_plans p
    WHERE a.id = ${id} AND p.id = a.plan_id AND p.user_id = ${userId}
    RETURNING a.scheduled_date`) as Row[];
  return rows[0] ? dayOf(rows[0].scheduled_date) : null;
}

/** Where the calendar data starts and where the plan ends ('YYYY-MM-DD' each, or null when there is none). */
export type DataBounds = { earliest: string | null; planEnd: string | null };

/**
 * The first day with data (a Strava activity, a plan workout or a Lift session) and the last planned day. The
 * continuous calendar stops loading at `earliest`. One query.
 */
export async function dataBounds(userId: string): Promise<DataBounds> {
  const [r] = (await sql`
    SELECT LEAST(
             (SELECT to_char(min(start_date_local), 'YYYY-MM-DD') FROM strava_activities WHERE user_id = ${userId}),
             (SELECT to_char(min(a.scheduled_date), 'YYYY-MM-DD')
                FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id WHERE p.user_id = ${userId}),
             (SELECT min(payload ->> 'day') FROM lift_rows
                WHERE entity = 'session' AND deleted_at IS NULL AND payload ->> 'day' ~ '^\\d{4}-\\d{2}-\\d{2}$')
           ) AS earliest,
           (SELECT to_char(max(a.scheduled_date), 'YYYY-MM-DD')
              FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id WHERE p.user_id = ${userId}) AS plan_end`) as Row[];
  return { earliest: toDay(r?.earliest), planEnd: toDay(r?.plan_end) };
}
