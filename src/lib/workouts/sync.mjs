// Coach's structured workouts on the devices, with no service in between (docs/research/structured-workouts.md):
// - runs → the Garmin watch: Coach builds Garmin's workout JSON; scripts/garmin (the Garmin job, which holds the
//   Garmin login) uploads it, puts it on the date, reads it back and reports (GET/POST /api/workouts/garmin);
// - indoor rides → Zwift: scripts/zwift-workouts.mjs on the Mac writes .zwo files into Zwift's workouts folder.
// Coach is the source. workout_syncs remembers what each device has (a hash of what was sent), so a run creates,
// updates or deletes only what changed. Workouts made on the devices by hand are never touched. Pure, except
// loadSyncRows; node --test.

import { createHash } from 'node:crypto';
import { toGarmin } from './garmin.mjs';
import { toZwo } from './zwo.mjs';

/** Which device a planned workout goes to: 'garmin' (runs), 'zwift' (indoor rides), or null (Coach only). */
export function deviceOf(row) {
  const w = row.steps;
  if (!w || row.status === 'skipped') return null;
  if (w.sport === 'run') return 'garmin';
  if (w.sport === 'ride' && /zwift|indoor|virtual|trainer/i.test(`${row.title} ${row.workout_type ?? ''}`)) return 'zwift';
  return null;
}

/** The title without its emoji: "🚴 Threshold A — Zwift" → "Threshold A — Zwift". */
export const plainName = (title) => String(title).replace(/^\p{Extended_Pictographic}️?\s*/u, '').trim();

/** The first line of the coach's note, for the device. */
const noteOf = (row) => String(row.description ?? '').split('\n')[0].slice(0, 300);

/** What the device gets for a plan workout, or null when it goes to another device (or none). */
export function payloadFor(target, row) {
  if (deviceOf(row) !== target) return null;
  if (target === 'garmin') {
    return { date: row.day, workout: toGarmin(row.steps, { name: `Coach · ${plainName(row.title)}`, description: noteOf(row) }) };
  }
  const day = row.day;
  const safe = plainName(row.title).replace(/[^\p{L}\p{N} _-]+/gu, '').replace(/\s+/g, ' ').trim().slice(0, 50);
  return {
    date: day,
    file: `Coach - ${day} ${safe}.zwo`,
    xml: toZwo({ ...row.steps, name: `${day.slice(5)} ${plainName(row.title)}` }, { description: noteOf(row) }),
  };
}

export const hashOf = (payload) => createHash('sha1').update(JSON.stringify(payload)).digest('hex');

/**
 * What to do for one device: create, update, keep or delete, per plan workout.
 * @param {'garmin' | 'zwift'} target
 * @param {object[]} rows plan workouts in the window (id, day, title, workout_type, status, description, steps)
 * @param {{ activity_id: string, remote_id: string, content_hash: string }[]} synced this device's workout_syncs rows
 */
export function planSync(target, rows, synced) {
  const byId = new Map(synced.map((s) => [s.activity_id, s]));
  const ops = [];
  const seen = new Set();
  for (const r of rows) {
    seen.add(r.id);
    const prior = byId.get(r.id);
    const payload = payloadFor(target, r);
    if (!payload) {
      if (prior) ops.push({ op: 'delete', activityId: r.id, prior });
      continue;
    }
    const hash = hashOf(payload);
    if (!prior) ops.push({ op: 'create', activityId: r.id, payload, hash });
    else if (prior.content_hash !== hash) ops.push({ op: 'update', activityId: r.id, payload, hash, prior });
    else ops.push({ op: 'keep', activityId: r.id, payload, hash, prior });
  }
  // On the device, but the plan workout is gone (or moved out of the window).
  for (const s of synced) if (!seen.has(s.activity_id)) ops.push({ op: 'delete', activityId: s.activity_id, prior: s });
  return ops;
}

/**
 * The plan workouts from `from` to `to` (YYYY-MM-DD) and the device's sync rows for them, plus its rows whose
 * workout is gone or moved out of the window.
 */
export async function loadSyncRows(sql, userId, target, from, to) {
  const rows = await sql`
    SELECT a.id, to_char(a.scheduled_date, 'YYYY-MM-DD') AS day, a.title, a.workout_type, a.status, a.description, a.steps
    FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
    WHERE p.user_id = ${userId} AND a.scheduled_date >= ${from} AND a.scheduled_date < ${to}::date + 1
    ORDER BY a.scheduled_date, a.sort_order`;
  const synced = await sql`
    SELECT s.activity_id, s.remote_id, s.content_hash
    FROM workout_syncs s LEFT JOIN training_plan_activities a ON a.id = s.activity_id
    WHERE s.target = ${target}
      AND (a.id IS NULL OR (a.scheduled_date >= ${from} AND a.scheduled_date < ${to}::date + 1)
        OR a.status = 'skipped' OR a.steps IS NULL)`;
  return { rows, synced };
}

/**
 * Stores the result of one op for a device. A delete removes the row. A failure keeps the remote id (to clean up)
 * and an empty hash, so the next run tries again.
 */
export async function recordSync(sql, target, r) {
  if (r.op === 'delete') {
    if (r.ok) await sql`DELETE FROM workout_syncs WHERE activity_id = ${r.activityId} AND target = ${target}`;
    else await sql`UPDATE workout_syncs SET status = 'error', last_error = ${String(r.error ?? '').slice(0, 500)} WHERE activity_id = ${r.activityId} AND target = ${target}`;
    return;
  }
  if (!r.remoteId) {
    await sql`UPDATE workout_syncs SET status = 'error', last_error = ${String(r.error ?? 'no remote id').slice(0, 500)} WHERE activity_id = ${r.activityId} AND target = ${target}`;
    return;
  }
  await sql`
    INSERT INTO workout_syncs (activity_id, target, remote_id, content_hash, status, last_error, synced_at)
    VALUES (${r.activityId}, ${target}, ${r.remoteId}, ${r.ok ? r.hash : ''}, ${r.ok ? 'ok' : 'error'}, ${r.error ? String(r.error).slice(0, 500) : null}, NOW())
    ON CONFLICT (activity_id, target) DO UPDATE SET remote_id = EXCLUDED.remote_id, content_hash = EXCLUDED.content_hash,
      status = EXCLUDED.status, last_error = EXCLUDED.last_error, synced_at = NOW()`;
}
