import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel } from './stats.mjs';
import { liftOverview } from './overview.mjs';
import { targetStatus } from './focus.mjs';

const CURL = 'AAAAAAAA-0000-0000-0000-00000000000c';
const SQUAT = 'AAAAAAAA-0000-0000-0000-00000000000s';

/** Curls and squats over five weeks; this week (Oct 19–25) has Monday done and Friday planned. */
function data() {
  const exercises = [
    { id: CURL, name: 'EZ-bar curl', primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'], deletedAt: null },
    { id: SQUAT, name: 'Back squat', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: [], deletedAt: null },
  ];
  const days = ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'];
  const sessions = [...days.map((day, i) => ({ id: `s${i}`, day, title: 'Heavy', deletedAt: null })), { id: 'fri', day: '2026-10-23', title: 'Arms', deletedAt: null }];
  const sessionExercises = [
    ...days.flatMap((_, i) => [
      { id: `c${i}`, sessionID: `s${i}`, exerciseID: CURL, deletedAt: null },
      { id: `q${i}`, sessionID: `s${i}`, exerciseID: SQUAT, deletedAt: null },
    ]),
    { id: 'fc', sessionID: 'fri', exerciseID: CURL, deletedAt: null },
  ];
  const set = (id, se, reps, weight, extra = {}) => ({
    id, sessionExerciseID: se, actualReps: reps, actualWeight: weight, unit: 'kg', kind: 'working', status: 'done', deletedAt: null, ...extra,
  });
  const sets = [
    ...days.flatMap((_, i) => [
      ...[1, 2, 3].map((n) => set(`c${i}${n}`, `c${i}`, 10, 30 + i * 2.5)),
      ...[1, 2, 3, 4].map((n) => set(`q${i}${n}`, `q${i}`, 5, 100 + i * 5)),
    ]),
    ...[1, 2, 3, 4].map((n) => set(`f${n}`, 'fc', null, null, { status: 'planned', targetReps: 10, targetWeight: 40 })),
  ];
  return { exercises, sessions, sessionExercises, sets };
}

test('targetStatus: in the band, over it, on track with what is planned, or short', () => {
  assert.equal(targetStatus(12, 0), 'inRange');
  assert.equal(targetStatus(22, 0), 'above');
  assert.equal(targetStatus(4, 6), 'onTrack');
  assert.equal(targetStatus(4, 2), 'below');
});

test('focus from the training: the muscles and lifts done most', () => {
  const { focus } = liftOverview(buildModel(data()), 'kg', '2026-10-21');
  assert.equal(focus.source, 'training');
  // Biceps (12 done + 4 planned), glutes and quads (16 done each) tie at 16; ties go by name.
  assert.deepEqual(focus.muscles.slice(0, 3), ['biceps', 'glutes', 'quads']);
  assert.deepEqual(focus.lifts.map((l) => l.name).sort(), ['Back squat', 'EZ-bar curl']);
});

test('targeting: done this week, still planned, and the sessions that hit each muscle', () => {
  const { focus } = liftOverview(buildModel(data()), 'kg', '2026-10-21');
  const biceps = focus.targeting.find((t) => t.muscle === 'biceps');
  assert.equal(biceps.done, 3);
  assert.equal(biceps.planned, 4);
  assert.equal(biceps.status, 'below');
  assert.deepEqual(biceps.sessions.map((s) => [s.day, s.title, s.sets, s.done]), [['2026-10-19', 'Heavy', 3, true], ['2026-10-23', 'Arms', 4, false]]);
  const quads = focus.targeting.find((t) => t.muscle === 'quads');
  assert.deepEqual([quads.done, quads.planned, quads.sessions.length], [4, 0, 1]);
});

test('progress: each focus lift over eight weeks', () => {
  const { focus } = liftOverview(buildModel(data()), 'kg', '2026-10-21');
  const squat = focus.progress.find((p) => p.name === 'Back squat');
  assert.equal(squat.points.length, 4);
  assert.ok(squat.change > 0.1);
  assert.equal(squat.since, '2026-09-28');
});

test('a focus set in Coach Settings wins', () => {
  const { focus } = liftOverview(buildModel(data()), 'kg', '2026-10-21', { focus: { muscles: ['biceps'], lifts: [`id-${CURL.toLowerCase()}`] } });
  assert.equal(focus.source, 'settings');
  assert.deepEqual(focus.muscles, ['biceps']);
  assert.deepEqual(focus.lifts.map((l) => l.name), ['EZ-bar curl']);
});

test('no sessions: an empty focus, no errors', () => {
  const { focus } = liftOverview(buildModel({ exercises: [], sessions: [], sessionExercises: [], sets: [] }), 'kg', '2026-10-21');
  assert.deepEqual([focus.muscles, focus.lifts, focus.targeting, focus.progress], [[], [], [], []]);
});
