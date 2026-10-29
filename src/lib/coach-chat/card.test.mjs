import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardOf, fingerprint, isStale, landedIssues, moveAsAddIssues, plainTitle, recheck, undoPlan } from './changes.mjs';
import { undoRecord } from './undo-record.mjs';

// Thu 29 Oct 2026: the card Paolo found cluttered: Upper to Friday, the 10k test to Saturday, a hike for the long ride.
const today = '2026-10-29';
const row = (id, date, startTime, title, sport, extra = {}) => ({
  id, date, startTime, title, sport, workoutType: null, intensity: null, duration: 60, description: null,
  status: 'planned', state: 'planned', liftTemplate: null, ...extra,
});
const rows = [
  row('test', '2026-10-30', '07:30:00', '🏃 10k test', 'run', { duration: 55 }),
  row('spin', '2026-10-31', '09:00:00', '🚴 Easy spin + sprints — Zwift', 'ride'),
  row('upper', '2026-10-31', '10:00:00', '🏋️ Upper (dumbbells)', 'strength', { liftTemplate: 'Upper (dumbbells)' }),
  row('long', '2026-11-01', '08:30:00', '🚴 Long ride', 'ride', { duration: 180 }),
  row('physio', '2026-11-01', '12:30:00', '🩹 Physio A — Achilles & calf', 'strength', { duration: 20 }),
];
const changes = [
  { op: 'move', id: 'upper', date: '2026-10-30', startTime: '09:45' },
  { op: 'move', id: 'test', date: '2026-10-31', startTime: '09:00' },
  { op: 'skip', id: 'spin', reason: 'other' },
  { op: 'skip', id: 'long', reason: 'other' },
  { op: 'add', date: '2026-11-01', sport: 'hike', startTime: '08:30', title: 'Long easy hike', duration: 180, effort: 'easy', description: '' },
  { op: 'move', id: 'physio', date: '2026-11-01', startTime: '11:30' },
];

test('the card groups changes by day, one tag each, a hike replacing the long ride', () => {
  const card = cardOf(changes, rows);
  assert.equal(card.summary, '6 changes · Fri 30 Oct to Sun 1 Nov');
  assert.deepEqual(card.days.map((d) => d.label), ['Fri 30 Oct', 'Sat 31 Oct', 'Sun 1 Nov']);
  assert.deepEqual(card.days.map((d) => d.rows.map((r) => [r.title, r.tag, r.meta])), [
    [['Upper (dumbbells)', 'From Sat', '09:45 · 1 h']],
    [['10k test', 'From Fri', '09:00 · 55 min'], ['Easy spin + sprints — Zwift', 'Skipped', '09:00 · 1 h']],
    [['Long easy hike', 'New', '08:30 · 3 h · replaces Long ride'], ['Physio A — Achilles & calf', 'Earlier', '11:30, was 12:30 · 20 min']],
  ]);
  assert.deepEqual(card.days[1].rows.map((r) => r.tone), ['move', 'skip']);
});

test('a preference goes under Remember, after the days', () => {
  const card = cardOf([{ op: 'remember', text: 'No runs before 7' }], rows);
  assert.equal(card.summary, '1 change');
  assert.deepEqual(card.days, [{ date: null, label: 'Remember', rows: [{ title: 'No runs before 7', sport: null, time: null, meta: 'Coach keeps this in mind', tag: 'Saved', tone: 'new' }] }]);
});

test('plainTitle drops a leading emoji only', () => {
  assert.equal(plainTitle('🏋️ Upper (dumbbells)'), 'Upper (dumbbells)');
  assert.equal(plainTitle('10k test 🏃'), '10k test 🏃');
});

