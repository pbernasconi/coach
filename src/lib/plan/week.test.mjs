import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptForFeel, addDays, isHard, matchActivityId, matchWeek, mondayOf, sportOf, sportOfStrava, undoAdapts } from './week.mjs';

const MON = '2026-10-19';
const day = (n) => addDays(MON, n);
const w = (id, n, title, extra = {}) => ({ id, date: day(n), title, status: 'planned', adaptedFrom: null, ...extra });

function week() {
  return [
    w('vo2', 0, 'VO2 A bike intervals', { workoutType: 'vo2-bike', intensity: 'hard', duration: 75, tss: 90 }),
    w('lift', 0, 'Heavy barbell lift', { workoutType: 'strength-heavy', intensity: 'strength', duration: 60 }),
    w('easyTue', 1, 'Easy run', { workoutType: 'aerobic-run', intensity: 'easy', duration: 45 }),
    w('thr', 2, 'Threshold B run', { workoutType: 'threshold-run', intensity: 'hard', duration: 60 }),
    w('easyThu', 3, 'Easy ride', { workoutType: 'aerobic-ride', intensity: 'easy', duration: 60 }),
    w('easyFri', 4, 'Easy run', { workoutType: 'aerobic-run', intensity: 'easy', duration: 40 }),
    w('long', 5, 'Long ride', { workoutType: 'long-ride', intensity: 'easy', duration: 240 }),
    w('longRun', 6, 'Long run', { workoutType: 'long-run', intensity: 'easy', duration: 100 }),
  ];
}

function apply(ws, updates) {
  const byId = new Map(ws.map((x) => [x.id, { ...x }]));
  for (const u of updates) Object.assign(byId.get(u.id), u.changes);
  return [...byId.values()];
}

test('dates: Monday of a week and adding days', () => {
  assert.equal(mondayOf('2026-10-25'), MON); // Sunday
  assert.equal(mondayOf(MON), MON);
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});

test('sport and quality detection', () => {
  assert.equal(sportOf({ title: '🏋️ Heavy barbell lift', workoutType: 'strength-heavy' }), 'strength');
  assert.equal(sportOf({ title: 'VO2 A', workoutType: 'vo2-bike' }), 'ride');
  assert.equal(sportOf({ title: 'Easy run + strides' }), 'run');
  assert.equal(sportOf({ title: 'Rest day' }), 'rest');
  assert.equal(sportOf({ title: 'Easy hike' }), 'hike');
  assert.equal(sportOf({ title: 'Recovery walk' }), 'walk');
  assert.equal(sportOfStrava('Hike'), 'hike');
  assert.equal(sportOfStrava('Walk'), 'walk');
  assert.equal(sportOfStrava('VirtualRide'), 'ride');
  assert.equal(sportOfStrava('TrailRun'), 'run');
  assert.equal(sportOfStrava('WeightTraining'), 'strength');
  assert.equal(sportOfStrava('Rowing'), 'other');
  assert.ok(isHard({ title: 'Threshold B run' }));
  assert.ok(!isHard({ title: 'Long ride', intensity: 'easy' }));
});

test('matchWeek: Strava by sport and day, Lift for strength, missed and today', () => {
  const ws = week();
  const result = matchWeek(
    ws,
    [{ id: 's1', date: day(0), sport: 'ride', name: 'Morning Ride' }, { id: 's2', date: day(1), sport: 'ride', name: 'Spin' }],
    [{ id: 'l1', date: day(0), name: 'Heavy' }],
    day(2)
  );
  assert.equal(result.get('vo2').status, 'done');
  assert.equal(result.get('vo2').match.id, 's1');
  assert.equal(result.get('lift').match.source, 'lift');
  assert.equal(result.get('easyTue').status, 'done'); // the ride stands in for the run: a swap
  assert.equal(result.get('easyTue').match.swapped, true);
  assert.equal(result.get('thr').status, 'today');
  assert.equal(result.get('long').status, 'planned');
});

test('matchWeek: a run instead of the spin and the lift counts for the spin only (Mon Oct 26)', () => {
  const ws = [
    w('spin', 0, 'Recovery spin — Zwift', { workoutType: 'recovery-ride', intensity: 'easy', duration: 45, tss: 35 }),
    w('heavy', 0, 'Heavy barbell lift', { workoutType: 'strength-heavy', intensity: 'strength', duration: 75 }),
  ];
  const result = matchWeek(ws, [{ id: 'r1', date: day(0), sport: 'run', name: 'Afternoon Run' }], [], day(1));
  assert.deepEqual(result.get('spin'), {
    status: 'done',
    match: { source: 'strava', id: 'r1', name: 'Afternoon Run', swapped: true, sport: 'run' },
  });
  assert.equal(result.get('heavy').status, 'missed'); // a run never counts as a lift
  assert.equal(matchActivityId(result.get('spin').match), 'r1');
});

