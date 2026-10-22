import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bestByWindow, bestEfforts, countRequest, rollUsage, bestPower, extractPeaks, formatDuration, formatPace, msToNextWindow, peakSportOf,
  powerPerSecond, rateDecision, rateUsage, recentPeaks,
} from './peaks.mjs';

const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));

test('peak sport', () => {
  assert.equal(peakSportOf('Ride'), 'ride');
  assert.equal(peakSportOf('VirtualRide'), 'ride');
  assert.equal(peakSportOf('GravelRide'), 'ride');
  assert.equal(peakSportOf('EBikeRide'), null);
  assert.equal(peakSportOf('TrailRun'), 'run');
  assert.equal(peakSportOf('Swim'), null);
  assert.equal(peakSportOf(null), null);
});

test('power grid holds short gaps and zeros long pauses', () => {
  // Samples at 0, 1, 3 (2 s gap: held), 20 (17 s pause: one second only).
  const g = powerPerSecond([100, 200, 300, 400], [0, 1, 3, 20]);
  assert.equal(g.length, 21);
  assert.deepEqual([...g.slice(0, 4)], [100, 200, 300, 300]);
  assert.equal(g[10], 0);
  assert.equal(g[19], 0);
  assert.equal(g[20], 400);
});

test('power grid: nulls, negatives and spikes count as 0', () => {
  assert.deepEqual([...powerPerSecond([null, -5, 5000, 250], [0, 1, 2, 3])], [0, 0, 0, 250]);
  assert.equal(powerPerSecond([], []).length, 0);
});

test('best power over durations', () => {
  // 10 min at 200 W, 5 min at 300 W with a 5 s sprint at 900 W inside, 10 min at 150 W.
  const watts = [...range(600, () => 200), ...range(300, (i) => (i >= 100 && i < 105 ? 900 : 300)), ...range(600, () => 150)];
  const time = range(watts.length, (i) => i);
  const best = Object.fromEntries(bestPower(watts, time).map((p) => [p.durationS, p.watts]));
  assert.equal(best[5], 900);
  assert.equal(best[60], Math.round((55 * 300 + 5 * 900) / 60)); // 350
  assert.equal(best[300], Math.round((295 * 300 + 5 * 900) / 300)); // 310
  // The 20-min best starts at 0: 10 min at 200 W beats 10 min at 150 W.
  assert.equal(best[1200], (600 * 200 + 295 * 300 + 5 * 900 + 300 * 150) / 1200); // 215
  assert.equal(best[3600], undefined); // the ride is 25 min
});

test('best 20-min power exact', () => {
  // 30 min: 10 at 100 W, 20 at 250 W.
  const watts = [...range(600, () => 100), ...range(1200, () => 250)];
  const best = bestPower(watts, range(watts.length, (i) => i), [1200, 1800]);
  assert.deepEqual(best, [{ durationS: 1200, watts: 250 }, { durationS: 1800, watts: 200 }]);
});

test('best efforts: steady pace and a faster middle', () => {
  // 12 km at 5:00/km (3.333 m/s), 1 sample per second.
  const v = 1000 / 300;
  const t = range(3601, (i) => i);
  const d = t.map((s) => s * v);
  const steady = Object.fromEntries(bestEfforts(d, t).map((e) => [e.distanceM, e.seconds]));
  assert.equal(steady[1000], 300);
  assert.equal(steady[5000], 1500);
  assert.equal(steady[10000], 3000);
  assert.equal(steady[21097], undefined);

  // 3 km: 1 km at 5:00, 1 km at 4:00, 1 km at 5:00.
  const time = [];
  const dist = [];
  let s = 0;
  for (let m = 0; m <= 3000; m += 10) {
    dist.push(m);
    time.push(s);
    s += m >= 1000 && m < 2000 ? 2.4 : 3;
  }
  const fast = bestEfforts(dist, time, [{ span: 1000, meters: 1000 }]);
  assert.deepEqual(fast, [{ distanceM: 1000, seconds: 240 }]);
});

test('best efforts interpolate the start and include stops', () => {
  // Samples every 400 m; 1 km best needs interpolation. A 60 s stop at 800 m counts (elapsed time).
  const dist = [0, 400, 800, 800, 1200, 1600];
  const time = [0, 100, 200, 260, 360, 460];
  const [e] = bestEfforts(dist, time, [{ span: 1000, meters: 1000 }]);
  // Best: from 600 m (t=150) to 1600 m (t=460) = 310 s; vs 0→1200 interpolation (200→1200: t=50..360 = 310)
  assert.equal(e.seconds, 310);
});

