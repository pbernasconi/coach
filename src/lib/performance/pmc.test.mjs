import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimatePlannedTss, plannedIntensityFactor, projectLoad, projectionEnd, rampLevel, rampRates } from './pmc.mjs';

test('planned TSS: the stored TSS wins', () => {
  assert.deepEqual(estimatePlannedTss({ tss: 80, duration: 60, sport: 'run' }), { tss: 80, method: 'planned' });
  assert.deepEqual(estimatePlannedTss({ tss: 0, duration: 0, sport: 'rest' }), { tss: 0, method: 'planned' });
});

test('planned TSS: estimate from duration and intensity', () => {
  // 60 min threshold ride: 1 h × 0.88² × 100 = 77.4
  assert.deepEqual(estimatePlannedTss({ duration: 60, sport: 'ride', workoutType: 'ride-threshold' }), { tss: 77.4, method: 'estimated' });
  // 90 min easy run: 1.5 × 0.72² × 100 = 77.8
  assert.equal(estimatePlannedTss({ duration: 90, sport: 'run', title: 'Long run' }).tss, 77.8);
  assert.equal(estimatePlannedTss({ duration: 45, sport: 'run', intensity: 'Z1 recovery' }).tss, 22.7);
});

test('planned TSS: skipped, rest and no duration are 0', () => {
  assert.equal(estimatePlannedTss({ tss: 90, status: 'skipped' }).tss, 0);
  assert.equal(estimatePlannedTss({ duration: 60, sport: 'rest' }).method, 'none');
  assert.equal(estimatePlannedTss({ sport: 'ride' }).tss, 0);
  assert.equal(estimatePlannedTss({ tss: null, duration: null, sport: 'run' }).tss, 0);
});

test('intensity factor ordering', () => {
  const f = (t) => plannedIntensityFactor({ sport: 'ride', title: t });
  assert.ok(f('Recovery spin') < f('Endurance') && f('Endurance') < f('Tempo') && f('Tempo') < f('Threshold 2x20'));
  assert.equal(plannedIntensityFactor({ sport: 'strength', title: 'Heavy barbell' }), 0.6);
});

const hist = [
  { date: '2026-10-17', ctl: 50, atl: 60, tsb: -10, tss: 100 },
  { date: '2026-10-18', ctl: 49, atl: 52, tsb: -3, tss: 0 },
];

test('projection continues the EWMA with planned TSS and marks projected days', () => {
  const out = projectLoad(hist, [{ date: '2026-10-19', tss: 84 }, { date: '2026-10-20', tss: 42 }, { date: '2026-10-20', tss: 0 }], {
    today: '2026-10-19', until: '2026-10-21',
  });
  assert.deepEqual(out.map((d) => d.projected), [false, false, true, true, true]);
  const [, , d19, d20, d21] = out;
  assert.equal(d19.ctl, 49.8); // 49 + (84 - 49) / 42 = 49.83
  assert.equal(d19.atl, 56.6); // 52 + (84 - 52) / 7 = 56.57
  assert.equal(d19.tsb, -6.7);
  assert.equal(d20.tss, 42);
  assert.equal(d21.tss, 0);
  assert.ok(d21.atl < d20.atl);
});

test('today with actual TSS stays actual; history after today is replaced', () => {
  const h = [...hist, { date: '2026-10-19', ctl: 50, atl: 58, tsb: -8, tss: 90 }, { date: '2026-10-20', ctl: 48.8, atl: 49.7, tsb: -0.9, tss: 0 }];
  const out = projectLoad(h, [{ date: '2026-10-19', tss: 70 }, { date: '2026-10-20', tss: 70 }], { today: '2026-10-19', until: '2026-10-20' });
  assert.equal(out.length, 4);
  assert.equal(out[2].projected, false);
  assert.equal(out[2].tss, 90);
  assert.equal(out[3].projected, true);
  assert.equal(out[3].tss, 70);
});

test('today with no TSS yet and a planned workout is projected', () => {
  const h = [...hist, { date: '2026-10-19', ctl: 47.8, atl: 44.6, tsb: 3.2, tss: 0 }];
  const out = projectLoad(h, [{ date: '2026-10-19', tss: 60 }], { today: '2026-10-19', until: '2026-10-19' });
  assert.equal(out.at(-1).projected, true);
  assert.equal(out.at(-1).tss, 60);
});

test('a gap before today fills with zero days and empty history starts at 0', () => {
  const out = projectLoad(hist, [], { today: '2026-10-21', until: '2026-10-21' });
  assert.deepEqual(out.map((d) => [d.date, d.projected]), [
    ['2026-10-17', false], ['2026-10-18', false], ['2026-10-19', false], ['2026-10-20', false], ['2026-10-21', true],
  ]);
  const empty = projectLoad([], [{ date: '2026-10-19', tss: 42 }], { today: '2026-10-19', until: '2026-10-19' });
  assert.deepEqual(empty, [{ date: '2026-10-19', ctl: 1, atl: 6, tsb: -5, tss: 42, projected: true }]);
});

test('projection end: plan or next event, within bounds', () => {
  assert.equal(projectionEnd('2026-10-19', ['2026-10-25']), '2026-11-02');
  assert.equal(projectionEnd('2026-10-19', ['2026-11-10'], ['2026-12-06']), '2026-12-06');
  assert.equal(projectionEnd('2026-10-19', [], ['2027-06-01']), '2026-11-02');
});

test('ramp rates over 7/28/90/365 days', () => {
  const load = [];
  for (let i = 0; i <= 100; i++) {
    load.push({ date: new Date(Date.UTC(2026, 6, 11) + i * 864e5).toISOString().slice(0, 10), ctl: 20 + i * 0.5 });
  }
  const [w7, w28, w90, w365] = rampRates(load);
  assert.deepEqual(w7, { days: 7, from: 66.5, to: 70, change: 3.5, perWeek: 3.5 });
  assert.equal(w28.change, 14);
  assert.equal(w28.perWeek, 3.5);
  assert.equal(w90.from, 25);
  assert.equal(w365, null);
});

test('ramp rates use the closest earlier row within 3 days, and asOf', () => {
  const load = [{ date: '2026-10-09', ctl: 40 }, { date: '2026-10-19', ctl: 47 }];
  assert.equal(rampRates(load, undefined, [5])[0], null);
  assert.equal(rampRates(load, undefined, [7])[0].from, 40);
  assert.equal(rampRates(load, undefined, [10])[0].change, 7);
  assert.equal(rampRates([{ date: '2026-10-07', ctl: 40 }, { date: '2026-10-19', ctl: 47 }], undefined, [9])[0].from, 40);
  assert.equal(rampRates(load, '2026-10-10', [1])[0], null);
  assert.deepEqual(rampRates([], undefined), [null, null, null, null]);
});

test('ramp level', () => {
  assert.equal(rampLevel(9), 'high');
  assert.equal(rampLevel(6), 'aggressive');
  assert.equal(rampLevel(0), 'steady');
  assert.equal(rampLevel(-4), 'falling');
});