test('matchWeek: same sport wins before a swap, and a swap needs an activity left over', () => {
  const ws = [
    w('ride', 0, 'Easy ride', { workoutType: 'aerobic-ride', intensity: 'easy', duration: 60 }),
    w('run', 0, 'Easy run', { workoutType: 'aerobic-run', intensity: 'easy', duration: 40 }),
    w('skip', 1, 'Easy ride', { workoutType: 'aerobic-ride', status: 'skipped' }),
  ];
  const acts = [
    { id: 'r1', date: day(0), sport: 'run', name: 'Run' },
    { id: 'r2', date: day(1), sport: 'run', name: 'Run' },
  ];
  const result = matchWeek(ws, acts, [], day(2));
  assert.equal(result.get('run').match.id, 'r1'); // the run is the run's, not the ride's (the ride comes first in order)
  assert.equal(result.get('run').match.swapped, undefined);
  assert.equal(result.get('ride').status, 'missed');
  assert.equal(result.get('skip').status, 'skipped'); // a skipped workout stays skipped
});

test('matchWeek: a Lift session with nothing logged is not a done lift', () => {
  const result = matchWeek(week(), [], [{ id: 'l1', date: day(0), name: 'Heavy', setsLogged: 0 }], day(2));
  assert.equal(result.get('lift').match, null);
  assert.equal(result.get('lift').status, 'missed');
});

test('matchWeek: a strength workout claims the Lift session and the watch activity of the same day', () => {
  const result = matchWeek(
    week(),
    [{ id: 'g1', date: day(0), sport: 'strength', name: 'Afternoon Weight Training' }],
    [{ id: 'l1', date: day(0), name: 'Heavy', setsLogged: 20 }],
    day(2)
  );
  const m = result.get('lift');
  assert.equal(m.status, 'done');
  assert.deepEqual(m.match, { source: 'lift', id: 'l1', name: 'Heavy', activityId: 'g1' });
  assert.equal(matchActivityId(m.match), 'g1');
});

test('matchWeek: a strength workout with only a watch activity matches it as before', () => {
  const result = matchWeek(week(), [{ id: 'g1', date: day(0), sport: 'strength', name: 'Weights' }], [], day(2));
  assert.deepEqual(result.get('lift').match, { source: 'strava', id: 'g1', name: 'Weights' });
  assert.equal(matchActivityId(result.get('lift').match), 'g1');
  assert.equal(matchActivityId(null), null);
});

test('matchWeek: two strength workouts on a day each get their own Lift session and activity', () => {
  const ws = [
    w('a', 0, 'Heavy barbell lift', { workoutType: 'strength-heavy', sortOrder: 0 }),
    w('b', 0, 'Upper (dumbbells)', { workoutType: 'strength-dumbbell', sortOrder: 1 }),
  ];
  const result = matchWeek(
    ws,
    [{ id: 'g1', date: day(0), sport: 'strength', name: 'W1' }, { id: 'g2', date: day(0), sport: 'strength', name: 'W2' }],
    [{ id: 'l1', date: day(0), name: 'Heavy' }, { id: 'l2', date: day(0), name: 'Upper' }],
    day(2)
  );
  assert.equal(result.get('a').match.activityId, 'g1');
  assert.equal(result.get('b').match.id, 'l2');
  assert.equal(result.get('b').match.activityId, 'g2');
});

test('tired on a quality day swaps it with a later easy day not next to another quality day', () => {
  const ws = week();
  const updates = adaptForFeel(ws, 'tired', day(2)); // Wednesday: threshold run
  const after = apply(ws, updates);
  const thr = after.find((x) => x.id === 'thr');
  // Thu is next to Wed (itself), so Fri is the first eligible day after tomorrow.
  assert.equal(thr.date, day(4));
  assert.equal(after.find((x) => x.id === 'easyFri').date, day(2));
  assert.equal(thr.adaptedFrom.date, day(2));
});

