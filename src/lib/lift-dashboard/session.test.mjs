import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel, sessionDetail } from './stats.mjs';

// Synthetic data only.
const BENCH = 'BBBBBBBB-0000-0000-0000-000000000001';

function model() {
  return buildModel({
    exercises: [{ id: BENCH, name: 'Bench press', deletedAt: null }],
    sessions: [
      { id: 'S-OLD', day: '2026-10-13', title: 'Upper', startedAt: '2026-10-13T16:00:00.000Z', finishedAt: '2026-10-13T16:55:00.000Z', note: 'Felt good', unitsAtLog: 'kg' },
      { id: 'S-NEW', day: '2026-10-20', title: 'Lower', startedAt: '2026-10-20T16:00:00.000Z', finishedAt: null },
    ],
    sessionExercises: [
      // Listed out of order: the detail sorts by position.
      { id: 'SE-2', sessionID: 'S-OLD', exerciseID: null, displayName: 'Plank', position: 1, note: 'Hold' },
      { id: 'SE-1', sessionID: 'S-OLD', exerciseID: BENCH, displayName: 'Bench', position: 0 },
    ],
    sets: [
      { id: 'X3', sessionExerciseID: 'SE-1', position: 2, kind: 'working', status: 'planned', actualReps: null, actualWeight: null, unit: 'kg' },
      { id: 'X1', sessionExerciseID: 'SE-1', position: 0, kind: 'warmUp', status: 'done', actualReps: 10, actualWeight: 40, unit: 'kg' },
      { id: 'X2', sessionExerciseID: 'SE-1', position: 1, kind: 'working', status: 'done', actualReps: 5, actualWeight: 80, unit: 'kg', note: 'Paused' },
      { id: 'X4', sessionExerciseID: 'SE-2', position: 0, kind: 'working', status: 'done', actualReps: 1, actualWeight: null, unit: 'kg' },
    ],
  });
}

test('sessionDetail gives the exercises and sets in order, with totals', () => {
  const d = sessionDetail(model(), 's-old', 'kg');
  assert.ok(d);
  assert.equal(d.title, 'Upper');
  assert.equal(d.minutes, 55);
  assert.equal(d.note, 'Felt good');
  assert.equal(d.volume, 400); // 5 x 80; the warm-up does not count
  assert.deepEqual([d.setsLogged, d.setsTotal], [3, 4]);
  assert.deepEqual(d.exercises.map((e) => [e.name, e.key]), [['Bench press', `id-${BENCH.toLowerCase()}`], ['Plank', 'name-plank']]);
  const bench = d.exercises[0];
  assert.deepEqual(bench.sets.map((s) => [s.label, s.status, s.reps, s.weight]), [['W', 'done', 10, 40], ['1', 'done', 5, 80], ['2', 'planned', null, null]]);
  assert.equal(bench.sets[1].note, 'Paused');
  assert.equal(bench.setsLogged, 2);
  assert.equal(d.exercises[1].note, 'Hold');
  assert.equal(d.newerId, 's-new');
  assert.equal(d.olderId, null);
});

test('sessionDetail converts weights to the display unit', () => {
  const lb = sessionDetail(model(), 's-old', 'lb');
  assert.ok(Math.abs(lb.exercises[0].sets[1].weight - 176.37) < 0.01);
});

test('sessionDetail: latest is the newest logged session; a planned session opens; an unknown id is null', () => {
  assert.equal(sessionDetail(model(), 'latest', 'kg').id, 's-old');
  const planned = sessionDetail(model(), 'S-NEW', 'kg');
  assert.equal(planned.minutes, null); // no end time, no duration
  assert.deepEqual(planned.exercises, []);
  assert.equal(planned.olderId, 's-old');
  assert.equal(sessionDetail(model(), 'nope', 'kg'), null);
  assert.equal(sessionDetail(buildModel({ exercises: [], sessions: [], sessionExercises: [], sets: [] }), 'latest', 'kg'), null);
});
