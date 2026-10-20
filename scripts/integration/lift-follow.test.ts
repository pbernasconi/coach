// Integration test: moving, skipping, deleting and restoring a strength workout on the web moves or removes its Lift
// session right away (src/lib/lift/follow-plan.mjs), through the Lift sync push code: each change gets a newer
// updated_at and a fresh seq, so the iPhone pulls it. A session with a logged set never changes. The week API shows
// the link. Needs DATABASE_URL to a database built by npm run db:migrate, and DATABASE_DRIVER=pg. Synthetic rows only.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { moveWorkout, setSkipped } from '@/lib/plan/queries';
import { removeWorkout, restoreWorkout } from '@/lib/plan/month';
import { loadLiftWeeks } from '@/lib/plan/week-api';
import { handlePush } from '@/lib/lift-sync/sync.mjs';
import type { ValidChange } from '@/lib/lift-sync/contract.mjs';
import { drizzleLiftRepository } from '@/lib/lift-sync/drizzle-repository';
import { followSessionsInPlan } from '@/lib/lift/plan-follow';

const url = process.env.DATABASE_URL;
if (!url || process.env.DATABASE_DRIVER !== 'pg') throw new Error('Set DATABASE_URL and DATABASE_DRIVER=pg');

const client = new pg.Client({ connectionString: url });
const up = () => crypto.randomUUID().toUpperCase();
const USER = 'user_lift_follow';
const SESSION = up();
const LOGGED = up();
const SLOT = up();
const T0 = '2026-10-01T10:00:00.000Z';
let activity = '';
let loggedActivity = '';

async function row(entity: string, payload: Record<string, unknown>) {
  await client.query(`INSERT INTO lift_rows (entity, id, payload, updated_at) VALUES ($1, $2, $3, $4)`, [entity, payload.id, JSON.stringify(payload), T0]);
}

before(async () => {
  await client.connect();
  // Created later than any other user, so the health test's owner (the first user) stays the same.
  await client.query(`INSERT INTO users (id, email, created_at) VALUES ($1, 'lift-follow@example.com', now() + interval '2 days')`, [USER]);
  const plan = crypto.randomUUID();
  await client.query(
    `INSERT INTO training_plans (id, user_id, week_start_date, week_end_date, plan_content, ai_model, status, context_data)
     VALUES ($1, $2, '2030-03-04', '2030-03-10', '', 'test', 'active', '{"title":"Test week"}')`,
    [plan, USER]
  );
  activity = crypto.randomUUID();
  loggedActivity = crypto.randomUUID();
  await client.query(
    `INSERT INTO training_plan_activities (id, plan_id, activity_type, title, scheduled_date, duration, lift_session_id, sort_order)
     VALUES ($1, $3, 'strength', 'Heavy lift', '2030-03-05', 60, $4, 0), ($2, $3, 'strength', 'Light lift', '2030-03-06', 45, $5, 0)`,
    [activity, loggedActivity, plan, SESSION.toLowerCase(), LOGGED.toLowerCase()]
  );
  for (const [id, day] of [[SESSION, '2030-03-05'], [LOGGED, '2030-03-06']]) {
    await row('session', { id, day, title: 'Lift', startedAt: null, finishedAt: null, updatedAt: T0, deletedAt: null });
  }
  await row('sessionExercise', { id: SLOT, sessionID: LOGGED, exerciseID: up(), displayName: 'Squat', position: 0, updatedAt: T0, deletedAt: null });
  await row('set', { id: up(), sessionExerciseID: SLOT, position: 0, kind: 'working', status: 'done', actualReps: 5, unit: 'lb', updatedAt: T0, deletedAt: null });
});
after(async () => {
  await client.end();
});

const session = async (id: string) =>
  (await client.query(`SELECT payload, updated_at, deleted_at, seq FROM lift_rows WHERE entity = 'session' AND id = $1`, [id])).rows[0] as {
    payload: Record<string, unknown>; updated_at: Date; deleted_at: Date | null; seq: string;
  };

