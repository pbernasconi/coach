import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  daysAgoText, loadTiles, rampTiles, recoveryRows, decimalText, delta, e1rmText, goalView, headerChips, hoursSeries, hoursText, last4Tiles, liftChangeText,
  longDate, minutesText, muscleRows, paceText, peakText, performanceTiles, projectionCaption, rampCell, readinessBand,
  setsText, signed, sportDetail, staleText, todayDone, todayItemText, todayWorkouts, todayUnplanned, chipTitle, weekRow, weightChange,
} from './display.mjs';

const week = (over) => ({ week: '2026-10-12', hours: 5.5, runKm: 20, runMin: 110, rideKm: 60, rideHours: 2.25, strength: 2, tss: 310.4, planned: 8, done: 6, sports: {}, ...over });

test('number and date text', () => {
  assert.equal(hoursText(5.5), '5:30');
  assert.equal(hoursText(1.999), '2:00', 'never "1:60"');
  assert.equal(minutesText(425), '7:05');
  assert.equal(signed(4.6), '+5');
  assert.equal(signed(-12.2), '-12');
  assert.equal(signed(-0.3), '0');
  assert.equal(paceText(110, 20), '5:30');
  assert.equal(paceText(10, 0), null);
  assert.equal(longDate('2026-10-20'), 'Tuesday, October 20');
  assert.equal(setsText(7.25), '7.5');
  assert.equal(setsText(12), '12');
  assert.equal(decimalText(3.375), '3.4');
  assert.equal(daysAgoText(0), 'Today');
  assert.equal(daysAgoText(1), 'Yesterday');
  assert.equal(daysAgoText(9), '9 days ago');
  assert.equal(liftChangeText(0.052), '+5%');
  assert.equal(liftChangeText(-0.02), '-2%');
  assert.equal(liftChangeText(null), '');
  assert.equal(e1rmText(101.6, 'kg'), '102 kg');
  assert.equal(e1rmText(null, 'kg'), '–');
});

test('header chips: tones and order, missing values left out', () => {
  const chips = headerChips(
    { readiness: { value: 48 }, sleepMin: { value: 452 }, sleepScore: { value: 82 }, hrvStatus: { value: 3 } },
    { ctl: 61.4, atl: 75.2, tsb: -13.8 }
  );
  assert.deepEqual(chips.map((c) => [c.key, c.valueText, c.tone]), [
    ['readiness', '48 · Low', 'warn'],
    ['sleep', '7:32', 'good'],
    ['hrv', 'Unbalanced', 'warn'],
    ['fitness', '61 / 75', 'neutral'],
    ['form', '-14', 'warn'],
  ]);
  assert.equal(readinessBand(96), 'Prime');
  assert.deepEqual(headerChips({ sleepMin: { value: 400 }, sleepScore: null }, null).map((c) => c.tone), ['neutral']);
  assert.deepEqual(headerChips(null, null), []);
  assert.equal(headerChips(null, { ctl: 1, atl: 1, tsb: -31 })[1].tone, 'bad');
});

test('stale banner, projection caption', () => {
  assert.equal(staleText('2026-10-10', '2026-10-20'), 'The newest Strava activity is from 2026-10-10.');
  assert.equal(staleText('2026-10-14', '2026-10-20'), null);
  assert.equal(staleText(null, '2026-10-20'), null);
  const days = [{ date: '2026-10-20', ctl: 60, atl: 70, tsb: -10, tss: 50, projected: false }, { date: '2026-11-01', ctl: 62.4, atl: 50, tsb: 4.6, tss: 0, projected: true }];
  assert.equal(projectionCaption({ days, plannedTss: 520, estimatedWorkouts: 1 }), 'Projection to Nov 1: 520 planned TSS, fitness 62, form +5. 1 planned workout has no TSS; estimated from duration and intensity.');
  assert.equal(projectionCaption({ days: days.slice(0, 1), plannedTss: 0, estimatedWorkouts: 0 }), null);
  const withPlan = [days[0], { date: '2026-10-25', ctl: 61, atl: 60, tsb: 1, tss: 90, projected: true }, days[1]];
  assert.equal(projectionCaption({ days: withPlan, plannedTss: 90, estimatedWorkouts: 0 }), 'Projection to Nov 1: 90 planned TSS, fitness 62, form +5. The plan ends Oct 25; rest after that.');
});

