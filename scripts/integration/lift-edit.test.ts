// Integration test: a Lift session edit from the Plan modal (src/lib/lift/edit-store.ts) on a real Postgres. The
// edit goes through the Lift sync push code, so each changed row gets a newer updated_at and a fresh seq (the
// iPhone pulls by seq), and the plan's text copy of the sets follows.
//
// Needs DATABASE_URL to a database built by npm run db:migrate, and DATABASE_DRIVER=pg. Synthetic rows only.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { applyLiftEdit } from '@/lib/lift/edit-store';

const url = process.env.DATABASE_URL;
if (!url || process.env.DATABASE_DRIVER !== 'pg') throw new Error('Set DATABASE_URL and DATABASE_DRIVER=pg');

const client = new pg.Client({ connectionString: url });
const up = () => crypto.randomUUID().toUpperCase();
const USER = 'user_lift_edit';
const SESSION = up();
const SLOT = up();
const SET_A = up();
const SET_B = up();
const LIB = up();
const T0 = '2026-10-01T10:00:00.000Z';
let activity = '';

async function row(entity: string, payload: Record<string, unknown>) {
  await client.query(`INSERT INTO lift_rows (entity, id, payload, updated_at) VALUES ($1, $2, $3, $4)`, [entity, payload.id, JSON.stringify(payload), T0]);
}

before(async () => {
  await client.connect();
  // Created later than any other user, so the health test's owner (the first user) stays the same.
  await client.query(`INSERT INTO users (id, email, created_at) VALUES ($1, 'lift-edit@example.com', now() + interval '1 day')`, [USER]);
  const plan = crypto.randomUUID();
  await client.query(
    `INSERT INTO training_plans (id, user_id, week_start_date, week_end_date, plan_content, ai_model, status) VALUES ($1, $2, '2026-10-19', '2026-10-25', '', 'test', 'active')`,
    [plan, USER]
  );
  activity = crypto.randomUUID();
  await client.query(
    `INSERT INTO training_plan_activities (id, plan_id, activity_type, title, scheduled_date, description, lift_session_id)
     VALUES ($1, $2, 'strength', 'Heavy lift', '2026-10-20', $3, $4)`,
    [activity, plan, 'Go heavy.\n\n— Lift session (log each set in Lift) —\nTemplate: Old', SESSION.toLowerCase()]
  );
  await row('exercise', { id: LIB, name: 'Calf raise', loadMode: 'total', equipment: 'machine', updatedAt: T0, deletedAt: null });
  await row('session', { id: SESSION, day: '2026-10-20', title: 'Heavy barbell', unitsAtLog: 'lb', startedAt: null, finishedAt: null, updatedAt: T0, deletedAt: null });
  await row('sessionExercise', { id: SLOT, sessionID: SESSION, exerciseID: up(), displayName: 'Back squat', position: 0, loadMode: 'total', note: null, updatedAt: T0, deletedAt: null });
  for (const [id, position] of [[SET_A, 0], [SET_B, 1]] as const) {
    await row('set', {
      id, sessionExerciseID: SLOT, position, kind: 'working', status: 'planned', unit: 'lb', loadMode: 'total', targetReps: 8,
      targetRepMin: null, targetRepMax: null, targetWeight: 230, actualReps: null, actualWeight: null, updatedAt: T0, deletedAt: null,
    });
  }
});
after(async () => {
  await client.end();
});

const payload = async (id: string) =>
  (await client.query(`SELECT payload, updated_at, deleted_at, seq FROM lift_rows WHERE id = $1`, [id])).rows[0] as { payload: Record<string, unknown>; updated_at: Date; deleted_at: Date | null; seq: string };

test('an edit writes newer Lift rows with fresh seqs and refreshes the plan text', async () => {
  const before = await payload(SET_A);
  const r = await applyLiftEdit(USER, SESSION.toLowerCase(), [
    { type: 'setTarget', setId: SET_A.toLowerCase(), weight: 240, reps: 6 },
    { type: 'removeSet', setId: SET_B.toLowerCase() },
    { type: 'addExercise', exerciseId: LIB.toLowerCase(), sets: 2, reps: 12, weight: 90 },
  ]);
  assert.deepEqual(r, { weeks: ['2026-10-19'] });

  const a = await payload(SET_A);
  assert.equal(a.payload.targetWeight, 240);
  assert.equal(a.payload.targetReps, 6);
  assert.ok(a.updated_at.getTime() > before.updated_at.getTime());
  assert.ok(Number(a.seq) > Number(before.seq));
  assert.ok((await payload(SET_B)).deleted_at, 'the removed set is soft-deleted');

  const added = (await client.query(`SELECT payload FROM lift_rows WHERE entity = 'sessionExercise' AND payload->>'displayName' = 'Calf raise'`)).rows;
  assert.equal(added.length, 1);
  const addedSets = (await client.query(`SELECT 1 FROM lift_rows WHERE entity = 'set' AND lower(payload->>'sessionExerciseID') = lower($1)`, [added[0].payload.id])).rows;
  assert.equal(addedSets.length, 2);

  const [plan] = (await client.query(`SELECT description FROM training_plan_activities WHERE id = $1`, [activity])).rows;
  assert.match(plan.description, /^Go heavy\./);
  assert.match(plan.description, /Back squat 1 × 6 @ 240 lb/);
  assert.match(plan.description, /Calf raise 2 × 12 @ 90 lb/);
});

test('a logged set is refused and nothing is written', async () => {
  await client.query(`UPDATE lift_rows SET payload = payload || '{"status":"done","actualReps":6,"actualWeight":240}'::jsonb WHERE id = $1`, [SET_A]);
  const before = await payload(SET_A);
  const r = await applyLiftEdit(USER, SESSION.toLowerCase(), [{ type: 'setTarget', setId: SET_A.toLowerCase(), weight: 250 }]);
  assert.ok('error' in r);
  assert.equal((await payload(SET_A)).seq, before.seq);
});