test('the week API links the Lift session', async () => {
  const body = await loadLiftWeeks(USER, '2030-03-04', 1, '2030-03-01', 'America/Los_Angeles');
  const item = body.weeks[0].days[1].items[0];
  assert.equal(body.weeks[0].title, 'Test week');
  assert.equal(item.liftSessionId, SESSION.toLowerCase());
  assert.equal(item.subtitle, '60 min');
});

test('a move puts the session on the new day with a newer stamp and seq', async () => {
  const before = await session(SESSION);
  await moveWorkout(USER, activity, '2030-03-08');
  const s = await session(SESSION);
  assert.equal(s.payload.day, '2030-03-08');
  assert.ok(s.updated_at.getTime() > before.updated_at.getTime());
  assert.ok(Number(s.seq) > Number(before.seq));
});

test('a skip removes the session, and an un-skip brings it back', async () => {
  await setSkipped(USER, activity, true);
  assert.ok((await session(SESSION)).deleted_at, 'skipped: soft-deleted');
  await setSkipped(USER, activity, false);
  const s = await session(SESSION);
  assert.equal(s.deleted_at, null);
  assert.equal(s.payload.day, '2030-03-08');
});

test('a delete removes the session, and Undo brings it back', async () => {
  const gone = await removeWorkout(USER, activity);
  assert.ok(gone);
  assert.ok((await session(SESSION)).deleted_at);
  assert.equal(await restoreWorkout(USER, gone!.row), '2030-03-08');
  assert.equal((await session(SESSION)).deleted_at, null);
});

test('a session with a logged set stays where it is', async () => {
  const before = await session(LOGGED);
  await moveWorkout(USER, loggedActivity, '2030-03-09');
  await setSkipped(USER, loggedActivity, true);
  const s = await session(LOGGED);
  assert.equal(s.payload.day, '2030-03-06');
  assert.equal(s.deleted_at, null);
  assert.equal(s.seq, before.seq);
});

/** A push from the phone, as the push route runs it: the changes, then the plan follow for the applied ones. */
async function phonePush(payload: Record<string, unknown>) {
  const applied: ValidChange[] = [];
  const body = JSON.stringify({ deviceId: 'phone', changes: [{ idempotencyKey: crypto.randomUUID(), entity: 'session', op: 'update', rowId: String(payload.id), payload }] });
  const r = await handlePush({ authorization: 'Bearer t', rawBody: body, token: 't' }, drizzleLiftRepository, { applied });
  assert.equal(r.status, 200);
  return followSessionsInPlan(applied);
}

const planned = async (id: string) =>
  (await client.query(
    `SELECT to_char(a.scheduled_date, 'YYYY-MM-DD') AS day, to_char(p.week_start_date, 'YYYY-MM-DD') AS week, a.edited_at, a.status
     FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id WHERE a.id = $1`,
    [id]
  )).rows[0] as { day: string; week: string; edited_at: Date | null; status: string };

test('the phone moving a session moves its plan workout, into the next week too; a stale push moves nothing', async () => {
  const s = await session(SESSION);
  const moves = await phonePush({ ...s.payload, day: '2030-03-12', updatedAt: new Date(s.updated_at.getTime() + 60_000).toISOString() });
  assert.equal(moves.length, 1);
  const w = await planned(activity);
  assert.deepEqual([w.day, w.week], ['2030-03-12', '2030-03-11']);
  assert.ok(w.edited_at, 'marked edited, so a re-import keeps it');

  const stale = await phonePush({ ...s.payload, day: '2030-03-05', updatedAt: s.updated_at.toISOString() });
  assert.deepEqual(stale, []);
  assert.equal((await planned(activity)).day, '2030-03-12');
});

test('the phone removing a session leaves the plan workout as it is', async () => {
  const s = await session(SESSION);
  const at = new Date(s.updated_at.getTime() + 60_000).toISOString();
  assert.deepEqual(await phonePush({ ...s.payload, day: '2030-03-13', updatedAt: at, deletedAt: at }), []);
  const w = await planned(activity);
  assert.deepEqual([w.day, w.status], ['2030-03-12', 'planned']);
});
