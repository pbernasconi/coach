import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel, exerciseHistory, muscleSets, sessionDetail, sessionSummaries, topLifts, weeklyVolume } from './stats.mjs';

const SQUAT = 'AAAAAAAA-0000-0000-0000-000000000001';
const ROW = 'AAAAAAAA-0000-0000-0000-000000000002';

function data() {
  const exercises = [
    { id: SQUAT, name: 'Back squat', primaryMuscles: '["quads","glutes"]', secondaryMuscles: '["hamstrings"]', deletedAt: null },
    { id: ROW, name: 'Row', primaryMuscles: ['lats'], secondaryMuscles: [], deletedAt: null },
  ];
  const sessions = [
    { id: 's1', day: '2026-10-13', title: 'Heavy', deletedAt: null },
    { id: 's2', day: '2026-10-20', title: 'Heavy', deletedAt: null },
  ];
  const sessionExercises = [
    { id: 'e1', sessionID: 's1', exerciseID: SQUAT, displayName: 'Back squat', deletedAt: null },
    { id: 'e2', sessionID: 's2', exerciseID: SQUAT, displayName: 'Back squat', deletedAt: null },
    { id: 'e3', sessionID: 's2', exerciseID: ROW, displayName: 'Row', deletedAt: null },
    { id: 'e4', sessionID: 's2', exerciseID: null, displayName: 'Plank', deletedAt: null },
  ];
  const set = (id, se, reps, weight, extra = {}) => ({
    id, sessionExerciseID: se, actualReps: reps, actualWeight: weight, unit: 'kg', kind: 'working', status: 'done', deletedAt: null, ...extra,
  });
  const sets = [
    set('a', 'e1', 5, 100),
    set('b', 'e1', 5, 100),
    set('c', 'e2', 5, 110),
    set('d', 'e2', 5, 110),
    set('w', 'e2', 5, 60, { kind: 'warmUp' }),
    set('p', 'e2', 5, 115, { status: 'planned' }),
    set('r', 'e3', 10, 50),
    set('k', 'e4', 1, 0),
  ];
  return { exercises, sessions, sessionExercises, sets };
}

test('muscleSets counts done working sets: 1 per primary, 0.5 per secondary', () => {
  const m = buildModel(data());
  const week = Object.fromEntries(muscleSets(m, '2026-10-19', '2026-10-25').map((x) => [x.muscle, x.sets]));
  // Warm-ups, planned sets and exercises without library muscles do not count.
  assert.deepEqual(week, { glutes: 2, quads: 2, back: 1, hamstrings: 1 });
  assert.equal(muscleSets(m, '2026-10-19', '2026-10-25')[0].status, 'below');
});

test('topLifts ranks by sessions and gives the e1RM change', () => {
  const m = buildModel(data());
  const [squat, row] = topLifts(m, 'kg', '2026-10-01');
  assert.equal(squat.name, 'Back squat');
  assert.equal(squat.sessions, 2);
  assert.ok(squat.change > 0.09 && squat.change < 0.11); // 100 -> 110 kg at 5 reps
  assert.equal(row.change, null); // one session: no trend yet
  assert.deepEqual(topLifts(m, 'kg', '2026-10-21'), []);
});

test('a session with a malformed day is dropped, not an exception (the pages keep working)', () => {
  const model = buildModel({
    exercises: [],
    sessions: [
      { id: 'A', day: '2026-10-20T00:00', title: 'Odd but readable' },
      { id: 'B', day: 'next tuesday', title: 'Unreadable' },
    ],
    sessionExercises: [],
    sets: [],
  });
  assert.deepEqual([...model.sessions.values()].map((s) => s.day), ['2026-10-20']);
  assert.doesNotThrow(() => weeklyVolume(model, 'kg'));
});

test('sessionSummaries leaves out a planned session with nothing logged', () => {
  const d = data();
  d.sessions.push({ id: 's3', day: '2026-10-27', title: 'Heavy', deletedAt: null });
  d.sessionExercises.push({ id: 'e5', sessionID: 's3', exerciseID: SQUAT, displayName: 'Back squat', deletedAt: null });
  d.sets.push({ id: 'q', sessionExerciseID: 'e5', actualReps: null, actualWeight: null, unit: 'kg', kind: 'working', status: 'planned', deletedAt: null });
  const m = buildModel(d);
  assert.deepEqual(sessionSummaries(m, 'kg').map((s) => s.id), ['s2', 's1']);
  assert.deepEqual(sessionSummaries(m, 'kg', { planned: true }).map((s) => s.id), ['s3', 's2', 's1']);
});

test('sessionDetail gives each set its target, so a planned session shows what to lift', () => {
  const d = data();
  d.sessions.push({ id: 'S3', day: '2026-10-27', title: 'Heavy', deletedAt: null });
  d.sessionExercises.push({ id: 'e5', sessionID: 'S3', exerciseID: SQUAT, displayName: 'Back squat', loadMode: 'total', position: 0, deletedAt: null });
  d.sets.push({ id: 'q', sessionExerciseID: 'e5', position: 0, actualReps: null, actualWeight: null, targetReps: 8, targetRepMin: null, targetRepMax: null, targetWeight: 100, unit: 'kg', kind: 'working', status: 'planned', deletedAt: null });
  const s = sessionDetail(buildModel(d), 's3', 'kg');
  assert.equal(s.exercises[0].loadMode, 'total');
  assert.deepEqual(s.exercises[0].sets[0].target, { reps: 8, repMin: null, repMax: null, weight: 100 });
  assert.equal(s.exercises[0].sets[0].status, 'planned');
});

test('exerciseHistory: the last session before a day, the best e1RM and the trend, without the session itself', () => {
  const m = buildModel(data());
  const h = exerciseHistory(m, `id-${SQUAT.toLowerCase()}`, 'kg', '2026-10-20', 's2');
  assert.equal(h.last.day, '2026-10-13');
  assert.deepEqual(h.last.sets, [{ reps: 5, weight: 100 }, { reps: 5, weight: 100 }]);
  assert.equal(h.sessions, 1);
  assert.equal(Math.round(h.best.e1rm), 117);
  assert.equal(h.trend.length, 1);
  // Nothing before the first session.
  assert.equal(exerciseHistory(m, `id-${SQUAT.toLowerCase()}`, 'kg', '2026-10-13', 's1').last, null);
});

test('sessionNote drops the Apple Notes import lines', async () => {
  const { sessionNote } = await import('./stats.mjs');
  assert.equal(sessionNote('Imported from Apple Notes (notes-import): “Workout C”, note created 2026-09-02.\nDate confidence low: x\nFelt strong'), 'Felt strong');
  assert.equal(sessionNote('Imported from Apple Notes (notes-import): “Workout C”.'), null);
  assert.equal(sessionNote('Good day'), 'Good day');
});

test('buildModel folds catalog muscle names into the app muscles', () => {
  const m = buildModel({
    sessions: [], sessionExercises: [], sets: [], exercises: [{ id: SQUAT, name: 'Squat', primaryMuscles: ['Quadriceps', 'quads'], secondaryMuscles: ['lower back'], deletedAt: null }],
  });
  assert.deepEqual(m.muscles.get(`id-${SQUAT.toLowerCase()}`), { primary: ['quads'], secondary: ['back'] });
});
