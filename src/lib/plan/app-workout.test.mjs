import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appWorkout, chartTicks, longDayText, stepTree, zoneTime } from './app-workout.mjs';

const sports = { known: new Set(['ride', 'run', 'strength', 'rest', 'other']), label: (id) => id[0].toUpperCase() + id.slice(1) };
const ride = {
  version: 1, sport: 'ride', name: 'T', steps: [
    { kind: 'warmup', duration: { type: 'time', s: 600 }, target: { type: 'power', unit: 'pct_ftp', low: 55, high: 65 } },
    { kind: 'repeat', count: 3, steps: [
      { kind: 'work', duration: { type: 'time', s: 300 }, target: { type: 'power', unit: 'pct_ftp', low: 95, high: 100 } },
      { kind: 'recovery', duration: { type: 'time', s: 120 }, target: { type: 'open' } },
    ] },
  ],
};
const workout = (over = {}) => ({
  id: 'w1', date: '2026-10-21', startTime: '07:00', title: '🚴 Threshold A', sport: 'ride', duration: 90, tss: 95,
  description: 'Easy to the end.', steps: ride, state: 'today', match: null, actual: null, compliance: { level: 'today', label: 'Today' },
  adaptedFrom: null, intensity: null, liftSessionId: null, lift: null, ...over,
});

test('the page: title without the emoji, the day, hero numbers and the workout card', () => {
  const page = appWorkout(workout(), sports);
  assert.equal(page.title, 'Threshold A');
  assert.equal(page.subtitle, 'Ride · Wednesday, October 21 · 07:00');
  assert.equal(page.stateLabel, 'Today');
  assert.deepEqual(page.hero.map((h) => h.label), ['Planned time', 'Planned TSS', 'Planned IF']);
  assert.equal(page.hero[0].valueText, '1:30');
  assert.equal(page.notes, 'Easy to the end.');
  assert.equal(page.workout.profile.length, 7);
  assert.equal(page.workout.keyTargets[0].text.startsWith('3 × 5:00 at'), true);
  assert.equal(page.done, null);
});

test('a done workout adds what was done and the activity to open', () => {
  const page = appWorkout(
    workout({ state: 'done', match: { source: 'strava', id: 77, name: 'Morning Ride' }, actual: { min: 92, tss: 99 }, compliance: { level: 'good', label: 'Done' } }),
    sports
  );
  assert.deepEqual(page.hero.slice(-2).map((h) => [h.label, h.valueText]), [['Done time', '1:32'], ['Done TSS', '99']]);
  assert.deepEqual(page.done, { activityId: '77', name: 'Morning Ride' });
  assert.equal(page.compliance, 'good');
});

test('without steps there is no workout card', () => {
  assert.equal(appWorkout(workout({ steps: null, sport: 'strength' }), sports).workout, null);
});

test('steps as a tree, zone time and chart ticks', () => {
  const tree = stepTree(ride.steps, 'ride');
  assert.equal(tree[0].label, 'Warm-up');
  assert.equal(tree[0].length, '10:00');
  assert.equal(tree[1].kind, 'repeat');
  assert.equal(tree[1].label, '3 ×');
  assert.equal(tree[1].steps[1].target, 'Easy');
  const zones = zoneTime(ride);
  assert.equal(zones.basis, 'by power');
  assert.equal(zones.items.reduce((a, z) => a + z.seconds, 0), 600 + 3 * 420);
  assert.equal(zones.items.reduce((a, z) => a + z.percent, 0) >= 99, true);
  assert.deepEqual(chartTicks(1860).map((t) => t.text), ['0', '15', '30']);
  assert.equal(longDayText('2026-10-21'), 'Wednesday, October 21');
});

test('each bar says what a tap shows, and which step row it belongs to', () => {
  const bars = appWorkout(workout(), sports).workout.profile;
  assert.equal(bars[0].stepId, '0');
  assert.equal(bars[0].title, 'Warm-up');
  assert.equal(bars[0].timeText, '0:00 → 10:00');
  assert.equal(bars[0].percentText, '55–65% FTP');
  assert.equal(bars[3].stepId, '1.0');
  assert.equal(bars[3].title, 'Work · 2 of 3');
  assert.equal(bars[3].timeText, '17:00 → 22:00');
  assert.equal(bars[4].percentText, null, 'an open target has no %');
});

test('steps carry their cue apart from their label; key targets leave the cue out', () => {
  const withCue = { ...ride, steps: [{ ...ride.steps[0], notes: 'Easy, building.' }, ride.steps[1], { kind: 'work', duration: { type: 'time', s: 900 }, target: { type: 'power', unit: 'pct_ftp', low: 70, high: 75 }, notes: 'Steady.' }] };
  const page = appWorkout(workout({ steps: withCue }), sports);
  assert.deepEqual([page.workout.steps[0].label, page.workout.steps[0].cue, page.workout.steps[0].id], ['Warm-up', 'Easy, building.', '0']);
  assert.equal(page.workout.steps[1].steps[0].id, '1.0');
  assert.ok(page.workout.keyTargets.every((l) => !l.text.includes('Steady.')));
});

test('time in zones names each zone and gives its range, as Strava', () => {
  const zones = zoneTime(ride);
  assert.deepEqual(zones.items.map((z) => z.name), ['Recovery', 'Endurance', 'Tempo', 'Threshold', 'VO2 max']);
  assert.equal(zones.items[0].rangeText, '< 148 W');
  assert.equal(zones.items[1].rangeText, '148–200 W');
  assert.equal(zones.items[4].rangeText, '> 284 W');
  assert.ok(zones.items.some((z) => z.timeText.endsWith('min')));
  assert.ok(zones.items.filter((z) => z.seconds === 0).every((z) => z.timeText === ''));
});

test('a strength workout lists the exercises in its text, until a Lift session is linked', () => {
  const text = '1) Standing calf raise 3x15: slow.\n90 s rest.';
  const page = appWorkout(workout({ steps: null, sport: 'strength', description: text }), sports);
  assert.deepEqual(page.exercises, [{ name: 'Standing calf raise', sets: 3, reps: 15, repsMax: null, note: 'Slow.' }]);
  assert.equal(page.notes, '90 s rest.');
  const linked = appWorkout(workout({ steps: null, sport: 'strength', description: text, liftSessionId: 'abc' }), sports);
  assert.deepEqual(linked.exercises, []);
  assert.deepEqual(appWorkout(workout(), sports).exercises, []);
});

test('a gym lift lists what Lift planned, with or without its session, and the template before Lift plans it', () => {
  const description = 'Squat first.\n\n— Lift session (log each set in Lift) —\nTemplate: Heavy barbell\n- Back squat 3 × 5 @ 255 lb';
  const squat = [{ name: 'Back squat', sets: 3, reps: 5, repsMax: null, note: '255 lb' }];
  const lift = (over) => appWorkout(workout({ steps: null, sport: 'strength', description, ...over }), sports);
  assert.deepEqual(lift({}).exercises, squat);
  assert.equal(lift({}).notes, 'Squat first.');
  assert.deepEqual(lift({ liftSessionId: 'abc' }).exercises, squat);
  assert.deepEqual(lift({ state: 'done' }).exercises, []);
  const template = [{ name: 'Deadlift', sets: 3, reps: 5, repsMax: null, note: '275 lb' }];
  const fresh = lift({ description: 'Squat first.', templateExercises: template });
  assert.deepEqual(fresh.exercises, template);
  assert.equal(fresh.notes, 'Squat first.');
});
