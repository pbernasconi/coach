import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liftSection, peaksSection, trendsResponse } from './trends-api.mjs';

const NOW = new Date('2026-10-20T20:30:00.000Z');
const SPORTS = [{ id: 'ride', label: 'Ride' }, { id: 'run', label: 'Run' }, { id: 'strength', label: 'Strength' }, { id: 'rest', label: 'Rest' }];
const ok = (value) => ({ ok: true, value });
const wk = (week, hours, sports = {}) => ({ week, hours, runKm: 10, runMin: 55, rideKm: 50, rideHours: 2, strength: 1, tss: 200, planned: 4, done: 3, sports });

const peaks = {
  windows: [{ key: 'all', label: 'All time' }, { key: 'd90', label: '90 days' }, { key: 'd28', label: '28 days' }],
  power: [{ span: 300, label: '5 min', cells: {
    all: { value: 320.4, date: '2025-06-01', activityId: '111', name: 'Climb' },
    d90: { value: 300, date: '2026-09-01', activityId: '222' },
    d28: null,
  } }],
  run: [{ span: 5000, label: '5 km', cells: { all: { value: 1500, date: '2026-10-01', activityId: '333', name: 'Tempo' }, d90: { value: 1500, date: '2026-10-01', activityId: '333', name: 'Tempo' }, d28: { value: 1500, date: '2026-10-01', activityId: '333', name: 'Tempo' } } }],
  scanned: 10,
  pending: 2,
};

test('the whole response', () => {
  const r = trendsResponse({
    now: NOW, timeZone: 'America/Los_Angeles', today: '2026-10-20', strengthTarget: 2, sports: SPORTS,
    perf: ok({
      weeks: [wk('2026-10-05', 4, { ride: { hours: 3, km: 80, types: { Ride: 3 } } }), wk('2026-10-12', 6, { ride: { hours: 4, km: 100, types: { Ride: 4 } }, run: { hours: 1, km: 10, types: { Run: 1 } } }), wk('2026-10-19', 1)],
      load: [{ date: '2026-10-20', ctl: 60, atl: 70, tsb: -10, tss: 50 }],
      latestActivity: '2026-10-19',
    }),
    pmc: ok({ ramp: [{ days: 7, from: 55, to: 60, change: 5, perWeek: 5 }, null, null, null] }),
    peaks: ok(peaks),
    lift: { ok: false },
  });
  assert.equal(r.performance.ok, true);
  assert.deepEqual(r.performance.tiles.map((t) => t.valueText), ['10:00 h', '20 km', '4:00 h', '\u221210']);
  assert.deepEqual(r.performance.tiles[0].delta, null, 'no weeks before: no delta');
  assert.equal(r.performance.tiles[0].footText, 'Moving time');
  assert.equal(r.performance.tiles[3].footText, 'Neutral · fitness 60 · strength 2/8');
  const h = r.performance.weeklyHours;
  assert.deepEqual(h.sports, [{ id: 'ride', label: 'Ride' }, { id: 'run', label: 'Run' }]);
  assert.equal(h.average, 4);
  assert.equal(h.averageText, 'avg 4:00');
  assert.deepEqual(h.weeks[1], {
    week: '2026-10-12', label: 'Oct 12', current: false, hours: 5, hoursText: '5:00',
    sports: [{ id: 'ride', hours: 4, hoursText: '4:00', detail: 'Ride · 100 km' }, { id: 'run', hours: 1, hoursText: '1:00', detail: 'Run · 10.0 km' }],
    strength: 1, tss: 200,
  });
  assert.equal(h.weeks[2].current, true);
  assert.deepEqual(r.performance.table.map((w) => w.label), ['Oct 19 (this week)', 'Oct 12', 'Oct 5']);
  assert.deepEqual(r.ramp.rates[0], { days: 7, label: '7 days', change: 5, changeText: '+5.0', perWeek: 5, perWeekText: '+5.0/wk', level: 'steady', levelText: 'Steady', warn: false });
  assert.equal(r.ramp.rates[3].levelText, 'Not enough data');
  assert.deepEqual(r.lift, { ok: false });
});

test('peaks: text, best flag, activity ids', () => {
  const p = peaksSection(peaks);
  assert.equal(p.note, 'From Strava streams. Elapsed time for runs, so stops count. 2 activities still to scan.');
  const power = p.power.rows[0].cells;
  assert.deepEqual(power.all, { value: 320, text: '320 W', subText: null, date: '2025-06-01', dateText: 'Jun 1, 2025', activityId: '111', name: 'Climb', best: true });
  assert.equal(power.d90.best, false);
  assert.equal(power.d90.name, null);
  assert.equal(power.d28, null);
  assert.equal(p.run.rows[0].cells.d28.text, '25:00');
  assert.equal(p.run.rows[0].cells.d28.subText, '5:00');
  assert.equal(p.run.rows[0].cells.d28.best, true);
  assert.equal(p.power.empty, false);
  assert.equal(peaksSection({ ...peaks, power: [{ span: 5, label: '5 s', cells: { all: null, d90: null, d28: null } }] }).power.empty, true);
});

test('lift: muscles against the band, main lifts, no data', () => {
  const l = liftSection({
    thisWeek: [{ muscle: 'upperBack', sets: 12 }], last4: [{ muscle: 'upperBack', sets: 30 }, { muscle: 'biceps', sets: 50 }],
    top: [], unit: 'lb', hasData: true,
  });
  assert.deepEqual(l.muscles.rows, [
    { muscle: 'biceps', label: 'Biceps', week: 0, weekText: '0', avg: 12.5, avgText: '12.5', status: 'below', statusText: 'below target' },
    { muscle: 'upperBack', label: 'Upper Back', week: 12, weekText: '12', avg: 7.5, avgText: '7.5', status: 'inRange', statusText: 'in target' },
  ]);
  assert.deepEqual(l.muscles.band, { min: 10, max: 20 });
  assert.equal(liftSection({ hasData: false }).emptyText, 'No Lift sessions on the server yet. Connect Lift on the iPhone.');
});
