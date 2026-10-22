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
