// Integration test: the web template library (src/lib/lift/templates.ts) on a real Postgres. Each edit (a field,
// a move, a rename, an add, a remove) goes through the Lift sync push code with a new seq, so the iPhone pulls it.
//
// Needs DATABASE_URL to a database built by npm run db:migrate, and DATABASE_DRIVER=pg. Synthetic rows only.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { editTemplate, loadTemplateLibrary } from '@/lib/lift/templates';

const url = process.env.DATABASE_URL;
if (!url || process.env.DATABASE_DRIVER !== 'pg') throw new Error('Set DATABASE_URL and DATABASE_DRIVER=pg');

const client = new pg.Client({ connectionString: url });
const up = () => crypto.randomUUID().toUpperCase();
const TEMPLATE = up();
const SQUAT = up();
const ROW = up();
const LIB_SQUAT = up();
const LIB_ROW = up();
const LIB_CURL = up();
const T0 = '2026-10-01T10:00:00.000Z';
const ids = [TEMPLATE, SQUAT, ROW, LIB_SQUAT, LIB_ROW, LIB_CURL];
const NAME = 'Library test day';

async function row(entity: string, payload: Record<string, unknown>) {
  await client.query(`INSERT INTO lift_rows (entity, id, payload, updated_at) VALUES ($1, $2, $3, $4)`, [entity, payload.id, JSON.stringify(payload), T0]);
}
const slot = (id: string, exerciseID: string, position: number, displayName: string) => ({
  id, templateID: TEMPLATE, position, exerciseID, displayName, setCount: 3, repMin: 5, repMax: 5, weightValue: 225,
  weightUnit: 'lb', restSeconds: 180, kind: 'working', note: null, createdAt: T0, updatedAt: T0, deletedAt: null,
});
async function stored(id: string) {
  const { rows } = await client.query(`SELECT payload, deleted_at, seq FROM lift_rows WHERE id = $1`, [id]);
  return rows[0] as { payload: Record<string, unknown>; deleted_at: Date | null; seq: string };
}
const mine = async () => (await loadTemplateLibrary('user_none', '2026-11-03')).templates.find((t) => t.id.toUpperCase() === TEMPLATE)!;

before(async () => {
  await client.connect();
  await row('exercise', { id: LIB_SQUAT, name: 'Library test squat', catalogID: '0043', updatedAt: T0 });
  await row('exercise', { id: LIB_ROW, name: 'Library test row', updatedAt: T0 });
  await row('exercise', { id: LIB_CURL, name: 'Library test curl', updatedAt: T0 });
  await row('template', { id: TEMPLATE, name: NAME, position: 98, createdAt: T0, updatedAt: T0, deletedAt: null });
  await row('templateExercise', slot(SQUAT, LIB_SQUAT, 0, 'Squat'));
  await row('templateExercise', slot(ROW, LIB_ROW, 1, 'Row'));
});

after(async () => {
  await client.query(`DELETE FROM lift_rows WHERE upper(id::text) = ANY($1) OR upper(payload->>'templateID') = $2`, [ids, TEMPLATE]);
  await client.end();
});

test('the library reads every slot with its picture', async () => {
  const t = await mine();
  assert.deepEqual(t.slots.map((s) => [s.exercise, s.sets, s.repMin, s.weight, s.rest]), [
    ['Library test squat', 3, 5, 225, 180],
    ['Library test row', 3, 5, 225, 180],
  ]);
  assert.match(String(t.slots[0].image), /^https:\/\/raw\.githubusercontent\.com\//);
  assert.equal(t.slots[1].image, null);
});

test('a field edit is pushed with a new seq; the same value again is no change', async () => {
  const was = await stored(ROW);
  assert.deepEqual(await editTemplate({ kind: 'slot', slotId: ROW, field: 'reps', value: '8-10' }), { changed: true });
  const now = await stored(ROW);
  assert.equal(now.payload.repMin, 8);
  assert.equal(now.payload.repMax, 10);
  assert.ok(BigInt(now.seq) > BigInt(was.seq));
  assert.deepEqual(await editTemplate({ kind: 'slot', slotId: ROW, field: 'reps', value: '8–10' }), { changed: false });
  assert.ok('error' in (await editTemplate({ kind: 'slot', slotId: ROW, field: 'sets', value: 11 })));
});

test('move swaps the order; rename keeps the template', async () => {
  assert.deepEqual(await editTemplate({ kind: 'move', slotId: ROW, by: -1 }), { changed: true });
  assert.deepEqual((await mine()).slots.map((s) => s.exercise), ['Library test row', 'Library test squat']);
  assert.deepEqual(await editTemplate({ kind: 'rename', templateId: TEMPLATE, name: `${NAME} B` }), { changed: true });
  assert.equal((await mine()).name, `${NAME} B`);
});

test('add puts a library exercise at the end; remove takes it out', async () => {
  assert.deepEqual(await editTemplate({ kind: 'add', templateId: TEMPLATE, exerciseId: LIB_CURL }), { changed: true });
  let t = await mine();
  const curl = t.slots.at(-1)!;
  assert.deepEqual([curl.exercise, curl.sets, curl.repMin, curl.repMax], ['Library test curl', 3, 8, 12]);
  ids.push(curl.id.toUpperCase());
  assert.deepEqual(await editTemplate({ kind: 'remove', slotId: curl.id }), { changed: true });
  t = await mine();
  assert.deepEqual(t.slots.map((s) => s.exercise), ['Library test row', 'Library test squat']);
  assert.ok((await stored(curl.id)).deleted_at);
});
