import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isOutdoor, overviewGrid,
  CHART_POINTS, chartSeries, curveLabel, detailResponse, listResponse, listRow, parseDetailQuery, parseListQuery, percents, shortWhenText,
  simplifyRoute,
} from './app-api.mjs';

const typeLabel = (t) => t.replace(/([a-z])([A-Z])/g, '$1 $2');
const NOW = new Date('2026-10-20T20:30:00Z');

test('percents: whole numbers that add up to 100', () => {
  assert.deepEqual(percents([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(percents([0, 0]), [0, 0]);
  assert.deepEqual(percents([10, 0, 30]), [25, 0, 75]);
  for (const vs of [[7, 13, 29, 101, 3], [1, 2, 3, 4, 5, 6, 7], [1e6, 1, 1]]) {
    assert.equal(percents(vs).reduce((a, b) => a + b, 0), 100);
  }
});

test('parseListQuery: defaults, limits, cursor and zone', () => {
  const q = parseListQuery(new URLSearchParams(''), NOW);
  assert.deepEqual(q, { before: null, limit: 30, timeZone: 'America/Los_Angeles', today: '2026-10-20' });
  assert.equal(parseListQuery(new URLSearchParams('limit=100&before=123&tz=Asia/Tokyo'), NOW).today, '2026-10-21');
  assert.ok('error' in parseListQuery(new URLSearchParams('limit=0'), NOW));
  assert.ok('error' in parseListQuery(new URLSearchParams('limit=101'), NOW));
  assert.ok('error' in parseListQuery(new URLSearchParams('limit=2.5'), NOW));
  assert.ok('error' in parseListQuery(new URLSearchParams('before=1;drop'), NOW));
  assert.equal(parseListQuery(new URLSearchParams('tz=Nowhere/Else'), NOW).timeZone, 'America/Los_Angeles');
});

test('parseDetailQuery: Strava id, row id, latest; nothing else', () => {
  assert.equal(parseDetailQuery('latest', new URLSearchParams(), NOW).id, 'latest');
  assert.equal(parseDetailQuery('16123456789', new URLSearchParams(), NOW).id, '16123456789');
  assert.equal(parseDetailQuery('cm1abc_def-9', new URLSearchParams(), NOW).id, 'cm1abc_def-9');
  assert.ok('error' in parseDetailQuery('a b', new URLSearchParams(), NOW));
  assert.ok('error' in parseDetailQuery('x'.repeat(41), new URLSearchParams(), NOW));
});

test('shortWhenText and curveLabel', () => {
  assert.equal(shortWhenText('2026-10-14T06:34:00'), 'Wed, Oct 14 · 6:34 AM');
  assert.equal(shortWhenText('2026-10-14T00:05:00'), 'Wed, Oct 14 · 12:05 AM');
  assert.equal(shortWhenText('2026-10-14T13:00:00'), 'Wed, Oct 14 · 1:00 PM');
  assert.deepEqual([5, 60, 300, 5400].map(curveLabel), ['5s', '1m', '5m', '1.5h']);
});

test('simplifyRoute: at most 500 points, keeps both ends, rounds to 5 decimals', () => {
  const route = Array.from({ length: 1500 }, (_, i) => [37.7 + Math.sin(i / 40) * 0.01 + i * 1e-5, -122.4 + i * 2e-5]);
  const out = simplifyRoute(route);
  assert.ok(out.length <= 500 && out.length > 100, `got ${out.length}`);
  assert.deepEqual(out[0], [Math.round(route[0][0] * 1e5) / 1e5, Math.round(route[0][1] * 1e5) / 1e5]);
  assert.deepEqual(out.at(-1), [Math.round(route.at(-1)[0] * 1e5) / 1e5, Math.round(route.at(-1)[1] * 1e5) / 1e5]);
  // A straight line needs only its ends; short routes stay as they are; bad points go.
  assert.equal(simplifyRoute(Array.from({ length: 2000 }, (_, i) => [i * 1e-4, i * 1e-4])).length, 2);
  assert.equal(simplifyRoute([[1, 2], [null, 3], [1.000001, 2]]).length, 2);
});

/** A web-resolution series (1000 points) for a 1 h run at about 3 m/s. */
function series1000({ watts = false, gap = true } = {}) {
  const n = 1000;
  const t = Array.from({ length: n }, (_, i) => i * 3.6);
  const speed = t.map((_, i) => 3 + Math.sin(i / 50) * 0.3);
  return {
    full: 3600, bucketStart: t.map((_, i) => i * 4), t,
    d: t.map((_, i) => i * 10.8), lat: null, lng: null,
    alt: t.map((_, i) => 100 + i / 10), speed, gap: gap ? speed.map((v) => v * 1.02) : null,
    hr: t.map(() => 150), cad: t.map(() => 170), watts: watts ? t.map(() => 250) : null, temp: null,
  };
}

test('chartSeries: 300 points, both x axes, only present streams in web order, pace inverted', () => {
  const s = chartSeries(series1000(), 'run', { speed: 3, gap: 3.1, hr: 150, cad: 170, watts: null, temp: null });
  assert.equal(s.points, CHART_POINTS);
  assert.equal(s.smoothingS, 30);
  assert.equal(s.x.timeS.length, 300);
  assert.equal(s.x.distanceKm.length, 300);
  assert.equal(s.x.timeS[0], 0);
  assert.ok(s.x.distanceKm.at(-1) > 10.6 && s.x.distanceKm.at(-1) < 10.8);
  assert.deepEqual(s.streams.map((x) => x.key), ['pace', 'gap', 'hr', 'cad', 'alt']);
  const p = s.streams[0];
  assert.equal(p.invert, true);
  assert.equal(p.avgText, '5:33');
  assert.ok(p.values.every((v) => v > 290 && v < 380), 'pace in s/km');
  assert.equal(s.streams[1].overlayOf, 'pace');
  for (const x of s.streams) assert.equal(x.values.length, 300);
  assert.equal(s.streams.find((x) => x.key === 'alt').area, true);
  assert.ok(!('bucketStart' in s));
});

test('chartSeries: a ride shows speed and power, no pace', () => {
  const s = chartSeries(series1000({ watts: true, gap: false }), 'ride', { speed: 8, gap: null, hr: 140, cad: 90, watts: 230, temp: null });
  assert.deepEqual(s.streams.map((x) => x.key), ['speed', 'watts', 'hr', 'cad', 'alt']);
  assert.equal(s.streams[1].avgText, '230');
  assert.equal(s.streams[0].avgText, '28.8');
});

test('listRow: display text for a run and a ride', () => {
  const run = listRow(
    { strava_activity_id: '161', name: 'Morning Run', sport_type: 'Run', distance: 10230, moving_time: 3130, average_speed: 3.268, tss: 72.4, trainer: false, commute: false, start_local: '2026-10-14T06:34:00' },
    '🏃 Easy run',
    typeLabel
  );
  assert.equal(run.sport, 'run');
  assert.equal(run.subtitle, '10.23 km · 52:10 · 5:06 /km · 72 TSS');
  assert.equal(run.plannedTitle, 'Easy run');
  assert.equal(run.startText, 'Wed, Oct 14 · 6:34 AM');
  assert.equal(run.speedText, null);
  assert.equal(run.outdoor, true);
  const ride = listRow(
    { strava_activity_id: '162', name: 'Zwift', sport_type: 'VirtualRide', distance: 30000, moving_time: 3600, average_speed: 8.33, tss: null, trainer: true, start_local: '2026-10-15T18:00:00' },
    null,
    typeLabel
  );
  assert.equal(ride.outdoor, false);
  assert.equal(ride.sport, 'ride');
  assert.equal(ride.typeText, 'Virtual Ride');
  assert.equal(ride.speedText, '30.0 km/h');
  assert.equal(ride.paceText, null);
  assert.equal(ride.indoor, true);
  assert.equal(ride.subtitle, '30.00 km · 1:00:00 · 30.0 km/h');
  const lift = listRow({ strava_activity_id: '9', sport_type: 'WeightTraining', distance: 0, moving_time: 2700, start_local: '2026-10-15T07:00:00' }, null, typeLabel);
  assert.equal(lift.distanceText, null);
  assert.equal(lift.subtitle, '45:00');
});

test('listResponse: the extra row makes a cursor; the last page has none', () => {
  const rows = ['5', '4', '3'].map((id) => ({ strava_activity_id: id, sport_type: 'Run', start_local: '2026-10-14T06:00:00' }));
  const planned = { ok: true, titles: new Map([['4', 'Tempo']]) };
  const a = listResponse({ timeZone: 'UTC', today: '2026-10-20', now: NOW, rows, limit: 2, planned, typeLabel });
  assert.deepEqual(a.activities.map((r) => r.activityId), ['5', '4']);
  assert.equal(a.activities[1].plannedTitle, 'Tempo');
  assert.equal(a.nextCursor, '4');
  const b = listResponse({ timeZone: 'UTC', today: '2026-10-20', now: NOW, rows: rows.slice(2), limit: 2, planned, typeLabel });
  assert.equal(b.nextCursor, null);
  assert.equal(listResponse({ timeZone: 'UTC', today: '2026-10-20', now: NOW, rows: [], limit: 2, planned, typeLabel }).activities.length, 0);
});

/** A minimal ActivityView (queries.ts) for a run. */
function view(over = {}) {
  return {
    id: 'row1', stravaId: '161', name: 'Morning Run', description: null, sportType: 'Run', sport: 'run', layout: 'run',
    startLocal: '2026-10-14T06:34:00', day: '2026-10-14', place: 'San Francisco, United States', trainer: false, commute: false,
    stats: {
      distance: 10230, moving: 3130, elapsed: 3200, elevGain: 85, avgSpeed: 3.268, maxSpeed: 4.1, avgHr: 151.2, maxHr: 171,
      avgCadence: 172, avgWatts: null, np: null, maxWatts: null, deviceWatts: false, kj: null, calories: 640, avgTemp: null,
      elevHigh: null, elevLow: null, avgGapSpeed: 3.3, kudos: 3, achievements: 2, prs: 1, perceivedExertion: null,
    },
    device: 'Garmin Forerunner 965', gear: { name: 'Pegasus 41', distance: 412000 },
    weather: { source: 'open-meteo', time: '2026-10-14T13:00:00Z', code: 2, tempC: 13.6, feelsLikeC: 12.1, humidityPct: 80, windKmh: 9.4, windDeg: 270, precipMm: 0 },
    splits: [
      { index: 1, distance: 1000, moving: 310, elapsed: 310, speed: 3.22, gapSpeed: 3.25, elevDiff: 4, hr: 145 },
      { index: 2, distance: 230, moving: 70, elapsed: 70, speed: 3.28, gapSpeed: null, elevDiff: -1, hr: 150 },
    ],
    splitsSource: 'strava',
    laps: [],
    series: series1000(),
    route: Array.from({ length: 1500 }, (_, i) => [37.7 + Math.sin(i / 30) * 0.01, -122.4 + i * 1e-5]),
    hrZones: [
      { zone: 1, name: 'Endurance', min: 0, max: 122, seconds: 100 },
      { zone: 2, name: 'Moderate', min: 122, max: 153, seconds: 1700 },
      { zone: 3, name: 'Tempo', min: 153, max: 168, seconds: 1100 },
      { zone: 4, name: 'Threshold', min: 168, max: 183, seconds: 200 },
      { zone: 5, name: 'Anaerobic', min: 183, max: -1, seconds: 30 },
    ],
    powerZones: [], paceBins: [{ from: 300, to: 315, seconds: 1200 }, { from: 315, to: 330, seconds: 900 }, { from: 285, to: 300, seconds: 7 }],
    powerCurve: [], bestEfforts: [{ label: '1K', distance: 1000, seconds: 290, prRank: 2, startIndex: 1, endIndex: 300 }],
    bestEffortsSource: 'strava', segments: [],
    effort: { sufferScore: 61, trimp: 98, tss: 72.4, tssMethod: 'pace', ftp: 250 },
    startLatlng: [37.7, -122.4], prevId: '160', nextId: null, fetch: { needed: false, note: null },
    ...over,
  };
}

const CONTEXT = {
  ok: true,
  value: {
    planned: { title: '🏃 Easy run', duration: 50, tss: 55, date: '2026-10-14', compliance: { level: 'good', label: 'On target', ratio: 1.04, basis: 'time' } },
    load: { before: { ctl: 60.2, atl: 70.1, tsb: -8.4 }, after: { ctl: 61.0, atl: 72.3, tsb: -9.9 }, dayTss: 72.4 },
    garmin: { sleep_score: 82, sleep_total_min: 455, hrv_night_avg_ms: 61.4, resting_hr_bpm: 47 },
    sameRoute: [{ stravaId: '150', day: '2026-10-01', name: 'Loop', moving: 3000, distance: 10100 }],
  },
};

test('detailResponse: every section in the web order, with display text', () => {
  const r = detailResponse({ v: view(), context: CONTEXT, timeZone: 'UTC', today: '2026-10-20', now: NOW, typeLabel });
  assert.deepEqual(Object.keys(r), [
    'generatedAt', 'timeZone', 'today', 'activityId', 'header', 'overview', 'weather', 'equipment', 'splits', 'route', 'sameRoute',
    'coach', 'analysis', 'paceBars', 'paceHistogram', 'relativeEffort', 'heartRate', 'power', 'laps', 'bestEfforts', 'segments',
  ]);
  assert.equal(r.header.subtitle, 'Wednesday, October 14, 2026 at 6:34 AM · San Francisco, United States · Run');
  assert.equal(r.header.stravaUrl, 'https://www.strava.com/activities/161');
  assert.deepEqual(r.header.fetch, { pending: false, note: null });
  assert.deepEqual(r.overview.big.slice(0, 3), [
    { label: 'Distance', valueText: '10.23', unit: 'km' }, { label: 'Moving Time', valueText: '52:10' }, { label: 'Pace', valueText: '5:06', unit: '/km' },
  ]);
  assert.equal(r.overview.achievementsText, '1 PR · 2 achievements · 3 kudos');
  assert.equal(r.overview.grid.length, 6);
  assert.deepEqual(r.overview.grid.slice(0, 3).map((x) => x.label), ['Distance', 'Pace', 'Moving Time']);
  assert.equal(r.overview.grid.length + r.overview.more.length, r.overview.big.length + r.overview.small.length);
  assert.equal(r.header.outdoor, true);
  assert.equal(r.weather.headline, 'Partly cloudy, 14 °C');
  assert.deepEqual(r.equipment.gear, { label: 'Shoes', name: 'Pegasus 41', distanceText: '(412 km)' });
  assert.deepEqual(r.splits.rows.map((x) => x.label), ['1', '0.23']);
  assert.ok(r.route.points.length <= 500);
  assert.equal(r.sameRoute.rows.length, 2);
  assert.equal(r.sameRoute.rows.find((x) => x.isThis).name, 'This activity');
  assert.equal(r.coach.planned.title, 'Easy run');
  assert.equal(r.coach.planned.ratioText, '104% of the planned time');
  assert.deepEqual(r.coach.load.rows.map((x) => x.valueText), ['61 (+0.8)', '72 (+2.2)', '−10 neutral (−1.5)']);
  assert.equal(r.coach.load.methodText, 'from grade-adjusted pace');
  assert.deepEqual(r.coach.garmin.rows.map((x) => [x.key, x.value, x.valueText]), [
    ['sleep', 82, '82 · 7:35 h'], ['hrv', 61.4, '61 ms'], ['restingHr', 47, '47 bpm'],
  ]);
  assert.equal(r.analysis.x.timeS.length, 300);
  assert.deepEqual(r.paceBars.modes.map((m) => m.key), ['splits', 'smoothed']);
  assert.deepEqual(r.paceBars.modes[0].bars.map((b) => [b.width, b.valueText]), [[1000, '5:11'], [230, '5:05']]);
  assert.equal(r.paceBars.modes[1].values.length, 300);
  assert.equal(r.paceHistogram.bins.reduce((n, b) => n + b.percent, 0), 100);
  assert.equal(r.paceHistogram.avgText, 'avg 5:06');
  assert.equal(r.paceHistogram.bins[r.paceHistogram.avgIndex].label, '5:00');
  assert.deepEqual(r.relativeEffort.stats.map((x) => x.valueText), ['61', '98', '72', '83']);
  assert.equal(r.heartRate.zones.reduce((n, z) => n + z.percent, 0), 100);
  assert.deepEqual(r.heartRate.zones.map((z) => z.rangeText), ['≤ 122 bpm', '123–153 bpm', '154–168 bpm', '169–183 bpm', '≥ 184 bpm']);
  assert.equal(r.power, null);
  assert.equal(r.laps, null);
  assert.deepEqual(r.bestEfforts.rows[0], { label: '1K', distance: 1000, seconds: 290, prRank: 2, timeText: '4:50', paceText: '4:50 /km', rankText: '2nd best' });
  assert.equal(r.segments, null);
  assert.ok(JSON.stringify(r).length < 100_000);
});

test('detailResponse: a failed context fails only its sections; no streams says why', () => {
  const r = detailResponse({
    v: view({ series: null, fetch: { needed: true, note: null }, route: [], weather: null, device: null, gear: null }),
    context: { ok: false }, timeZone: 'UTC', today: '2026-10-20', now: NOW, typeLabel,
  });
  assert.deepEqual(r.coach, { ok: false });
  assert.deepEqual(r.sameRoute, { ok: false });
  assert.equal(r.header.ok, true);
  assert.equal(r.header.fetch.pending, true);
  assert.match(r.header.fetch.note, /still being imported/);
  assert.equal(r.analysis.emptyText, 'The streams of this older activity are still being imported.');
  assert.deepEqual(r.analysis.streams, []);
  assert.equal(r.weather, null);
  assert.equal(r.equipment, null);
  assert.equal(r.route, null);
  assert.deepEqual(r.paceBars.modes.map((m) => m.key), ['splits']);
});

test('detailResponse: a ride with power has the curve, FTP and power zones; a bad value fails one section', () => {
  const r = detailResponse({
    v: view({
      sportType: 'Ride', sport: 'ride', layout: 'ride', splits: [], paceBins: [], bestEfforts: [],
      powerCurve: [{ seconds: 5, watts: 700 }, { seconds: 60, watts: 400 }, { seconds: 1200, watts: 260 }],
      powerZones: [{ zone: 1, name: 'Active Recovery', min: 0, max: 137, seconds: 1 }, { zone: 2, name: 'Endurance', min: 137, max: -1, seconds: 2 }],
      laps: [
        { index: 1, name: 'Lap 1', distance: 10000, moving: 1200, elapsed: 1200, speed: 8.3, gapSpeed: null, elevDiff: null, elevGain: 50, hr: 140, maxHr: 150, cadence: 90, watts: 230, startIndex: 0, endIndex: 1 },
        { index: 2, name: 'Lap 2', distance: 5000, moving: 600, elapsed: 600, speed: 8.4, gapSpeed: null, elevDiff: null, elevGain: null, hr: null, maxHr: null, cadence: null, watts: null, startIndex: 2, endIndex: 3 },
      ],
      segments: [{ id: 'bad', name: 'Hill', distance: 1000, seconds: 120, grade: 'steep', prRank: 1, komRank: null, hr: null, watts: null, startIndex: null, endIndex: null }],
    }),
    context: CONTEXT, timeZone: 'UTC', today: '2026-10-20', now: NOW, typeLabel,
  });
  assert.equal(r.power.ftpText, 'FTP 250 W');
  assert.deepEqual(r.power.curve.map((p) => [p.label, p.wattsText, p.ftpPercent]), [['5s', '700 W', 280], ['1m', '400 W', 160], ['20m', '260 W', 104]]);
  assert.deepEqual(r.power.zones.map((z) => z.percent), [33, 67]);
  assert.deepEqual(r.laps.rows.map((l) => [l.paceText, l.powerText]), [['29.9 km/h', '230 W'], ['30.2 km/h', '–']]);
  assert.equal(r.laps.hasPower, true);
  assert.equal(r.paceBars.title, 'Speed Analysis');
  assert.deepEqual(r.paceBars.modes.map((m) => m.key), ['laps', 'smoothed']);
  assert.equal(r.paceHistogram, null);
  assert.deepEqual(r.segments, { ok: false });
  assert.equal(r.header.ok, true);
});

test('overviewGrid: the sport order first, Relative Effort only in more, six at most', () => {
  const big = [
    { label: 'Distance', valueText: '40.1', unit: 'km' }, { label: 'Moving Time', valueText: '1:20:00' },
    { label: 'Avg Speed', valueText: '30.1', unit: 'km/h' }, { label: 'Relative Effort', valueText: '40' },
    { label: 'Coach TSS', valueText: '80' },
  ];
  const small = [
    { label: 'Elapsed Time', valueText: '1:22:00' }, { label: 'Avg Power', valueText: '200', unit: 'W' },
    { label: 'Weighted Avg Power', valueText: '214', unit: 'W' }, { label: 'Calories', valueText: '900' },
  ];
  const r = overviewGrid({ big, small }, 'ride');
  assert.deepEqual(r.grid.map((s) => s.label), ['Distance', 'Moving Time', 'Avg Speed', 'Weighted Avg Power', 'Coach TSS', 'Elapsed Time']);
  assert.deepEqual(r.more.map((s) => s.label), ['Relative Effort', 'Avg Power', 'Calories']);
  const few = overviewGrid({ big: [{ label: 'Moving Time', valueText: '30:00' }, { label: 'Relative Effort', valueText: '5' }], small: [] }, 'basic');
  assert.deepEqual(few.grid.map((s) => s.label), ['Moving Time']);
  assert.deepEqual(few.more.map((s) => s.label), ['Relative Effort']);
});

test('isOutdoor: a real track only', () => {
  const route = [[1, 2], [1.1, 2.1]];
  assert.equal(isOutdoor({ trainer: false, sportType: 'Ride', route }), true);
  assert.equal(isOutdoor({ trainer: true, sportType: 'Ride', route }), false);
  assert.equal(isOutdoor({ trainer: false, sportType: 'VirtualRide', route }), false);
  assert.equal(isOutdoor({ trainer: false, sportType: 'Run', route: [] }), false);
});
