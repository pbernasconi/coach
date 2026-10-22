import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exerciseResult, sessionPairing, setsLine, summaryGrid, targetLine, watchSection } from './session-result.mjs';

const target = (weight, reps) => ({ reps, repMin: null, repMax: null, weight });
const set = (status, weight, reps, t = target(weight, reps), kind = 'working') => ({ kind, status, weight, reps, target: t });
const history = (last, best = null, trend = []) => ({ last, best, trend });

test('setsLine writes a load once for each run', () => {
  assert.equal(setsLine([{ weight: 245, reps: 8 }, { weight: 245, reps: 8 }, { weight: 245, reps: 7 }], null, 'lb'), '245 lb × 8, 8, 7');
  assert.equal(setsLine([{ weight: 225, reps: 8 }, { weight: 245, reps: 6 }], null, 'lb'), '225 lb × 8 · 245 lb × 6');
  assert.equal(setsLine([{ weight: null, reps: 12 }], 'bodyweight', 'lb'), 'BW × 12');
});

test('targetLine folds equal sets', () => {
  assert.equal(targetLine([set('planned', 230, 5), set('planned', 230, 5), set('planned', 230, 5)], null, 'lb'), '3 × 5 · 230 lb');
  assert.equal(targetLine([set('planned', 230, 5), set('planned', 240, 3)], null, 'lb'), '230 lb × 5 · 240 lb × 3');
});

test('exerciseResult: a done lift against last time, with a record', () => {
  const r = exerciseResult(
    {
      loadMode: null,
      sets: [set('done', 135, 10, target(135, 10), 'warmUp'), set('done', 245, 8), set('done', 245, 8), set('done', 245, 7)],
      history: history({ day: '2026-09-25', sessionId: 's0', sets: [{ weight: 235, reps: 8 }] }, { day: '2026-09-25', e1rm: 297.7 }, [{ day: '2026-09-18', e1rm: 290 }, { day: '2026-09-25', e1rm: 297.7 }]),
    },
    'lb'
  );
  assert.equal(r.state, 'done');
  assert.equal(r.summaryText, '245 lb × 8, 8, 7');
  assert.equal(r.topSetText, '245 lb × 8');
  assert.equal(r.e1rmText, '310 lb');
  assert.deepEqual(r.change, { value: 12.7, text: '+13 lb', tone: 'up', caption: 'vs Sep 25' });
  assert.equal(r.record, true);
  assert.deepEqual(r.progress.values, [290, 297.7, 310.3]);
});

test('exerciseResult: the first time, skipped, planned and bodyweight', () => {
  const first = exerciseResult({ loadMode: null, sets: [set('done', 50, 10)], history: history(null) }, 'lb');
  assert.equal(first.change, null);
  assert.equal(first.record, false);
  assert.equal(first.progress, null);
  assert.equal(exerciseResult({ loadMode: null, sets: [set('skipped', 50, 10)], history: history(null) }, 'lb').summaryText, 'Skipped');
  assert.equal(exerciseResult({ loadMode: null, sets: [set('planned', 50, 10), set('planned', 50, 10)], history: history(null) }, 'lb').summaryText, '2 × 10 · 50 lb');
  const bw = exerciseResult({ loadMode: 'bodyweight', sets: [set('done', null, 12), set('done', null, 10)], history: history({ day: '2026-09-25', sessionId: 's0', sets: [{ weight: null, reps: 10 }] }) }, 'lb');
  assert.equal(bw.e1rm, null);
  assert.deepEqual(bw.change, { value: 2, text: '+2 reps', tone: 'up', caption: 'vs Sep 25' });
  const same = exerciseResult({ loadMode: null, sets: [set('done', 100, 5)], history: history({ day: '2026-09-25', sessionId: 's0', sets: [{ weight: 100, reps: 5 }] }) }, 'lb');
  assert.equal(same.change.tone, 'same');
  assert.equal(same.change.text, 'Same');
});