test('best efforts reject GPS spikes', () => {
  const dist = [0, 500, 1500, 2000];
  const time = [0, 150, 160, 310]; // 1000 m in 10 s
  const [e] = bestEfforts(dist, time, [{ span: 1000, meters: 1000 }]);
  assert.ok(e.seconds >= 1000 / 7);
});

test('extract peaks by sport', () => {
  const time = range(400, (i) => i);
  const watts = range(400, () => 250);
  const distance = range(400, (i) => i * 3);
  assert.deepEqual(
    extractPeaks({ watts, time }, { sportType: 'Ride', deviceWatts: true }).map((p) => [p.metric, p.span, p.value]),
    [['power', 5, 250], ['power', 60, 250], ['power', 300, 250]],
  );
  assert.deepEqual(extractPeaks({ watts, time }, { sportType: 'Ride', deviceWatts: false }), []);
  assert.deepEqual(extractPeaks({ distance, time }, { sportType: 'Run' }), [{ metric: 'run', span: 1000, value: 333.3 }]);
  assert.deepEqual(extractPeaks({ distance, time }, { sportType: 'Swim' }), []);
  assert.deepEqual(extractPeaks({}, { sportType: 'Run' }), []);
});

test('best by window', () => {
  const rows = [
    { metric: 'power', span: 300, value: 320, date: '2026-03-01', activityId: 'a' },
    { metric: 'power', span: 300, value: 300, date: '2026-09-01', activityId: 'b' },
    { metric: 'power', span: 300, value: 290, date: '2026-10-10', activityId: 'c', name: 'Tue ride' },
    { metric: 'run', span: 5000, value: 1300, date: '2026-01-01', activityId: 'd' },
    { metric: 'run', span: 5000, value: 1350, date: '2026-10-19', activityId: 'e' },
    { metric: 'run', span: 5000, value: 1000, date: '2026-10-20', activityId: 'future' },
    { metric: 'power', span: 7, value: 999, date: '2026-10-10', activityId: 'x' },
  ];
  const b = bestByWindow(rows, '2026-10-19');
  assert.equal(b.power[300].all.activityId, 'a');
  assert.equal(b.power[300].d90.activityId, 'b');
  assert.deepEqual(b.power[300].d28, { value: 290, date: '2026-10-10', activityId: 'c', name: 'Tue ride' });
  assert.equal(b.run[5000].all.value, 1300);
  assert.equal(b.run[5000].d28.value, 1350);
  assert.equal(b.power[5].all, null);
  assert.equal(b.power[7], undefined);
});

test('28-day window includes the day 27 days ago, not 28', () => {
  const rows = [
    { metric: 'power', span: 5, value: 500, date: '2026-09-21', activityId: 'old' },
    { metric: 'power', span: 5, value: 400, date: '2026-09-22', activityId: 'in' },
  ];
  assert.equal(bestByWindow(rows, '2026-10-19').power[5].d28.activityId, 'in');
});

test('rate usage and decision', () => {
  const h = (o) => ({ get: (k) => o[k.toLowerCase()] ?? null });
  const u = rateUsage(h({ 'x-ratelimit-usage': '30,400', 'x-ratelimit-limit': '200,2000', 'x-readratelimit-usage': '91,900', 'x-readratelimit-limit': '100,1000' }));
  assert.deepEqual(u, { short: 91, shortLimit: 100, daily: 900, dailyLimit: 1000 });
  assert.equal(rateDecision(u), 'wait');
  assert.equal(rateDecision({ ...u, daily: 960 }), 'stop');
  assert.equal(rateDecision({ ...u, short: 20 }), 'go');
  assert.equal(rateUsage(h({})), null);
  assert.equal(rateDecision(null), 'go');
  assert.deepEqual(rateUsage(h({ 'x-ratelimit-usage': '1,2', 'x-ratelimit-limit': '100,1000' })), { short: 1, shortLimit: 100, daily: 2, dailyLimit: 1000 });
});