test('weeks: last-4 tiles, trend tiles, table rows', () => {
  const weeks = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => week({ week: `2026-08-${String(i * 3).padStart(2, '0')}`, hours: i })).concat(week({ week: '2026-10-19', hours: 1 }));
  const last4 = weeks.slice(4, 8);
  const tiles = last4Tiles(last4, 2);
  assert.deepEqual(tiles.map((t) => t.valueText), ['26:00 h', '80 km', '240 km', '8 of 8']);
  assert.equal(tiles[0].noteText, '6:30 h a week');
  assert.equal(tiles[1].noteText, '5:30 /km');
  assert.equal(last4Tiles([week({ runKm: 0 })], 2)[1].noteText, 'no runs');
  assert.deepEqual(delta(26, 10), { pct: 160, up: true, flat: false, text: '▲ 160%' });
  assert.deepEqual(delta(10.02, 10), { pct: 0, up: true, flat: true, text: '0%' });
  assert.equal(delta(5, 0), null);
  const perf = { weeks, load: Array.from({ length: 14 }, (_, i) => ({ date: `2026-10-${String(i + 6).padStart(2, '0')}`, ctl: 50 + i, atl: 60, tsb: -8 + i, tss: 40 })) };
  const t = performanceTiles(perf, '2026-10-19', 2);
  assert.deepEqual(t.map((x) => x.key), ['hours', 'run', 'ride', 'form']);
  assert.equal(t[0].valueText, '26:00 h');
  assert.equal(t[0].delta.text, '▲ 160%');
  assert.equal(t[0].spark.values.length, 9);
  assert.equal(t[1].foot, 'Pace 5:30/km');
  assert.equal(t[3].valueText, '+5');
  assert.equal(t[3].foot, 'Fresh · fitness 63 · strength 8/8');
  assert.deepEqual(t[3].spark.values, [56, 63]);
  assert.deepEqual(weekRow(week({ week: '2026-10-19', runKm: 0, strength: 0, planned: 0 }), '2026-10-19'), {
    week: '2026-10-19', current: true, label: 'Oct 19 (this week)', hoursText: '5:30', runKmText: '-', runPaceText: '-',
    rideKmText: '60', strengthText: '-', tssText: '310', planText: '-',
  });
});

test('hours series and the sport detail', () => {
  const sports = [{ id: 'ride', label: 'Ride' }, { id: 'run', label: 'Run' }, { id: 'hike', label: 'Hike' }, { id: 'rest', label: 'Rest' }];
  const weeks = [
    week({ week: '2026-10-12', sports: { ride: { hours: 3, km: 90, types: { Ride: 3 } }, run: { hours: 1, km: 10, types: { Run: 1 } } } }),
    week({ week: '2026-10-19', sports: { ride: { hours: 1, km: 30, types: { VirtualRide: 1 } } } }),
  ];
  const { series, total, average } = hoursSeries(weeks, '2026-10-19', sports);
  assert.deepEqual(series.map((s) => s.id), ['ride', 'run']);
  assert.equal(total(weeks[0]), 4);
  assert.equal(average, 4, 'the current week is not in the average');
  assert.equal(sportDetail(sports[0], { hours: 3, km: 90.4, types: { Ride: 2, 'Virtual ride': 1 } }), 'Ride, Virtual ride · 90 km');
  assert.equal(sportDetail(sports[1], { hours: 1, km: 10.04, types: { Run: 1 } }), 'Run · 10.0 km');
});

test('ramp cells and peak text', () => {
  assert.deepEqual(rampCell({ days: 28, from: 50, to: 60, change: 10, perWeek: 2.5 }, 1), {
    days: 28, label: '28 days', change: 10, changeText: '+10.0', perWeek: 2.5, perWeekText: '+2.5/wk', level: 'steady', levelText: 'Steady', warn: false,
  });
  assert.equal(rampCell({ days: 7, from: 50, to: 57, change: 7, perWeek: 7 }, 0).warn, true);
  assert.equal(rampCell(null, 3).label, '1 year');
  assert.equal(rampCell(null, 3).levelText, 'Not enough data');
  assert.deepEqual(peakText('power', 300, 301.6), { main: '302 W', sub: null });
  assert.deepEqual(peakText('run', 5000, 1500), { main: '25:00', sub: '5:00' });
});

test('lift and body text', () => {
  const rows = muscleRows(
    [{ muscle: 'chest', sets: 12 }, { muscle: 'biceps', sets: 4 }],
    [{ muscle: 'biceps', sets: 40 }, { muscle: 'quads', sets: 20 }]
  );
  assert.deepEqual(rows, [{ muscle: 'biceps', week: 4, avg: 10 }, { muscle: 'quads', week: 0, avg: 5 }, { muscle: 'chest', week: 12, avg: 0 }]);
  assert.deepEqual(weightChange(-1.24), { text: '▼ 1.2 kg', tone: 'good', perWeekText: '-0.31 kg a week' });
  assert.equal(weightChange(0.4).tone, 'bad');
  assert.equal(weightChange(null), null);
});

