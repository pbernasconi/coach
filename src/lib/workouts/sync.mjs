// Sends the structured workouts of the plan to intervals.icu, which passes runs on to the Garmin watch and indoor
// rides on to Zwift (a rolling week; docs/research/structured-workouts.md §6, §8). Coach is the source: one
// intervals.icu event per plan workout, remembered in workout_syncs with a hash of what was sent, so a re-run
// creates, updates or deletes only what changed. Workouts made in intervals.icu by hand are never touched.

import { createHash } from 'node:crypto';
import { totals } from './steps.mjs';
import { expectedStepCount, workoutText } from './intervals-text.mjs';

/**
 * Where a workout goes: a run to the Garmin watch ('Run'), an indoor ride to Zwift ('VirtualRide': the title or
 * type says Zwift or indoor). Null for an outdoor ride: it stays in Coach only (Paolo: runs on the watch, indoor
 * rides on Zwift).
 */
export function eventType(row, workout) {
  if (workout.sport === 'run') return 'Run';
  return /zwift|indoor|virtual|trainer/i.test(`${row.title} ${row.workout_type ?? ''}`) ? 'VirtualRide' : null;
}

/** The intervals.icu event for a plan workout with steps. */
export function eventFor(row, workout) {
  const t = totals(workout);
  const note = String(row.description ?? '').split('\n')[0].slice(0, 200);
  return {
    category: 'WORKOUT',
    start_date_local: `${row.day}T${row.start_time ?? '07:00'}:00`,
    type: eventType(row, workout),
    name: String(row.title).replace(/^\p{Extended_Pictographic}️?\s*/u, '').slice(0, 80),
    description: workoutText({ ...workout, notes: note || workout.notes }),
    moving_time: t.seconds,
    icu_training_load: t.tss,
    external_id: `coach-${row.id}`,
  };
}

export const hashOf = (event) => createHash('sha1').update(JSON.stringify(event)).digest('hex');

/**
 * What to do, without doing it: create, update, keep or delete, per plan workout. Pure, for tests.
 * @param {{ id: string, day: string, status: string, steps: any }[]} rows plan workouts in the window
 * @param {{ activity_id: string, remote_id: string, content_hash: string }[]} synced rows of workout_syncs
 */
export function planSync(rows, synced, eventOf) {
  const byId = new Map(synced.map((s) => [s.activity_id, s]));
  const ops = [];
  const seen = new Set();
  for (const r of rows) {
    const prior = byId.get(r.id);
    const wanted = r.status !== 'skipped' && r.steps && (r.steps.sport === 'run' || r.steps.sport === 'ride') && eventType(r, r.steps) != null;
    if (!wanted) {
      if (prior) ops.push({ op: 'delete', row: r, prior });
      seen.add(r.id);
      continue;
    }
    const event = eventOf(r, r.steps);
    const hash = hashOf(event);
    seen.add(r.id);
    if (!prior) ops.push({ op: 'create', row: r, event, hash });
    else if (prior.content_hash !== hash) ops.push({ op: 'update', row: r, event, hash, prior });
    else ops.push({ op: 'keep', row: r, prior });
  }
  // Synced workouts whose plan row is gone, or moved out of the window into the past.
  for (const s of synced) if (!seen.has(s.activity_id)) ops.push({ op: 'delete', row: null, prior: s });
  return ops;
}

/**
 * Syncs the plan workouts from `from` to `to` (YYYY-MM-DD). Returns what it did; errors are stored per workout.
 * @param {any} sql Neon tagged template
 * @param {string} userId
 * @param {ReturnType<import('./intervals-api.mjs').intervalsClient>} client
 * @param {{ from: string, to: string, dryRun?: boolean, log?: (m: string) => void }} opts
 */
export async function syncWorkouts(sql, userId, client, { from, to, dryRun = false, log = () => {} }) {
  if (!client) return { skipped: 'INTERVALS_API_KEY or INTERVALS_ATHLETE_ID is not set' };
  const rows = await sql`
    SELECT a.id, to_char(a.scheduled_date, 'YYYY-MM-DD') AS day, a.start_time, a.title, a.workout_type, a.status,
      a.description, a.steps
    FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
    WHERE p.user_id = ${userId} AND a.scheduled_date >= ${from} AND a.scheduled_date < ${to}::date + 1`;
  const ids = rows.map((r) => r.id);
  const synced = await sql`
    SELECT s.activity_id, s.remote_id, s.content_hash FROM workout_syncs s
    LEFT JOIN training_plan_activities a ON a.id = s.activity_id
    WHERE s.target = 'intervals' AND (s.activity_id = ANY(${ids}) OR a.id IS NULL
      OR (a.scheduled_date >= ${from} AND a.scheduled_date < ${to}::date + 1))`;
  const ops = planSync(rows, synced, eventFor);
  const done = { created: 0, updated: 0, deleted: 0, kept: 0, errors: [] };
  for (const o of ops) {
    const label = o.row ? `${o.row.day} ${o.row.title}` : `removed workout ${o.prior.activity_id}`;
    if (o.op === 'keep') {
      done.kept++;
      continue;
    }
    log(`${o.op} ${label}`);
    if (dryRun) continue;
    try {
      if (o.op === 'delete') {
        await client.remove(o.prior.remote_id);
        await sql`DELETE FROM workout_syncs WHERE activity_id = ${o.prior.activity_id} AND target = 'intervals'`;
        done.deleted++;
        continue;
      }
      const saved = o.op === 'create' ? await client.create(o.event) : await client.update(o.prior.remote_id, o.event);
      const remoteId = String(saved?.id ?? o.prior?.remote_id);
      // Read it back: intervals.icu parses the text into steps; a count that differs means it read the text wrong.
      const back = await client.get(remoteId).catch(() => saved);
      const steps = back?.workout_doc?.steps ? countDoc(back.workout_doc.steps) : null;
      const pushErrors = (back?.push_errors ?? []).map((e) => `${e.service}: ${e.message}`);
      const expected = expectedStepCount(o.row.steps);
      const problem = [steps != null && steps !== expected ? `intervals.icu read ${steps} steps, Coach has ${expected}` : null, ...pushErrors].filter(Boolean).join('; ') || null;
      await sql`
        INSERT INTO workout_syncs (activity_id, target, remote_id, content_hash, status, last_error, synced_at)
        VALUES (${o.row.id}, 'intervals', ${remoteId}, ${o.hash}, ${problem ? 'error' : 'ok'}, ${problem}, NOW())
        ON CONFLICT (activity_id, target) DO UPDATE SET remote_id = EXCLUDED.remote_id, content_hash = EXCLUDED.content_hash,
          status = EXCLUDED.status, last_error = EXCLUDED.last_error, synced_at = NOW()`;
      if (problem) done.errors.push(`${label}: ${problem}`);
      done[o.op === 'create' ? 'created' : 'updated']++;
    } catch (e) {
      done.errors.push(`${label}: ${e.message}`);
      if (o.row && o.prior) {
        await sql`UPDATE workout_syncs SET status = 'error', last_error = ${e.message.slice(0, 500)} WHERE activity_id = ${o.row.id} AND target = 'intervals'`;
      }
    }
  }
  return done;
}

/** Steps in intervals.icu's parsed workout, repeats expanded (`reps` on a group). */
function countDoc(steps) {
  return steps.reduce((n, s) => n + (Array.isArray(s.steps) ? (s.reps ?? 1) * countDoc(s.steps) : 1), 0);
}
