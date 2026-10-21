import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyTargets, stepLength, stepLines, stepTarget, stepZone } from './steps.mjs';

const power = (low, high) => ({ type: 'power', unit: 'pct_ftp', low, high });
const ride = {
  version: 1,
  sport: 'ride',
  name: 'Threshold',
  steps: [
    { kind: 'warmup', duration: { type: 'time', s: 600 }, target: power(56, 75), notes: 'Easy' },
    { kind: 'repeat', count: 6, steps: [
      { kind: 'work', duration: { type: 'time', s: 300 }, target: power(96, 104) },
      { kind: 'recovery', duration: { type: 'time', s: 180 }, target: power(45, 55) },
    ] },
    { kind: 'work', duration: { type: 'time', s: 1200 }, target: power(76, 90), notes: 'steady', cadence: [85, 95] },
    { kind: 'cooldown', duration: { type: 'lap' }, target: { type: 'open' } },
  ],
};

test('step lengths, targets and zones as the web shows them', () => {
  assert.equal(stepLength({ duration: { type: 'time', s: 300 } }), '5:00');
  assert.equal(stepLength({ duration: { type: 'distance', m: 5000 } }), '5 km');
  assert.equal(stepLength({ duration: { type: 'distance', m: 400 } }), '400 m');
  assert.equal(stepLength({ duration: { type: 'lap' } }), 'Lap button');
  assert.equal(stepTarget({ kind: 'work', target: power(96, 104) }), '254–276 W');
  assert.equal(stepTarget({ kind: 'work', target: power(50, 75), ramp: true, cadence: [85, 95] }), 'Ramp 133–199 W · 85–95 rpm');
  assert.equal(stepTarget({ kind: 'work', target: { type: 'open' } }), 'All out');
  assert.equal(stepTarget({ kind: 'cooldown', target: { type: 'open' } }), 'Easy');
  assert.equal(stepZone({ kind: 'work', target: power(96, 104) }, 'ride'), 'Z4');
  assert.equal(stepZone({ kind: 'work', target: { type: 'open' } }, 'ride'), 'Z5');
});

test('key targets: one line per repeat or work step', () => {
  assert.deepEqual(keyTargets(ride), [
    { text: '6 × 5:00 at 254–276 W, 3:00 easy', zone: 'Z4' },
    { text: '20:00 at 201–239 W · steady', zone: 'Z3' },
  ]);
  assert.deepEqual(keyTargets({ sport: 'run', steps: [] }), []);
});

test('step lines: a label and a detail per top-level step', () => {
  assert.deepEqual(stepLines(ride), [
    { label: 'Warm-up', detail: '10:00 · 148–199 W · Easy' },
    { label: '6 ×', detail: '5:00 Work 254–276 W, 3:00 Recovery 119–146 W' },
    { label: 'Work', detail: '20:00 · 201–239 W · 85–95 rpm · steady' },
    { label: 'Cool-down', detail: 'Lap button · Easy' },
  ]);
});