test('next window', () => {
  const t = Date.UTC(2026, 9, 19, 10, 7, 30);
  assert.equal(msToNextWindow(t, 0), 7.5 * 60_000);
  assert.equal(msToNextWindow(Date.UTC(2026, 9, 19, 10, 15), 0), 15 * 60_000);
});

test('formatting', () => {
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.equal(formatPace(5000, 1500), '5:00');
  assert.equal(formatPace(0, 10), '-');
});

test('count requests without headers', () => {
  const t = Date.UTC(2026, 9, 19, 10, 1);
  const a = countRequest(null, t);
  assert.deepEqual(a, { short: 1, shortLimit: 100, daily: 1, dailyLimit: 1000, at: t });
  const b = countRequest({ short: 90, shortLimit: 100, daily: 500, dailyLimit: 1000, at: t }, t + 60_000);
  assert.equal(b.short, 91);
  const c = countRequest(b, Date.UTC(2026, 9, 19, 10, 15));
  assert.deepEqual([c.short, c.daily], [1, 502]);
  const d = countRequest(c, Date.UTC(2026, 9, 20, 0, 0));
  assert.deepEqual([d.short, d.daily], [1, 1]);
});

test('roll usage into a new window', () => {
  const u = { short: 95, shortLimit: 100, daily: 500, dailyLimit: 1000, at: Date.UTC(2026, 9, 19, 10, 14) };
  assert.equal(rollUsage(u, Date.UTC(2026, 9, 19, 10, 14, 30)), u);
  assert.equal(rollUsage(u, Date.UTC(2026, 9, 19, 10, 16)).short, 0);
  assert.equal(rollUsage(u, Date.UTC(2026, 9, 19, 10, 16)).daily, 500);
  assert.equal(rollUsage(null), null);
});

test('recent peaks: widest top-3 window, newest first, at most the limit', () => {
  const row = (o) => ({ metric: 'run', span: 5000, value: 1570, activityId: 'a', name: 'Run', rankAll: 9, rankYear: 9, rank90: 9, ...o });
  const out = recentPeaks(
    [
      row({ date: '2026-10-14', activityId: 'r1', rankAll: 5, rankYear: 2, rank90: 1 }),
      row({ date: '2026-10-14', activityId: 'r1', span: 10000, value: 3162, rankAll: 1, rankYear: 1, rank90: 1 }),
      row({ date: '2026-10-07', activityId: 'b1', metric: 'power', span: 300, value: 300, rankAll: 8, rankYear: 4, rank90: 2 }),
      row({ date: '2026-10-05', activityId: 'x', rankAll: 4, rankYear: 4, rank90: 4 }), // no medal
      row({ date: '2026-10-30', activityId: 'future', rankAll: 1, rankYear: 1, rank90: 1 }), // after today
    ],
    '2026-10-21',
  );
  assert.deepEqual(out.map((p) => [p.activityId, p.span, p.window, p.rank, p.windowLabel]), [
    ['r1', 10000, 'all', 1, 'All time'],
    ['r1', 5000, 'year', 2, '2026'],
    ['b1', 300, 'd90', 2, 'Last 90 days'],
  ]);
  assert.equal(recentPeaks([row({ date: '2026-10-14', rank90: 1 }), row({ date: '2026-10-13', rank90: 1 })], '2026-10-21', { limit: 1 }).length, 1);
  // maxRank 1: only the bests, each in its widest window where it is the best.
  const best = recentPeaks(
    [
      row({ date: '2026-10-14', activityId: 'r1', rankAll: 5, rankYear: 2, rank90: 1 }),
      row({ date: '2026-10-14', activityId: 'r1', span: 10000, value: 3162, rankAll: 1, rankYear: 1, rank90: 1 }),
      row({ date: '2026-10-07', activityId: 'b1', metric: 'power', span: 300, value: 300, rankAll: 8, rankYear: 4, rank90: 2 }),
    ],
    '2026-10-21',
    { maxRank: 1 },
  );
  assert.deepEqual(best.map((p) => [p.activityId, p.span, p.window, p.rank]), [
    ['r1', 10000, 'all', 1],
    ['r1', 5000, 'd90', 1],
  ]);
  // A peak from last year cannot be ranked "this year".
  assert.equal(recentPeaks([row({ date: '2025-12-30', rankYear: 1 })], '2026-01-05').length, 0);
});
