import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanTemplateChange, historyText, matchName, parseReps, slotPayload, stampAfter, templateChangeText, templatesText,
} from './lift-tools.mjs';
import { checkProposalInput, recheck, undoPlan } from './changes.mjs';

const slot = (id, exercise, extra = {}) => ({
  id, templateId: 'T1', position: 0, exerciseId: `E-${id}`, exercise, sets: 2, repMin: 8, repMax: 10, weight: 135, unit: 'lb',
  rest: 120, note: null, payload: { id, templateID: 'T1', setCount: 2, repMin: 8, repMax: 10, weightValue: 135, weightUnit: 'lb', restSeconds: 120, kind: 'working', updatedAt: '2026-11-01T10:00:00.000Z' },
  ...extra,
});
const lift = {
  templates: [
    { id: 'T1', name: 'Heavy barbell', slots: [slot('S1', 'Back squat'), slot('S2', 'Romanian deadlift'), slot('S3', 'Dumbbell curl')] },
    { id: 'T2', name: 'Upper (dumbbells)', slots: [slot('S4', 'Dumbbell curl')] },
  ],
  library: [{ id: 'L1', name: 'Hip thrust' }, { id: 'L2', name: 'Leg curl' }, { id: 'L3', name: 'Nordic hamstring curl' }],
};

test('names: RDL means Romanian deadlift; a near name must be one', () => {
  const items = [{ name: 'Romanian deadlift' }, { name: 'Back squat' }, { name: 'Leg curl' }, { name: 'Nordic hamstring curl' }];
  assert.deepEqual(matchName('RDLs', items), { hit: items[0] });
  assert.deepEqual(matchName('back squats', items), { hit: items[1] });
  assert.ok('many' in matchName('curl', items));
  assert.ok('none' in matchName('bench', items));
});

test('reps', () => {
  assert.deepEqual(parseReps('8-12'), [8, 12]);
  assert.deepEqual(parseReps('6–8'), [6, 8]);
  assert.deepEqual(parseReps(5), [5, 5]);
  assert.equal(parseReps('12-8'), null);
  assert.equal(parseReps('lots'), null);
});

test('Paolo\'s ask: RDLs 3 sets with 3 min rest in Heavy barbell', () => {
  const r = cleanTemplateChange({ op: 'template', template: 'heavy barbell', exercise: 'RDL', sets: 3, rest: 180 }, lift);
  assert.ok('change' in r);
  const c = r.change;
  assert.deepEqual([c.action, c.templateId, c.slotId, c.exercise], ['update', 'T1', 'S2', 'Romanian deadlift']);
  assert.deepEqual(c.set, { sets: 3, rest: 180 });
  assert.equal(templateChangeText(c), 'Heavy barbell: 2 → 3 sets, rest 2:00 → 3:00');
  const next = slotPayload(c, lift.templates[0].slots[1].payload, { now: '2026-11-03T21:00:00.000Z', id: 'S2', position: 1, unit: 'lb' });
  assert.equal(next.setCount, 3);
  assert.equal(next.restSeconds, 180);
  assert.equal(next.repMin, 8);
  assert.equal(next.weightValue, 135);
  assert.equal(next.updatedAt, '2026-11-03T21:00:00.000Z');
});

test('template changes that are wrong go back with the reason', () => {
  const p = (b) => /** @type {any} */ (cleanTemplateChange(b, lift)).problem;
  assert.match(p({ template: 'Legs', exercise: 'RDL', sets: 3 }), /template must be one of Heavy barbell/);
  assert.match(p({ template: 'Heavy barbell', exercise: 'Bench press', sets: 3 }), /has no Bench press; it has Back squat/);
  assert.match(p({ template: 'Heavy barbell', exercise: 'RDL', sets: 3, rest: 2 * 3600 }), /rest is seconds/);
  assert.match(p({ template: 'Heavy barbell', exercise: 'RDL', sets: 2 }), /already like that/);
  assert.match(p({ template: 'Heavy barbell', exercise: 'curl', action: 'add' }), /could be Leg curl, Nordic hamstring curl/);
  assert.match(p({ template: 'Heavy barbell', exercise: 'RDL', sets: 3 }) ?? '', /^$/);
  assert.match(cleanTemplateChange({ template: 'Heavy barbell', exercise: 'RDL' }, { templates: [], library: [] }).problem, /not available/);
});

