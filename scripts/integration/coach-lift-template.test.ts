// Integration test: a Coach chat template change (src/lib/coach-chat/lift-tools.ts) on a real Postgres. "RDLs 3 sets,
// 3 min rest next time" (Paolo, 2026-11-03) goes through the Lift sync push code, so the iPhone pulls it like its own
// edit; Undo puts the slot back, an added slot goes and a removed one comes back.
//
// Needs DATABASE_URL to a database built by npm run db:migrate, and DATABASE_DRIVER=pg. Synthetic rows only.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { applyTemplateChange, loadLiftTemplates, runLiftTool, undoTemplateChange } from '@/lib/coach-chat/lift-tools';
import { cleanTemplateChange } from '@/lib/coach-chat/lift-tools.mjs';

const url = process.env.DATABASE_URL;
if (!url || process.env.DATABASE_DRIVER !== 'pg') throw new Error('Set DATABASE_URL and DATABASE_DRIVER=pg');

const client = new pg.Client({ connectionString: url });
const up = () => crypto.randomUUID().toUpperCase();
const TEMPLATE = up();
const SQUAT = up();
const RDL = up();
const LIB_SQUAT = up();
const LIB_RDL = up();
const LIB_THRUST = up();
const T0 = '2026-10-01T10:00:00.000Z';
const ids = [TEMPLATE, SQUAT, RDL, LIB_SQUAT, LIB_RDL, LIB_THRUST];
const name = 'Chat test heavy';

async function row(entity: string, payload: Record<string, unknown>) {
  await client.query(`INSERT INTO lift_rows (entity, id, payload, updated_at) VALUES ($1, $2, $3, $4)`, [entity, payload.id, JSON.stringify(payload), T0]);
}
const slot = (id: string, exerciseID: string, position: number, displayName: string) => ({
  id, templateID: TEMPLATE, position, exerciseID, displayName, setCount: 2, repMin: 8, repMax: 10, weightValue: 135,
  weightUnit: 'lb', restSeconds: 120, kind: 'working', note: null, createdAt: T0, updatedAt: T0, deletedAt: null,
});

async function stored(id: string) {
  const { rows } = await client.query(`SELECT payload, deleted_at, seq FROM lift_rows WHERE id = $1`, [id]);
  return rows[0] as { payload: Record<string, unknown>; deleted_at: Date | null; seq: string };
}

before(async () => {
  await client.connect();
  await row('exercise', { id: LIB_SQUAT, name: 'Chat test squat', updatedAt: T0 });
  await row('exercise', { id: LIB_RDL, name: 'Chat test Romanian deadlift', updatedAt: T0 });
  await row('exercise', { id: LIB_THRUST, name: 'Chat test hip thrust', updatedAt: T0 });
  await row('template', { id: TEMPLATE, name, position: 99, updatedAt: T0 });
  await row('templateExercise', slot(SQUAT, LIB_SQUAT, 0, 'Squat'));
  await row('templateExercise', slot(RDL, LIB_RDL, 1, 'RDL'));
});

after(async () => {
  await client.query(`DELETE FROM lift_rows WHERE upper(id::text) = ANY($1) OR upper(payload->>'templateID') = $2`, [ids, TEMPLATE]);
  await client.end();
});

const mine = async () => {
  const all = await loadLiftTemplates();
  return { templates: all.templates.filter((t) => t.id.toUpperCase() === TEMPLATE), library: all.library };
};

test('the chat reads the template in full', async () => {
  const { templates } = await mine();
  assert.deepEqual(templates[0].slots.map((s) => s.exercise), ['Chat test squat', 'Chat test Romanian deadlift']);
  assert.equal(templates[0].slots[1].rest, 120);
  const text = await runLiftTool('user_none', '2026-11-03', 'get_lift_templates', {});
  assert.ok(text.ok);
  assert.match(text.text, new RegExp(`## ${name}\\n1\\. Chat test squat: 2 × 8–10 @ 135 lb, 2:00 rest`));
});

test('RDLs 3 sets with 3 min rest: pushed through Lift sync, and Undo puts it back', async () => {
  const lift = await mine();
  const r = cleanTemplateChange({ template: name, exercise: 'chat test RDL', sets: 3, rest: 180 }, lift);
  assert.ok('change' in r, JSON.stringify(r));
  const before = await stored(RDL);
  const done = await applyTemplateChange(r.change);
  const now = await stored(RDL);
  assert.equal(now.payload.setCount, 3);
  assert.equal(now.payload.restSeconds, 180);
  assert.equal(now.payload.repMin, 8);
  assert.ok(BigInt(now.seq) > BigInt(before.seq), 'a new seq, so the phone pulls it');
  assert.ok(String(now.payload.updatedAt) > T0);

  await undoTemplateChange(done.slotId, done.before);
  const back = await stored(RDL);
  assert.equal(back.payload.setCount, 2);
  assert.equal(back.payload.restSeconds, 120);
  assert.equal(back.deleted_at, null);
});

test('add a library exercise at the end, remove a slot, and undo both', async () => {
  const lift = await mine();
  const add = cleanTemplateChange({ template: name, exercise: 'chat test hip thrust', action: 'add', sets: 3, reps: '8-10' }, lift);
  assert.ok('change' in add, JSON.stringify(add));
  const added = await applyTemplateChange(add.change);
  let t = (await mine()).templates[0];
  assert.deepEqual(t.slots.map((s) => [s.exercise, s.sets, s.position]).at(-1), ['Chat test hip thrust', 3, 2]);
  ids.push(added.slotId);

  const remove = cleanTemplateChange({ template: name, exercise: 'chat test squat', action: 'remove' }, await mine());
  assert.ok('change' in remove, JSON.stringify(remove));
  const removed = await applyTemplateChange(remove.change);
  t = (await mine()).templates[0];
  assert.deepEqual(t.slots.map((s) => s.exercise), ['Chat test Romanian deadlift', 'Chat test hip thrust']);

  await undoTemplateChange(removed.slotId, removed.before);
  await undoTemplateChange(added.slotId, added.before);
  t = (await mine()).templates[0];
  assert.deepEqual(t.slots.map((s) => s.exercise), ['Chat test squat', 'Chat test Romanian deadlift']);
});