test('a skip plus an add of the same lift in the week is refused: write a move', () => {
  const issues = moveAsAddIssues(rows, [
    { op: 'skip', id: 'upper', reason: 'busy' },
    { op: 'add', date: '2026-10-30', sport: 'strength', startTime: '09:45', title: 'Upper', duration: 60, effort: 'moderate', description: '', liftTemplate: 'Upper (dumbbells)' },
  ]);
  assert.equal(issues.length, 1);
  assert.match(issues[0], /use \{ op: "move", id: "upper"/);
  assert.deepEqual(moveAsAddIssues(rows, changes), [], 'a hike for a long ride is a replacement, not a move');
});

test('recheck at Apply: fine on the same plan, refuses a day that is now past or a workout now done', () => {
  assert.deepEqual(recheck(changes, { rows, today }, []), []);
  assert.match(recheck(changes, { rows, today: '2026-10-31' }, [])[0], /in the past/);
  const done = rows.map((r) => (r.id === 'test' ? { ...r, state: 'done' } : r));
  assert.match(recheck(changes, { rows: done, today }, [])[0], /10k test is done/);
});

test('recheck at Apply refuses a copy of a lift added to the plan since', () => {
  const add = [{ op: 'add', date: '2026-11-02', sport: 'strength', startTime: '17:00', title: 'Upper', duration: 60, effort: 'moderate', description: '', liftTemplate: 'Upper (dumbbells)' }];
  const later = [...rows, row('upper2', '2026-11-03', '17:00:00', 'Upper (dumbbells)', 'strength', { liftTemplate: 'Upper (dumbbells)' })];
  assert.deepEqual(recheck(add, { rows, today }, []), []);
  assert.match(recheck(add, { rows: later, today }, []).join(' '), /already planned this week/);
});

test('landedIssues names a change that did not land', () => {
  const after = [
    { ...rows[2], date: '2026-10-30', startTime: '09:45:00' },
    { ...rows[0], date: '2026-10-31', startTime: '09:00:00' },
    { ...rows[1], status: 'skipped' },
    { ...rows[3], status: 'skipped' },
    row('hike', '2026-11-01', '08:30:00', 'Long easy hike', 'hike'),
    { ...rows[4], startTime: '12:30:00' },
  ];
  assert.deepEqual(landedIssues(changes, [null, null, null, null, 'hike', null], after), ['Physio A — Achilles & calf isn\'t at Sun 1 Nov 11:30']);
  assert.deepEqual(landedIssues(changes, [null, null, null, null, 'gone', null], after.slice(0, 4)).length, 2);
});

test('Undo leaves alone a workout Paolo changed after Apply', () => {
  const now = rows.map((r) => (r.id === 'upper' ? { ...r, date: '2026-10-30', startTime: '09:45:00' } : r));
  const after = Object.fromEntries(now.map((r) => [r.id, fingerprint(r)]));
  const steps = [
    { op: 'edit', id: 'upper', body: {}, title: 'Upper (dumbbells)' },
    { op: 'unskip', id: 'spin', title: 'Easy spin' },
    { op: 'forget', text: 'x' },
    { op: 'restore', row: { id: 'deleted' } },
  ];
  assert.deepEqual(undoPlan(steps, after, now), { run: steps, kept: [] });
  const moved = now.map((r) => (r.id === 'upper' ? { ...r, startTime: '18:00:00' } : r));
  assert.deepEqual(undoPlan(steps, after, moved).kept, ['Upper (dumbbells)']);
  assert.equal(undoPlan(steps, after, moved).run.length, 3);
  const done = now.map((r) => (r.id === 'spin' ? { ...r, state: 'done' } : r));
  assert.deepEqual(undoPlan(steps, after, done).kept, ['Easy spin + sprints — Zwift']);
  assert.deepEqual(undoPlan(steps, null, moved).kept, [], 'an old card without fingerprints undoes everything');
});

test('undoRecord reads the old list and the new record', () => {
  assert.deepEqual(undoRecord([{ op: 'remove', id: 'x' }]), { steps: [{ op: 'remove', id: 'x' }], after: null, result: [] });
  assert.deepEqual(undoRecord(null), { steps: [], after: null, result: [] });
  assert.deepEqual(undoRecord({ steps: [], after: { a: '1' }, result: ['ok'] }), { steps: [], after: { a: '1' }, result: ['ok'] });
});

test('a card stored with the old five-field fingerprint still checks', () => {
  const r = rows[0];
  const legacy = [r.date, '07:30', r.status, r.title, r.duration].join('|');
  assert.equal(isStale({ test: legacy }, rows), false);
  assert.equal(isStale({ test: legacy }, [{ ...r, startTime: '08:00:00' }]), true);
  assert.equal(isStale({ test: fingerprint(r) }, [{ ...r, description: 'new notes' }]), true, 'the new one sees edited notes');
});