test('add and remove a slot', () => {
  const add = /** @type {any} */ (cleanTemplateChange({ template: 'Heavy barbell', exercise: 'hip thrust', action: 'add', sets: 3, reps: '8-10' }, lift)).change;
  assert.equal(templateChangeText(add), 'Added to Heavy barbell: 3 sets, 8–10 reps');
  const row = slotPayload(add, null, { now: 'N', id: 'NEW', position: 3, unit: 'lb' });
  assert.deepEqual([row.templateID, row.exerciseID, row.setCount, row.repMin, row.repMax, row.restSeconds, row.kind, row.deletedAt], ['T1', 'L1', 3, 8, 10, 120, 'working', null]);
  const out = /** @type {any} */ (cleanTemplateChange({ template: 'Heavy barbell', exercise: 'curl', action: 'remove' }, lift)).change;
  assert.equal(out.slotId, 'S3');
  assert.equal(slotPayload(out, lift.templates[0].slots[2].payload, { now: 'N', id: 'S3', position: 2, unit: 'lb' }).deletedAt, 'N');
});

test('the card shows a template change, and Apply and Undo take it as it is', () => {
  const plan = { rows: [], today: '2026-11-03', lift };
  const r = checkProposalInput({ title: 'RDLs: 3 sets, 3 min rest', why: 'You asked.', changes: [{ op: 'template', template: 'Heavy barbell', exercise: 'RDL', sets: 3, rest: 180 }] }, plan, 1);
  assert.ok(r.ok);
  assert.deepEqual(r.value.items, [{ kind: 'changed', title: 'Romanian deadlift', detail: 'Heavy barbell: 2 → 3 sets, rest 2:00 → 3:00' }]);
  assert.equal(r.value.card.days[0].label, 'Lift template, next lifts on it');
  assert.equal(r.value.card.days[0].rows[0].tag, 'Changed');
  assert.equal(r.value.card.summary, '1 change');
  assert.deepEqual(r.value.basis, {});
  // At Apply the checked change goes through as stored.
  assert.deepEqual(recheck(r.value.changes, { rows: [], today: '2026-11-03' }, []), []);
  // Undo always puts a template back.
  assert.deepEqual(undoPlan([{ op: 'template', slotId: 'S2', before: {} }], {}, []).run.length, 1);
  // Two changes to one exercise are one.
  const two = checkProposalInput({ title: 'x', changes: [{ op: 'template', template: 'Heavy barbell', exercise: 'RDL', sets: 3 }, { op: 'template', template: 'Heavy barbell', exercise: 'RDL', rest: 180 }] }, plan, 1);
  assert.ok(!two.ok);
});

test('templates and history as text', () => {
  const t = templatesText(lift.templates, [{ day: '2026-11-06', template: 'heavy barbell', title: 'Heavy barbell lift' }]);
  assert.match(t, /## Heavy barbell\n1\. Back squat: 2 × 8–10 @ 135 lb, 2:00 rest/);
  assert.match(t, /Planned: 2026-11-06 Heavy barbell lift/);
  assert.match(t, /## Upper \(dumbbells\)[\s\S]*Planned: none/);
  const h = historyText('Romanian deadlift', [
    { day: '2026-10-27', sessionId: 'a', reps: 8, weight: 135, kind: 'working' },
    { day: '2026-10-27', sessionId: 'a', reps: 5, weight: 95, kind: 'warmUp' },
    { day: '2026-11-03', sessionId: 'b', reps: 8, weight: 145, kind: 'working' },
    { day: '2026-11-03', sessionId: 'b', reps: 7, weight: 145, kind: 'working' },
  ], 'lb');
  assert.equal(h.split('\n')[0], 'Romanian deadlift, in lb: 2 sessions logged. Best e1RM 184 (2026-11-03).');
  assert.equal(h.split('\n')[1], '2026-11-03: 145 × 8, 145 × 7 · e1RM 184');
  assert.equal(historyText('Hip thrust', [], 'lb'), 'Hip thrust: nothing logged yet.');
});

test('a stamp never goes behind the row', () => {
  const now = new Date('2026-11-03T21:00:00.000Z');
  assert.equal(stampAfter({ updatedAt: '2026-11-01T00:00:00.000Z' }, now), '2026-11-03T21:00:00.000Z');
  assert.equal(stampAfter({ updatedAt: '2026-11-03T21:00:05.000Z' }, now), '2026-11-03T21:00:05.001Z');
});