test('goals and the today line', () => {
  const g = { id: 'g1', kind: 'ride_km', title: 'Ride 5,000 km', target: 5000, baseline: 0, start: '2026-01-01', deadline: '2026-12-31', current: 4012.4, progress: 0.80248, status: 'behind', daysLeft: 72, detail: ['Needed: 96 km per week'] };
  const v = goalView(g);
  assert.equal(v.statusText, 'behind');
  assert.equal(v.currentText, '4,012 km');
  assert.equal(v.targetText, '5,000 km');
  assert.equal(v.timeText, '72 days left · 2026-12-31');
  assert.equal(v.progress, 0.8);
  assert.equal(goalView({ ...g, status: 'done' }).timeText, 'by 2026-12-31');
  assert.equal(goalView({ ...g, status: 'done' }).daysLeft, null);

  const w = (over) => ({ id: 'a', date: '2026-10-20', status: 'planned', state: 'today', startTime: '13:30', duration: 60, ...over });
  assert.deepEqual(todayWorkouts({ today: '2026-10-20', workouts: [w({}), w({ id: 'b', status: 'skipped' }), w({ id: 'c', date: '2026-10-21' })] }).items.map((x) => x.id), ['a']);
  assert.equal(todayWorkouts({ today: '2026-10-20', workouts: [w({ date: '2026-10-21' })] }).emptyText, 'Rest day');
  assert.equal(todayWorkouts({ today: '2026-10-20', workouts: [] }).emptyText, 'No plan this week. Plan one with Coach on the Plan page.');
  assert.equal(todayItemText(w({})), '13:30 · 1:00');
  assert.equal(todayItemText(w({ startTime: null, duration: 45, state: 'done' })), '45m · done');

  assert.equal(todayDone(w({})), null);
  const done = w({ state: 'done', duration: 60, tss: 40, compliance: { level: 'good', label: 'Done' }, actual: { min: 56, tss: 69, km: 10.24 }, match: { source: 'strava', id: '99', name: 'Lunch Run' } });
  assert.deepEqual(todayDone(done), { level: 'good', label: 'Done', doneText: '56m · 10.2 km · 69 TSS', plannedText: '1:00 · 40 TSS', href: '/activities/99', name: 'Lunch Run' });
  const lift = todayDone(w({ state: 'done', tss: null, duration: 60, compliance: { level: 'done', label: 'Done' }, actual: { min: null, tss: null }, match: { source: 'lift', id: 's1', name: 'Upper' } }), 25.4);
  assert.equal(lift.href, '/lift/sessions/s1');
  assert.equal(lift.doneText, null);
  assert.equal(lift.plannedText, '1:00 · 25 TSS');
});

test('fitness panel: load tiles, recovery rows and ramp tiles', () => {
  assert.equal(loadTiles(null), null);
  const t = loadTiles({ ctl: 69.6, atl: 52.6, tsb: 10.2 });
  assert.deepEqual(t.map((x) => x.valueText), ['53', '70', '+10']);
  assert.equal(t[2].zone, 'Fresh');
  assert.match(t[2].meaning, /^rested/);
  assert.equal(loadTiles({ ctl: 60, atl: 95, tsb: -35 })[2].zone, 'Overreaching');

  const rows = recoveryRows({ readiness: { value: 56 }, hrvStatus: { value: 4 }, sleepMin: { value: 425 }, sleepScore: { value: 82 } });
  assert.deepEqual(rows.map((r) => [r.key, r.valueText, r.tone]), [
    ['readiness', '56 · Moderate', 'good'],
    ['hrv', 'Balanced', 'good'],
    ['sleep', '7:05 · 82', 'good'],
  ]);
  assert.equal(rows[0].note, "Garmin's 0–100 score for training today.");
  assert.deepEqual(recoveryRows({ hrvStatus: { value: 0 } }), []);
  assert.deepEqual(recoveryRows(null), []);

  const r = rampTiles([{ days: 7, from: 76, to: 70, change: -6.2, perWeek: -6.2 }, null, null, { days: 365, from: 88, to: 70, change: -18, perWeek: -0.3 }]);
  assert.deepEqual(r.map((x) => [x.title, x.changeText]), [['Last 7 days', '\u22126'], ['Last 28 days', '–'], ['Last 90 days', '–'], ['Last 365 days', '\u221218']]);
});

test('today unplanned and chip titles', () => {
  const a = { id: '7', sport: 'run', name: 'Easy run', km: 9.14, min: 48, tss: 33.4 };
  assert.deepEqual(todayUnplanned([{ kind: 'planned', key: 'w-1', w: {}, actual: null }, { kind: 'activity', key: 'a-7', a }]), [
    { key: 'a-7', sport: 'run', name: 'Easy run', text: '48m · 9.1 km · 33 TSS', href: '/activities/7' },
  ]);
  assert.deepEqual(todayUnplanned([{ kind: 'lift', key: 'l-s', l: { id: 's', name: 'Upper A', setsLogged: 18 }, a: null }])[0].text, '18 sets');
  const plain = (t) => t;
  assert.equal(chipTitle({ kind: 'planned', w: { title: 'VO2 run 5x3', duration: 55, tss: 52 }, actual: null }, plain), 'VO2 run 5x3 · Planned 55m · 52 TSS');
  assert.equal(chipTitle({ kind: 'planned', w: { title: 'VO2 run', duration: 55 }, actual: a }, plain), 'VO2 run · Done 48m · 9.1 km · 33 TSS');
  assert.equal(chipTitle({ kind: 'activity', a }, plain), 'Easy run · 48m · 9.1 km · 33 TSS');
});
