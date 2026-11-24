import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanTemplateEdit, parseRepRange, repsLabel, restLabel } from './templates.mjs';

const T0 = '2026-10-01T10:00:00.000Z';
const NOW = new Date('2026-11-03T21:00:00.000Z');
const slot = (id, exercise, position, extra = {}) => ({
  id, templateId: 'T1', position, exerciseId: `E-${id}`, exercise, sets: 3, repMin: 8, repMax: 10, weight: 135, unit: 'lb', rest: 120, note: null,
  payload: { id, templateID: 'T1', position, setCount: 3, repMin: 8, repMax: 10, weightValue: 135, weightUnit: 'lb', restSeconds: 120, updatedAt: T0 },
  ...extra,
});
const lift = {
  templates: [
    { id: 'T1', name: 'Heavy barbell', slots: [slot('S1', 'Back squat', 0), slot('S2', 'Romanian deadlift', 1), slot('S3', 'Dumbbell curl', 2)] },
    { id: 'T2', name: 'Upper (dumbbells)', slots: [] },
  ],
  library: [{ id: 'E-S1', name: 'Back squat' }, { id: 'E-X', name: 'Hip thrust' }],
};

test('a field change becomes the chat change shape, with only that field', () => {
  const r = cleanTemplateEdit({ kind: 'slot', slotId: 's2', field: 'rest', value: 180 }, lift);
  assert.ok('change' in r);
  assert.equal(r.change.action, 'update');
  assert.equal(r.change.slotId, 'S2');
  assert.deepEqual(r.change.set, { rest: 180 });
  assert.equal(r.change.was?.rest, 120);
});

test('reps take a range; the same value is no change', () => {
  const r = cleanTemplateEdit({ kind: 'slot', slotId: 'S1', field: 'reps', value: '5' }, lift);
  assert.ok('change' in r && r.change.set.repMin === 5 && r.change.set.repMax === 5);
  assert.deepEqual(cleanTemplateEdit({ kind: 'slot', slotId: 'S1', field: 'reps', value: '8–10' }, lift), { none: true });
  assert.ok('problem' in cleanTemplateEdit({ kind: 'slot', slotId: 'S1', field: 'reps', value: '12-8' }, lift));
});

test('an empty or zero load means Lift picks it; sets stay 1 to 10', () => {
  const r = cleanTemplateEdit({ kind: 'slot', slotId: 'S1', field: 'weight', value: '' }, lift);
  assert.ok('change' in r && r.change.set.weight === null);
  assert.ok('problem' in cleanTemplateEdit({ kind: 'slot', slotId: 'S1', field: 'sets', value: 0 }, lift));
  assert.ok('problem' in cleanTemplateEdit({ kind: 'slot', slotId: 'S1', field: 'sets', value: 2.5 }, lift));
});

test('a cue is trimmed; empty clears it', () => {
  const r = cleanTemplateEdit({ kind: 'slot', slotId: 'S1', field: 'note', value: '  brace  ' }, lift);
  assert.ok('change' in r && r.change.set.note === 'brace');
  assert.deepEqual(cleanTemplateEdit({ kind: 'slot', slotId: 'S1', field: 'note', value: ' ' }, lift), { none: true });
});

test('add takes a library exercise that is not in the template yet', () => {
  const r = cleanTemplateEdit({ kind: 'add', templateId: 'T1', exerciseId: 'E-X' }, lift);
  assert.ok('change' in r && r.change.action === 'add' && r.change.exercise === 'Hip thrust');
  assert.ok('problem' in cleanTemplateEdit({ kind: 'add', templateId: 'T1', exerciseId: 'E-S1' }, lift));
  assert.ok('problem' in cleanTemplateEdit({ kind: 'add', templateId: 'T1', exerciseId: 'nope' }, lift));
});

test('remove, and an unknown slot', () => {
  const r = cleanTemplateEdit({ kind: 'remove', slotId: 'S3' }, lift);
  assert.ok('change' in r && r.change.action === 'remove');
  assert.ok('problem' in cleanTemplateEdit({ kind: 'remove', slotId: 'gone' }, lift));
});

test('a move swaps the two positions, stamped now; past the end is nothing', () => {
  const r = cleanTemplateEdit({ kind: 'move', slotId: 'S2', by: -1 }, lift, null, NOW);
  assert.ok('rows' in r);
  assert.deepEqual(r.rows.map((x) => [x.payload.id, x.payload.position]), [['S2', 0], ['S1', 1]]);
  assert.equal(r.rows[0].payload.updatedAt, NOW.toISOString());
  assert.deepEqual(cleanTemplateEdit({ kind: 'move', slotId: 'S3', by: 1 }, lift), { none: true });
});

test('a move between equal stored positions uses the list order', () => {
  const same = { templates: [{ id: 'T1', name: 'A', slots: [slot('S1', 'A', 0), slot('S2', 'B', 0)] }], library: [] };
  const r = cleanTemplateEdit({ kind: 'move', slotId: 'S1', by: 1 }, same, null, NOW);
  assert.ok('rows' in r);
  assert.deepEqual(r.rows.map((x) => [x.payload.id, x.payload.position]), [['S1', 1], ['S2', 0]]);
});

test('rename keeps the row and refuses a taken or empty name', () => {
  const row = { id: 'T1', name: 'Heavy barbell', position: 0, updatedAt: T0 };
  const r = cleanTemplateEdit({ kind: 'rename', templateId: 'T1', name: ' Heavy  day ' }, lift, row, NOW);
  assert.ok('rows' in r);
  assert.deepEqual(r.rows[0], { entity: 'template', payload: { ...row, name: 'Heavy day', updatedAt: NOW.toISOString() } });
  assert.ok('problem' in cleanTemplateEdit({ kind: 'rename', templateId: 'T1', name: 'upper (dumbbells)' }, lift, row));
  assert.ok('problem' in cleanTemplateEdit({ kind: 'rename', templateId: 'T1', name: '  ' }, lift, row));
});

test('labels', () => {
  assert.deepEqual(parseRepRange('6 - 8'), [6, 8]);
  assert.equal(parseRepRange('0'), null);
  assert.equal(restLabel(90), '1:30');
  assert.equal(restLabel(null), '—');
  assert.equal(repsLabel(5, 5), '5');
});
