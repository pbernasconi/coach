#!/usr/bin/env node
/**
 * Reads and changes a plan week in the database (the only plan source), then updates Google Calendar.
 * A tool for fixing data by hand; the web week page does the same through its server actions.
 *
 *   node --env-file=.env.local scripts/plan-edit.mjs show 2026-10-19
 *   node --env-file=.env.local scripts/plan-edit.mjs move <workoutId> 2026-10-23
 *   node --env-file=.env.local scripts/plan-edit.mjs skip <workoutId> [tired|sick|sore|busy|travel|other]
 *        (unskip <workoutId> to undo; the reason is what the planner reads, src/lib/plan/skip.mjs)
 *   node --env-file=.env.local scripts/plan-edit.mjs update <workoutId> title="Easy ride" duration=60 intensity=easy \
 *        start_time=07:30 description="Z2 only"
 *
 * Every change sets edited_at, so a later accepted plan keeps it. Add --no-calendar to skip the calendar update.
 * A move, skip or unskip of a strength workout also moves or removes its Lift session (when nothing was logged in it),
 * through the server's Lift sync push (LIFT_SYNC_TOKEN; src/lib/lift/follow-plan.mjs). The push goes to
 * LIFT_SYNC_BASE_URL (default production) and only when that server reads the same database: production's when
 * DATABASE_URL is production's, else pass --push-lift to push anyway.
 */

import { createHash } from 'node:crypto';
import { connect } from '../src/db/neon.mjs';
import { pushWeek } from '../src/lib/calendar-sync/push.mjs';
import { followWorkout } from '../src/lib/lift/follow-plan.mjs';
import { SKIP_REASONS, cleanReason } from '../src/lib/plan/skip.mjs';
import { feedbackLine } from '../src/lib/plan/feedback.mjs';

const [cmd, a, b, ...rest] = process.argv.slice(2).filter((x) => x !== '--no-calendar' && x !== '--push-lift');
const noCalendar = process.argv.includes('--no-calendar');
const sql = connect();
const [user] = await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const day = (v) => new Date(v).toISOString().slice(0, 10);
const monday = (key) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const fail = (m) => { console.error(m); process.exit(1); };

async function workout(id) {
  const [w] = await sql`
    SELECT a.*, p.week_start_date FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
    WHERE a.id = ${id} AND p.user_id = ${user.id}`;
  if (!w) fail(`No workout ${id}`);
  return w;
}

async function planFor(week) {
  const [p] = await sql`
    INSERT INTO training_plans (id, user_id, week_start_date, week_end_date, plan_content, ai_model, status)
    VALUES (${crypto.randomUUID()}, ${user.id}, ${week}, ${day(Date.parse(week) + 6 * 86_400_000)}, '', 'plan-edit', 'active')
    ON CONFLICT (user_id, week_start_date) DO UPDATE SET updated_at = NOW() RETURNING id`;
  return p.id;
}

async function push(weeks) {
  if (noCalendar) return;
  for (const week of new Set(weeks)) {
    const r = await pushWeek(sql, user.id, week);
    console.log(r.skipped ? `calendar not updated: ${r.skipped}` : `calendar ${week}: ${r.created} created, ${r.updated} updated, ${r.deleted} deleted`);
  }
}

const PROD_SERVER = 'https://coach.paolobernasconi.com';
// SHA-256 of the production database's Neon endpoint host (without "-pooler"). The repository is public, so it holds
// only the hash, not the host.
const PROD_DB_HOST_SHA256 = '4cdd4dc086014eec0575d90103f2c8538e8c1ea3e6972f06705a84c9d7a6b79d';
const LIFT_SERVER = process.env.LIFT_SYNC_BASE_URL ?? PROD_SERVER;
const dbHost = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').hostname.replace('-pooler', '');
  } catch {
    return '';
  }
})();
// The session rows come from DATABASE_URL and the push goes to LIFT_SERVER: push only when both are production, or
// when --push-lift says the two match.
const liftPushOk = process.argv.includes('--push-lift') || (LIFT_SERVER === PROD_SERVER && createHash('sha256').update(dbHost).digest('hex') === PROD_DB_HOST_SHA256);

