// Integration test: a plan workout linked to a Lift session that was deleted (discarded on the phone) reads as not
// linked, so the iPhone and the web open it as a workout to start, not a session that is gone (the App API answers
// 404 for it). A new session can take the link's place. The stored link itself stays, so an un-skip can restore it.
//
// Needs DATABASE_URL to a database built by npm run db:migrate, and DATABASE_DRIVER=pg. Synthetic rows only.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { loadRange } from '@/lib/plan/month';
import { linkLiftSession } from '@/lib/plan/queries';

const url = process.env.DATABASE_URL;
if (!url || process.env.DATABASE_DRIVER !== 'pg') throw new Error('Set DATABASE_URL and DATABASE_DRIVER=pg');

const client = new pg.Client({ connectionString: url });
const USER = 'user_lift_deleted_link';
const GONE = crypto.randomUUID().toUpperCase();
const LIVE = crypto.randomUUID().toUpperCase();
const T0 = '2026-11-02T16:20:00.000Z';
let deletedLink = '';
let liveLink = '';

async function session(id: string, deletedAt: string | null) {
  const payload = { id, day: '2026-11-03', title: 'Upper', unitsAtLog: 'lb', startedAt: T0, finishedAt: null, updatedAt: T0, deletedAt };
  await client.query(`INSERT INTO lift_rows (entity, id, payload, updated_at, deleted_at) VALUES ('session', $1, $2, $3, $4)`, [
    id,
    JSON.stringify(payload),
    T0,
    deletedAt,
  ]);
}

before(async () => {
  await client.connect();
  // Created later than any other user, so the health test's owner (the first user) stays the same.
  await client.query(`INSERT INTO users (id, email, created_at) VALUES ($1, 'lift-deleted-link@example.com', now() + interval '1 day')`, [USER]);
  const plan = crypto.randomUUID();
  await client.query(
    `INSERT INTO training_plans (id, user_id, week_start_date, week_end_date, plan_content, ai_model, status) VALUES ($1, $2, '2026-11-02', '2026-11-08', '', 'test', 'active')`,
    [plan, USER]
  );
  deletedLink = crypto.randomUUID();
  liveLink = crypto.randomUUID();
  for (const [id, link, title] of [
    [deletedLink, GONE, 'Upper (dumbbells)'],
    [liveLink, LIVE, 'Heavy barbell'],
  ]) {
    await client.query(
      `INSERT INTO training_plan_activities (id, plan_id, activity_type, title, scheduled_date, lift_session_id) VALUES ($1, $2, 'strength', $3, '2026-11-03', $4)`,
      [id, plan, title, link.toLowerCase()]
    );
  }
  await session(GONE, '2026-11-03T19:37:16.517Z');
  await session(LIVE, null);
});
after(async () => {
  await client.end();
});

test('the calendar and the App API read a link to a deleted session as none', async () => {
  const range = await loadRange(USER, '2026-11-02', '2026-11-02', '2026-11-04');
  const byId = new Map(range.workouts.map((w) => [w.id, w]));
  assert.equal(byId.get(deletedLink)?.liftSessionId, null);
  assert.equal(byId.get(deletedLink)?.lift, null);
  assert.equal(byId.get(liveLink)?.liftSessionId, LIVE.toLowerCase());
});

test('a new session replaces a link to a deleted one, but not a live link', async () => {
  const fresh = crypto.randomUUID().toLowerCase();
  assert.equal(await linkLiftSession(USER, deletedLink, fresh), true);
  const { rows } = await client.query(`SELECT lift_session_id FROM training_plan_activities WHERE id = $1`, [deletedLink]);
  assert.equal(rows[0].lift_session_id, fresh);
  assert.equal(await linkLiftSession(USER, liveLink, crypto.randomUUID().toLowerCase()), false);
});

test('the stored link stays: a session deleted and brought back (an un-skip) shows again', async () => {
  const link = async () => (await loadRange(USER, '2026-11-02', '2026-11-02', '2026-11-04')).workouts.find((w) => w.id === liveLink)?.liftSessionId;
  await client.query(`UPDATE lift_rows SET deleted_at = now() WHERE entity = 'session' AND id = $1`, [LIVE]);
  assert.equal(await link(), null);
  await client.query(`UPDATE lift_rows SET deleted_at = NULL WHERE entity = 'session' AND id = $1`, [LIVE]);
  assert.equal(await link(), LIVE.toLowerCase());
});