test('summaryGrid: with the watch, without it, and before the session', () => {
  const d = { minutes: 52, setsLogged: 17, setsTotal: 18, exercises: [1, 2, 3, 4, 5, 6] };
  const watch = { stats: [{ label: 'Avg Heart Rate', valueText: '112', unit: 'bpm' }, { label: 'Calories', valueText: '310' }, { label: 'Coach TSS', valueText: '38' }] };
  const results = [{ state: 'done', record: true }, { state: 'done', record: false }];
  assert.deepEqual(summaryGrid(d, results, watch, 'done').map((s) => `${s.label} ${s.valueText}`), ['Duration 52', 'Sets 17/18', 'Avg HR 112', 'Calories 310', 'TSS 38', 'Records 1']);
  assert.deepEqual(summaryGrid(d, results, null, 'done').map((s) => s.label), ['Duration', 'Sets', 'Exercises', 'Records']);
  assert.deepEqual(summaryGrid({ ...d, minutes: null }, results, { stats: [{ label: 'Moving Time', valueText: '1:04:30' }] }, 'done')[0], { label: 'Duration', valueText: '1:05', unit: 'h' });
  assert.deepEqual(summaryGrid(d, results, null, 'planned').map((s) => `${s.label} ${s.valueText}`), ['Exercises 6', 'Sets 18']);
});

test('watchSection takes the heart rate and zones from the activity body', () => {
  const body = {
    activityId: '123',
    header: { ok: true, activityId: '123', name: 'Strength', fetch: { pending: false, note: null } },
    overview: { ok: true, big: [{ label: 'Moving Time', valueText: '52:10' }, { label: 'Coach TSS', valueText: '38' }], small: [{ label: 'Avg Heart Rate', valueText: '112', unit: 'bpm' }, { label: 'Max Heart Rate', valueText: '158', unit: 'bpm' }] },
    equipment: { ok: true, device: 'Garmin fēnix 7S Pro', gear: null },
    analysis: { ok: true, x: { timeS: [0, 10], distanceKm: null }, streams: [{ key: 'hr', values: [90, 120], avgText: '112' }] },
    heartRate: { ok: true, zones: [{ zone: 1, percent: 100 }] },
  };
  const w = watchSection(body);
  assert.equal(w.activityId, '123');
  assert.equal(w.deviceText, 'Garmin fēnix 7S Pro');
  assert.deepEqual(w.stats.map((s) => s.label), ['Avg Heart Rate', 'Max Heart Rate', 'Coach TSS', 'Moving Time']);
  assert.deepEqual(w.heartRate, { timeS: [0, 10], values: [90, 120], avgText: '112', maxText: '158' });
  assert.equal(w.zones.length, 1);
  assert.equal(watchSection(null), null);
  assert.equal(watchSection({ ...body, analysis: { ok: true, x: null, streams: [] } }).heartRate, null);
});

test('sessionPairing: the planned workout and its watch, or the loose watch activity', () => {
  const act = (id, date, sport = 'strength') => ({ id, date, sport });
  const planned = { workouts: [{ id: 'p1', date: '2026-10-20', sortOrder: 0, startTime: null, match: { source: 'lift', id: 'ABC', activityId: '900' } }], activities: [act('900', '2026-10-20')], lifts: [{ id: 'abc', date: '2026-10-20' }] };
  assert.deepEqual(sessionPairing('abc', '2026-10-20', planned), { planned: planned.workouts[0], activityId: '900' });
  const loose = { workouts: [], activities: [act('800', '2026-10-21', 'run'), act('901', '2026-10-21')], lifts: [{ id: 'def', date: '2026-10-21' }] };
  assert.deepEqual(sessionPairing('DEF', '2026-10-21', loose), { planned: null, activityId: '901' });
  assert.deepEqual(sessionPairing('xyz', '2026-10-22', loose), { planned: null, activityId: null });
});
