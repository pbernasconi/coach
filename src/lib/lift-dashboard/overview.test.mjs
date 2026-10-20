import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel, weeklyVolume } from './stats.mjs';
import { liftOverview, personalRecords } from './overview.mjs';

const CURL = 'AAAAAAAA-0000-0000-0000-00000000000c';
const SQUAT = 'AAAAAAAA-0000-0000-0000-00000000000s';

function data() {
  const exercises = [
    { id: CURL, name: 'EZ-bar curl', primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'], deletedAt: null },
    { id: SQUAT, name: 'Back squat', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: [], deletedAt: null },
  ];
  const sessions = [
    { id: 's1', day: '2026-09-22', title: 'Upper', startedAt: '2026-09-22T17:00:00Z', finishedAt: '2026-09-22T17:50:00Z', deletedAt: null },
    { id: 's2', day: '2026-09-29', title: 'Upper', deletedAt: null },
    { id: 's3', day: '2026-10-21', title: 'Upper', deletedAt: null }, // today
    { id: 'plan', day: '2026-10-26', title: 'Next', deletedAt: null }, // planned ahead
  ];
  const sessionExercises = [
    { id: 'e1', sessionID: 's1', exerciseID: CURL, deletedAt: null },
    { id: 'e2', sessionID: 's2', exerciseID: CURL, deletedAt: null },
    { id: 'e3', sessionID: 's3', exerciseID: CURL, deletedAt: null },
    { id: 'e4', sessionID: 's3', exerciseID: SQUAT, deletedAt: null },
    { id: 'e5', sessionID: 'plan', exerciseID: SQUAT, deletedAt: null },
  ];
  const set = (id, se, reps, weight, extra = {}) => ({
    id, sessionExerciseID: se, actualReps: reps, actualWeight: weight, unit: 'kg', kind: 'working', status: 'done', deletedAt: null, ...extra,
  });
  const sets = [
    set('a', 'e1', 10, 30),
    set('b', 'e2', 10, 32.5, { targetRepMax: 10 }),
    // Done with no values logged: counts its target, as Lift does.
    set('c', 'e3', null, null, { targetReps: 10, targetWeight: 35, targetRepMax: 10 }),
    set('d', 'e4', 5, 100),
    set('p', 'e5', null, null, { status: 'planned', targetReps: 5, targetWeight: 105 }),
  ];
  return { exercises, sessions, sessionExercises, sets };
}

test('a done set without values counts its target (no 0-volume sessions)', () => {
  const m = buildModel(data());
  const c = m.sets.find((s) => s.id === 'c');
  assert.equal(c.reps, 10);
  assert.equal(c.weight, 35);
  assert.equal(m.sets.find((s) => s.id === 'p').weight, null); // a planned set stays empty
});

test('weeklyVolume leaves out a week that has only a planned session', () => {
  const weeks = weeklyVolume(buildModel(data()), 'kg');
  assert.equal(weeks[0].week, '2026-10-19');
  assert.equal(weeks[0].sessions, 1);
});

test('personalRecords: a session that beats every earlier one; the first is a baseline', () => {
  const prs = personalRecords(buildModel(data()), 'kg');
  assert.deepEqual(prs.map((r) => [r.day, r.name]), [['2026-10-21', 'EZ-bar curl'], ['2026-09-29', 'EZ-bar curl']]);
});

test('liftOverview: this week, gap, upcoming, muscles, tips', () => {
  const o = liftOverview(buildModel(data()), 'kg', '2026-10-21', { strengthTarget: 2, weightKg: 83.5 });
  assert.equal(o.thisWeek.week, '2026-10-19');
  assert.equal(o.thisWeek.sessions, 1);
  assert.equal(o.daysSince, 0);
  assert.deepEqual(o.upcoming.map((u) => u.id), ['plan']);
  assert.equal(o.sessions.length, 3);
  assert.equal(o.sessions[2].minutes, 50);
  assert.deepEqual(o.sessions[0].prs, ['EZ-bar curl']);
  assert.equal(o.weeks.length, 16);
  assert.equal(o.calendar.at(-1)[2].sessionId, 's3');
  assert.equal(o.calendar.at(-1)[3].future, true);
  assert.equal(o.muscles[0].muscle, 'biceps');
  assert.equal(o.muscles[0].week, 1);
  const ids = o.tips.map((t) => t.id);
  assert.ok(ids.includes('arms'));
  assert.ok(ids.includes('prs'));
  assert.ok(ids.includes('protein'));
  assert.ok(ids.includes('ready')); // 10 of 10 reps on the curl
  assert.ok(!ids.includes('gap'));
  assert.equal(o.tips.find((t) => t.id === 'protein').title, 'Protein: 150–185 g a day');
});

test('liftOverview: a long gap gets a gentle restart tip, and an empty model works', () => {
  const o = liftOverview(buildModel(data()), 'kg', '2026-10-20');
  assert.equal(o.daysSince, 21);
  assert.equal(o.tips[0].id, 'gap');
  const empty = liftOverview(buildModel({ exercises: [], sessions: [], sessionExercises: [], sets: [] }), 'kg', '2026-10-20');
  assert.equal(empty.last, null);
  assert.equal(empty.tips[0].id, 'none');
});
