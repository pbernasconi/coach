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
