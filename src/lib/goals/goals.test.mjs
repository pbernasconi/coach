import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanGoals, describe, formatValue, judge, parseValue } from './goals.mjs';

const g = (kind, target, baseline, start = '2027-01-01', deadline = '2027-12-31') => ({ id: kind, kind, target, baseline, start, deadline });

test('pace text and values', () => {
  assert.equal(parseValue('run_10k_pace', '4:00'), 240);
  assert.ok(Number.isNaN(parseValue('run_10k_pace', '4:75')));
  assert.equal(formatValue('run_10k_pace', 277.4), '4:37/km');
  assert.equal(parseValue('ride_km', '6,000'), 6000);
  assert.equal(describe(g('ski_4000m', 3, 0)), 'Ski 3 × 4000 m peaks');
});

test('race time text and values', () => {
  assert.equal(parseValue('run_half_time', '1:45:00'), 6300);
  assert.equal(parseValue('run_marathon_time', '3:30'), 12600);
  assert.ok(Number.isNaN(parseValue('run_half_time', '1:75:00')));
  assert.equal(formatValue('run_marathon_time', 12599.6), '3:30:00');
  assert.equal(describe(g('run_half_time', 5940, 6513)), 'Half marathon in 1:39:00');
  const m = g('run_marathon_time', 12600, 14578, '2026-11-10', '2027-12-05');
  assert.equal(judge(m, 12500, '2027-12-05').status, 'done');
  assert.equal(judge(m, null, '2027-01-01').progress, 0);
});

test('a lower pace counts as progress, and the target pace is done', () => {
  const run = g('run_10k_pace', 240, 277, '2026-10-19', '2027-06-01');
  const half = judge(run, 258.5, '2027-01-01');
  assert.equal(half.status, 'open');
  assert.ok(Math.abs(half.progress - 0.5) < 0.01);
  assert.equal(judge(run, 239, '2027-01-01').status, 'done');
  assert.equal(judge(run, 250, '2027-06-02').status, 'missed');
  assert.equal(judge(run, 290, '2027-01-01').progress, 0);
});

test('ride km is on track or behind against an even rate', () => {
  const ride = g('ride_km', 6000, 0);
  assert.equal(judge(ride, 0, '2026-12-01').status, 'not_started');
  // 2027-07-02 is about half of the year.
  assert.equal(judge(ride, 3000, '2027-07-02').status, 'on_track');
  assert.equal(judge(ride, 2000, '2027-07-02').status, 'behind');
  assert.equal(judge(ride, 6000, '2027-07-02').status, 'done');
});

test('ski peaks have no even rate', () => {
  const ski = g('ski_4000m', 3, 0, '2026-11-01', '2027-06-30');
  assert.equal(judge(ski, 0, '2027-02-01').status, 'open');
  assert.equal(judge(ski, 3, '2027-05-01').status, 'done');
});

test('cleanGoals drops goals that are not valid', () => {
  const ok = g('vo2max', 52, 51, '2026-10-19', '2027-06-01');
  const out = cleanGoals([
    ok,
    { ...ok, kind: 'marathon' },
    { ...ok, target: 0 },
    { ...ok, deadline: '2026-01-01' },
    { ...ok, start: 'soon' },
    null,
  ]);
  assert.deepEqual(out, [ok]);
  assert.deepEqual(cleanGoals('x'), []);
});