test('tired with no easy day left downgrades the quality session', () => {
  const ws = week();
  Object.assign(ws.find((x) => x.id === 'long'), { title: 'Threshold ride', intensity: 'hard', duration: 60 });
  const updates = adaptForFeel(ws, 'tired', day(5)); // Saturday: nothing later this week to swap with
  const long = apply(ws, updates).find((x) => x.id === 'long');
  assert.equal(long.intensity, 'easy');
  assert.equal(long.duration, 35);
  assert.equal(long.date, day(5));
  assert.match(long.title, /instead of Threshold ride/);
});

test('tired keeps a strength session but makes it lighter; done work is never changed', () => {
  const ws = week();
  const updates = adaptForFeel(ws, 'tired', MON, { done: new Set(['vo2']) });
  assert.ok(!updates.some((u) => u.id === 'vo2'));
  const lift = apply(ws, updates).find((x) => x.id === 'lift');
  assert.match(lift.title, /lighter/);
});

test('wrecked turns today into rest and adapts tomorrow', () => {
  const ws = week();
  const after = apply(ws, adaptForFeel(ws, 'wrecked', day(1)));
  assert.equal(after.find((x) => x.id === 'easyTue').intensity, 'rest');
  assert.notEqual(after.find((x) => x.id === 'thr').date, day(2));
});

test('fresh and undo restore the original fields, once', () => {
  const ws = week();
  const tired = apply(ws, adaptForFeel(ws, 'tired', day(2)));
  // A second adapt keeps the first snapshot.
  const again = apply(tired, adaptForFeel(tired, 'tired', day(2)));
  const restored = apply(again, adaptForFeel(again, 'fresh', day(2)));
  for (const orig of ws) {
    const r = restored.find((x) => x.id === orig.id);
    assert.equal(r.date, orig.date, orig.id);
    assert.equal(r.title, orig.title, orig.id);
    assert.equal(r.adaptedFrom, null);
  }
  assert.deepEqual(undoAdapts(ws, MON), []);
});

test('tired never swaps a quality session with a long session', () => {
  const ws = week().filter((x) => x.date >= day(4)); // Fri easy, Sat long ride, Sun long run
  Object.assign(ws[0], { title: 'VO2 run', intensity: 'hard' });
  const updates = adaptForFeel(ws, 'tired', day(3)); // Thursday; tomorrow is the VO2 run
  const vo2 = apply(ws, updates).find((x) => x.id === 'easyFri');
  assert.equal(vo2.date, day(4)); // nothing to swap with, so it gets easier in place
  assert.equal(vo2.intensity, 'easy');
});

test('ok changes nothing', () => {
  assert.deepEqual(adaptForFeel(week(), 'ok', MON), []);
});

test('matchWeek: a workout marked done by hand is done with no activity', () => {
  const ws = [w('calf', 0, 'Home calf raises', { workoutType: 'strength', intensity: 'strength', duration: 15, status: 'done' })];
  const r = matchWeek(ws, [], [], day(3)).get('calf');
  assert.deepEqual([r.status, r.match], ['done', null]);
});

test('matchWeek: a workout claims its own linked Lift session; another workout never takes it', () => {
  const ws = [
    w('upper', 0, 'Strength — Upper', { workoutType: 'strength', sortOrder: 0 }),
    w('calf', 0, 'Home calf raises', { workoutType: 'strength', sortOrder: 1, liftSessionId: 'CALF' }),
  ];
  const lifts = [{ id: 'calf', date: day(0), name: 'Home calf raises', setsLogged: 2 }, { id: 'up', date: day(0), name: 'Upper A', setsLogged: 18 }];
  const result = matchWeek(ws, [], lifts, day(2));
  assert.equal(result.get('upper').match.id, 'up');
  assert.equal(result.get('calf').match.id, 'calf');
  // With only the other session logged, the linked workout stays unmatched.
  const only = matchWeek(ws, [], [lifts[1]], day(2));
  assert.equal(only.get('upper').match.id, 'up');
  assert.equal(only.get('calf').match, null);
});

test('matchWeek: a fresh session goes to the workout with no session of its own, whatever the order', () => {
  const ws = [
    w('calf', 0, 'Home calf raises', { workoutType: 'strength', sortOrder: 0, liftSessionId: 'calf' }),
    w('upper', 0, 'Strength — Upper', { workoutType: 'strength', sortOrder: 1 }),
  ];
  const result = matchWeek(ws, [], [{ id: 'up', date: day(0), name: 'Upper A', setsLogged: 18 }], day(2));
  assert.equal(result.get('upper').match.id, 'up');
  assert.equal(result.get('calf').match, null);
});