/** Pushes Lift changes through the server, as the iPhone does, so they get a seq and the server's cache is cleared. */
async function pushLift(changes) {
  if (!process.env.LIFT_SYNC_TOKEN) throw new Error('LIFT_SYNC_TOKEN is not set');
  const res = await fetch(`${LIFT_SERVER}/api/lift/sync/push`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.LIFT_SYNC_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ deviceId: 'plan-edit', changes }),
  });
  if (!res.ok) throw new Error(`Lift push: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Moves or removes the workout's Lift session. A failure only warns: lift-plan.mjs puts the session right later. */
async function followLift(id, opts) {
  if (!liftPushOk) {
    console.warn(`Lift session not changed: ${LIFT_SERVER} may not read this database (${dbHost || 'no DATABASE_URL'}). Pass --push-lift to push anyway.`);
    return;
  }
  try {
    const r = await followWorkout(sql, pushLift, id, opts);
    if ('done' in r) console.log(`Lift session (${LIFT_SERVER}): ${r.done === 'removed' ? 'removed' : `moved to ${r.done}`}`);
    else if (r.skip === 'started') console.log('Lift session: started or logged, not changed');
    else if (r.skip.startsWith('refused')) console.warn(`Lift session not changed: ${r.skip}`);
  } catch (error) {
    console.warn(`Lift session not changed (scripts/lift-plan.mjs will do it): ${error.message}`);
  }
}

const COLUMNS = { title: 'title', duration: 'duration', intensity: 'intensity', description: 'description', why: 'why', start_time: 'start_time', end_time: 'end_time', time_zone: 'time_zone', workout_type: 'workout_type', tss: 'tss', lift_template: 'lift_template' };

if (cmd === 'show') {
  if (!DATE.test(a ?? '')) fail('show YYYY-MM-DD');
  const week = monday(a);
  const [plan] = await sql`SELECT id, context_data, feel_log FROM training_plans WHERE user_id = ${user.id} AND week_start_date = ${week}`;
  if (!plan) { console.log(`No plan for the week of ${week}.`); process.exit(0); }
  console.log(`Week of ${week}: ${plan.context_data?.title ?? ''}`);
  console.log(`Feel log: ${JSON.stringify(plan.feel_log)}`);
  const rows = await sql`SELECT * FROM training_plan_activities WHERE plan_id = ${plan.id} ORDER BY scheduled_date, sort_order, start_time NULLS LAST`;
  for (const r of rows) {
    const flags = [r.status === 'skipped' && `SKIPPED${r.skip_reason ? ` (${r.skip_reason})` : ''}`, r.edited_at && 'changed on the web/CLI', r.adapted_from && `adapted, before: ${JSON.stringify(r.adapted_from)}`].filter(Boolean).join('; ');
    console.log(`${r.id}  ${day(r.scheduled_date)} ${r.start_time ?? '--:--'}  ${r.title} (${r.intensity ?? '-'}, ${r.duration ?? '?'} min, ${r.tss ?? '?'} TSS)${flags ? `  [${flags}]` : ''}`);
  }
  // How the week's workouts felt, as Paolo logged them in the workout window (feel 1–5, RPE 1–10, comment).
  const felt = await sql`SELECT date, title, item, feel, rpe, comment FROM workout_feedback
    WHERE user_id = ${user.id} AND date >= ${week}::date AND date < ${week}::date + 7 ORDER BY date`.catch(() => []);
  if (felt.length) console.log('How it went:');
  for (const f of felt) console.log(`  ${day(f.date)}  ${f.title ?? f.item}: ${feedbackLine(f)}`);
} else if (cmd === 'move') {
  if (!a || !DATE.test(b ?? '')) fail('move <workoutId> YYYY-MM-DD');
  const w = await workout(a);
  const planId = await planFor(monday(b));
  await sql`UPDATE training_plan_activities SET scheduled_date = ${b}, plan_id = ${planId}, edited_at = NOW(), updated_at = NOW() WHERE id = ${a}`;
  console.log(`moved ${w.title}: ${day(w.scheduled_date)} → ${b}`);
  await followLift(a);
  await push([day(w.week_start_date), monday(b)]);
} else if (cmd === 'skip' || cmd === 'unskip') {
  if (!a) fail(`${cmd} <workoutId> [${SKIP_REASONS.join('|')}]`);
  if (cmd === 'skip' && b && !cleanReason(b)) fail(`Unknown reason "${b}": use one of ${SKIP_REASONS.join(', ')}`);
  const w = await workout(a);
  const reason = cmd === 'skip' ? cleanReason(b) : null;
  await sql`UPDATE training_plan_activities SET status = ${cmd === 'skip' ? 'skipped' : 'planned'}, skip_reason = ${reason}, edited_at = NOW(), updated_at = NOW() WHERE id = ${a}`;
  console.log(`${cmd}ped ${w.title}${reason ? ` (${reason})` : ''}`);
  await followLift(a, { restore: cmd === 'unskip' });
  await push([day(w.week_start_date)]);
} else if (cmd === 'update') {
  if (!a) fail('update <workoutId> key=value ...');
  const w = await workout(a);
  for (const pair of [b, ...rest].filter(Boolean)) {
    const i = pair.indexOf('=');
    const key = pair.slice(0, i);
    const col = COLUMNS[key];
    if (!col) fail(`Unknown field ${key}; use one of ${Object.keys(COLUMNS).join(', ')}`);
    const raw = pair.slice(i + 1);
    const value = ['duration'].includes(key) ? parseInt(raw, 10) : key === 'tss' ? Number(raw) : raw;
    // Column names come from COLUMNS, never from input.
    await sql.query(`UPDATE training_plan_activities SET ${col} = $1, edited_at = NOW(), updated_at = NOW() WHERE id = $2`, [value, a]);
  }
  console.log(`updated ${w.title}`);
  await push([day(w.week_start_date)]);
} else {
  fail('Usage: plan-edit.mjs show YYYY-MM-DD | move <id> YYYY-MM-DD | skip <id> | unskip <id> | update <id> key=value ...');
}
