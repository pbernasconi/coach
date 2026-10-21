#!/usr/bin/env node
// Writes the Training tab's demo and test bodies (lift/ios/Lift/Resources/DemoAPI/app-activities*.json, app-trends.json),
// named as DemoAppData looks them up, by running the
// server's own response shaping (lift/APP-API.md, sections Activities and Trends) on made-up inputs. Nothing here
// comes from a real account: names, places, ids and numbers are invented.
//   node lift/ios/scripts/make-training-fixtures.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detailResponse, listResponse } from '../../../src/lib/activity/app-api.mjs';
import { trendsResponse } from '../../../src/lib/performance/trends-api.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../Lift/Resources/DemoAPI');
const NOW = new Date('2026-10-20T20:30:00Z');
const TZ = 'America/Los_Angeles';
const TODAY = '2026-10-20';
const typeLabel = (t) => t.replace(/([a-z])([A-Z])/g, '$1 $2');
const write = (name, value) => writeFileSync(join(out, `${name}.json`), `${JSON.stringify(value, null, 1)}\n`);

/** A smooth made-up stream of `n` samples over `seconds`. */
function series({ n = 1200, seconds = 3600, base = 3.1, watts = false, gap = true, foot = true } = {}) {
  const t = Array.from({ length: n }, (_, i) => (i * seconds) / n);
  const speed = t.map((_, i) => base + Math.sin(i / 60) * 0.35 + Math.sin(i / 7) * 0.05);
  let d = 0;
  const dist = speed.map((v) => (d += (v * seconds) / n));
  return {
    full: seconds, bucketStart: t, t, d: dist, lat: null, lng: null,
    alt: t.map((_, i) => 40 + 25 * Math.sin(i / 200) + i / 40), speed, gap: gap ? speed.map((v, i) => v * (1 + 0.03 * Math.cos(i / 200))) : null,
    hr: t.map((_, i) => Math.round(128 + i / 40 + 6 * Math.sin(i / 90))), cad: t.map((_, i) => (foot ? 168 : 88) + Math.round(3 * Math.sin(i / 30))),
    watts: watts ? t.map((_, i) => Math.round(215 + 45 * Math.sin(i / 45) + 20 * Math.sin(i / 9))) : null, temp: null,
  };
}

const zones = (unit, secs) =>
  (unit === 'bpm'
    ? [['Endurance', 0, 122], ['Moderate', 122, 153], ['Tempo', 153, 168], ['Threshold', 168, 183], ['Anaerobic', 183, -1]]
    : [['Active Recovery', 0, 137], ['Endurance', 137, 187], ['Tempo', 187, 225], ['Threshold', 225, 262], ['VO2 Max', 262, -1]]
  ).map(([name, min, max], i) => ({ zone: i + 1, name, min, max, seconds: secs[i] }));

function runView() {
  const splits = Array.from({ length: 10 }, (_, i) => {
    const speed = 3.0 + Math.sin(i) * 0.15;
    return { index: i + 1, distance: i === 9 ? 640 : 1000, moving: Math.round((i === 9 ? 640 : 1000) / speed), elapsed: 0, speed,
      gapSpeed: speed * 1.02, elevDiff: Math.round(6 * Math.sin(i * 1.3)), hr: 138 + i * 2 };
  });
  const laps = splits.slice(0, 5).map((s, i) => ({ index: i + 1, name: `Lap ${i + 1}`, distance: 2000, moving: 2 * s.moving, elapsed: 0,
    speed: s.speed, gapSpeed: s.gapSpeed, elevDiff: null, elevGain: 8 + i * 3, hr: s.hr, maxHr: s.hr + 9, cadence: 170, watts: null, startIndex: 0, endIndex: 1 }));
  return {
    id: 'demo-run', stravaId: '9000000102', name: 'Harbour loop', description: 'Easy miles along the water.\nLegs felt fresh.', sportType: 'Run', sport: 'run', layout: 'run',
    startLocal: '2026-10-17T07:15:00', day: '2026-10-17', place: 'Seaview, Atlantis', trainer: false, commute: false,
    stats: { distance: 9640, moving: 3170, elapsed: 3260, elevGain: 64, avgSpeed: 3.04, maxSpeed: 4.0, avgHr: 146, maxHr: 166, avgCadence: 170,
      avgWatts: null, np: null, maxWatts: null, deviceWatts: false, kj: null, calories: 690, avgTemp: null, elevHigh: 71, elevLow: 18,
      avgGapSpeed: 3.09, kudos: 4, achievements: 3, prs: 1, perceivedExertion: null },
    device: 'Demo Watch 2', gear: { name: 'Trail Shoe One', distance: 412000 },
    weather: { source: 'open-meteo', time: '2026-10-17T14:00:00Z', code: 2, tempC: 14.2, feelsLikeC: 13, humidityPct: 72, windKmh: 11, windDeg: 290, precipMm: 0 },
    splits, splitsSource: 'strava', laps,
    series: series(),
    route: Array.from({ length: 400 }, (_, i) => [10.2 + 0.012 * Math.sin((i / 400) * 2 * Math.PI), 20.4 + 0.02 * Math.cos((i / 400) * 2 * Math.PI) + 0.002 * Math.sin(i / 9)]),
    hrZones: zones('bpm', [240, 1500, 1100, 280, 50]),
    powerZones: [],
    paceBins: [[285, 300, 120], [300, 315, 640], [315, 330, 1290], [330, 345, 780], [345, 360, 260], [360, 375, 80]].map(([from, to, seconds]) => ({ from, to, seconds })),
    powerCurve: [],
    bestEfforts: [['400m', 400, 112, null], ['1K', 1000, 295, 2], ['1 mile', 1609, 486, null], ['5K', 5000, 1590, 1]].map(([label, distance, seconds, prRank]) => ({ label, distance, seconds, prRank, startIndex: 0, endIndex: 1 })),
    bestEffortsSource: 'strava',
    segments: [
      { id: '501', name: 'Pier sprint', distance: 420, seconds: 118, grade: 0.2, prRank: 1, komRank: null, hr: 158, watts: null, startIndex: null, endIndex: null },
      { id: '502', name: 'Lighthouse climb', distance: 1250, seconds: 450, grade: 3.1, prRank: null, komRank: null, hr: 152, watts: null, startIndex: null, endIndex: null },
      { id: '503', name: 'Boardwalk', distance: 2100, seconds: 690, grade: 0, prRank: 3, komRank: null, hr: 147, watts: null, startIndex: null, endIndex: null },
    ],
    effort: { sufferScore: 42, trimp: 96, tss: 71, tssMethod: 'pace', ftp: 250 },
    startLatlng: [10.2, 20.42], prevId: '9000000101', nextId: '9000000103', fetch: { needed: false, note: null },
  };
}

function rideView() {
  const laps = [0, 1, 2].map((i) => ({ index: i + 1, name: `Lap ${i + 1}`, distance: 20000 + i * 5000, moving: 2400 + i * 500, elapsed: 0, speed: 8.2 + i * 0.3,
    gapSpeed: null, elevDiff: null, elevGain: 120 + i * 40, hr: 138 + i * 4, maxHr: 160, cadence: 88, watts: 210 + i * 15, startIndex: 0, endIndex: 1 }));
  return {
    ...runView(), id: 'demo-ride', stravaId: '9000000103', name: 'Valley ride', description: null, sportType: 'Ride', sport: 'ride', layout: 'ride',
    startLocal: '2026-10-18T09:02:00', day: '2026-10-18', place: 'Seaview, Atlantis',
    stats: { ...runView().stats, distance: 65400, moving: 8100, elapsed: 8600, elevGain: 610, avgSpeed: 8.07, maxSpeed: 15, avgHr: 141, maxHr: 172,
      avgCadence: 88, avgWatts: 221, np: 238, maxWatts: 820, deviceWatts: true, kj: 1790, calories: 1650, avgGapSpeed: null, prs: 0, achievements: 2, kudos: 6 },
    gear: { name: 'Road Bike', distance: 5120000 }, splits: [], laps, paceBins: [], bestEfforts: [],
    series: series({ base: 8.1, seconds: 8100, watts: true, gap: false, foot: false }),
    powerCurve: [[5, 790], [15, 640], [30, 520], [60, 410], [300, 300], [600, 278], [1200, 262], [3600, 236]].map(([seconds, watts]) => ({ seconds, watts })),
    powerZones: zones('W', [900, 2900, 2600, 1300, 400]), hrZones: zones('bpm', [600, 4200, 2600, 600, 100]),
    segments: [{ id: '601', name: 'Valley wall', distance: 3400, seconds: 640, grade: 5.2, prRank: 2, komRank: null, hr: 161, watts: 305, startIndex: null, endIndex: null }],
    effort: { sufferScore: 96, trimp: 180, tss: 142, tssMethod: 'power', ftp: 250 },
    prevId: '9000000102', nextId: null,
  };
}

const CONTEXT = {
  ok: true,
  value: {
    planned: { title: '🏃 Easy run', duration: 50, tss: 55, date: '2026-10-17', compliance: { level: 'good', label: 'On target', ratio: 1.06, basis: 'time' } },
    load: { before: { ctl: 51.2, atl: 44.8, tsb: 7.1 }, after: { ctl: 51.9, atl: 48.3, tsb: 6.4 }, dayTss: 71 },
    garmin: { sleep_score: 81, sleep_total_min: 431, hrv_night_avg_ms: 64, resting_hr_bpm: 49 },
    sameRoute: [{ stravaId: '9000000090', day: '2026-09-26', name: 'Harbour loop', moving: 3120, distance: 9610 }, { stravaId: '9000000071', day: '2026-08-30', name: 'Sunday loop', moving: 3300, distance: 9700 }],
  },
};

write('app-activities-id', detailResponse({ v: runView(), context: CONTEXT, timeZone: TZ, today: TODAY, now: NOW, typeLabel }));
write('app-activities-9000000103', detailResponse({ v: rideView(), context: { ok: true, value: { ...CONTEXT.value, planned: null, sameRoute: [] } }, timeZone: TZ, today: TODAY, now: NOW, typeLabel }));
write('app-activities-9000000104', detailResponse({
  v: { ...runView(), stravaId: '9000000104', name: 'Lunch walk', sportType: 'Walk', sport: 'walk', series: null, splits: [], laps: [], route: [], weather: null,
    paceBins: [], bestEfforts: [], segments: [], hrZones: [], device: null, gear: null, fetch: { needed: true, note: null }, prevId: '9000000103', nextId: null },
  context: { ok: false }, timeZone: TZ, today: TODAY, now: NOW, typeLabel,
}));

const kinds = [['Run', 'Harbour loop', 9640, 3170, 3.04, 71], ['Ride', 'Valley ride', 65400, 8100, 8.07, 142], ['WeightTraining', 'Upper body', 0, 3300, 0, null],
  ['Hike', 'Ridge path', 11200, 12400, 0.9, 88], ['VirtualRide', 'Indoor tempo', 30000, 3600, 8.33, 64], ['Walk', 'Lunch walk', 3100, 2200, 1.4, null]];
const rows = Array.from({ length: 40 }, (_, i) => {
  const [type, name, distance, moving, speed, tss] = kinds[i % kinds.length];
  const day = new Date(Date.UTC(2026, 9, 19) - i * 1.6 * 86400000).toISOString().slice(0, 10);
  return { strava_activity_id: String(9000000104 - i), name, sport_type: type, distance, moving_time: moving, average_speed: speed, tss,
    trainer: type === 'VirtualRide', commute: false, start_local: `${day}T07:${String(10 + (i % 40)).padStart(2, '0')}:00` };
});
const planned = { ok: true, titles: new Map([['9000000098', '🏃 Easy run'], ['9000000097', '🚴 Tempo ride']]) };
const first = listResponse({ timeZone: TZ, today: TODAY, now: NOW, rows: rows.slice(0, 31), limit: 30, planned, typeLabel });
write('app-activities', first);
write(`app-activities-before-${first.nextCursor}`, listResponse({ timeZone: TZ, today: TODAY, now: NOW, rows: rows.slice(30), limit: 30, planned, typeLabel }));

const SPORTS = [{ id: 'ride', label: 'Ride' }, { id: 'run', label: 'Run' }, { id: 'hike', label: 'Hike' }, { id: 'walk', label: 'Walk' },
  { id: 'strength', label: 'Strength' }, { id: 'rest', label: 'Rest' }];
const weeks = Array.from({ length: 12 }, (_, i) => {
  const week = new Date(Date.UTC(2026, 7, 3) + i * 7 * 86400000).toISOString().slice(0, 10);
  const ride = 2.5 + 1.5 * Math.sin(i / 2), run = 2 + Math.cos(i / 3), hike = i % 4 === 1 ? 1.6 : 0;
  const sports = { ride: { hours: ride, km: ride * 28, types: { Ride: ride } }, run: { hours: run, km: run * 10.5, types: { Run: run } },
    ...(hike ? { hike: { hours: hike, km: 5.4, types: { Hike: hike } } } : {}) };
  const scale = i === 11 ? 0.3 : 1;
  for (const s of Object.values(sports)) { s.hours *= scale; s.km *= scale; }
  const hours = Object.values(sports).reduce((n, s) => n + s.hours, 0);
  return { week, hours, runKm: sports.run.km, runMin: sports.run.hours * 60, rideKm: sports.ride.km, rideHours: sports.ride.hours,
    strength: i % 3 === 0 ? 2 : 1, tss: Math.round(hours * 62), planned: 5, done: i === 11 ? 1 : 4, sports };
});
const load = Array.from({ length: 84 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 6, 29) + i * 86400000).toISOString().slice(0, 10);
  const ctl = 45 + 8 * Math.sin(i / 20);
  return { date, ctl, atl: ctl + 6 * Math.sin(i / 5), tsb: -6 * Math.sin(i / 5), tss: 40 + (i % 7) * 10 };
});
const cell = (value, date, activityId, name) => ({ value, date, activityId, name });
write('app-trends', trendsResponse({
  now: NOW, timeZone: TZ, today: TODAY, strengthTarget: 2, sports: SPORTS,
  perf: { ok: true, value: { weeks, load, latestActivity: '2026-10-19' } },
  pmc: { ok: true, value: { ramp: [{ days: 7, from: 50.1, to: 48.0, change: -2.1, perWeek: -2.1 }, { days: 28, from: 44, to: 48, change: 4, perWeek: 1 },
    { days: 90, from: 30, to: 48, change: 18, perWeek: 1.4 }, null] } },
  peaks: { ok: true, value: {
    windows: [{ key: 'all', label: 'All time' }, { key: 'd90', label: '90 days' }, { key: 'd28', label: '28 days' }],
    power: [[5, '5 s', 820, 790, 760], [60, '1 min', 430, 410, 395], [300, '5 min', 318, 300, 291], [1200, '20 min', 271, 262, null], [3600, '1 h', 244, 236, null]]
      .map(([span, label, all, d90, d28]) => ({ span, label, cells: {
        all: cell(all, '2026-06-14', '9000000040', 'Hill repeats'), d90: cell(d90, '2026-10-18', '9000000103', 'Valley ride'),
        d28: d28 == null ? null : cell(d28, '2026-10-18', '9000000103', 'Valley ride') } })),
    run: [[1000, '1 km', 262, 281, 295], [5000, '5 km', 1440, 1530, 1590], [10000, '10 km', 3050, null, null], [21097, 'Half', 6900, null, null]]
      .map(([span, label, all, d90, d28]) => ({ span, label, cells: {
        all: cell(all, '2025-11-08', '9000000020', 'Race morning'),
        d90: d90 == null ? null : cell(d90, '2026-10-17', '9000000102', 'Harbour loop'),
        d28: d28 == null ? null : cell(d28, '2026-10-17', '9000000102', 'Harbour loop') } })),
    scanned: 120, pending: 3 } },
  lift: { ok: true, value: {
    hasData: true, unit: 'lb',
    thisWeek: [{ muscle: 'quads', sets: 12 }, { muscle: 'chest', sets: 8 }, { muscle: 'upperBack', sets: 14 }, { muscle: 'hamstrings', sets: 22 }],
    last4: [{ muscle: 'quads', sets: 52 }, { muscle: 'chest', sets: 40 }, { muscle: 'upperBack', sets: 56 }, { muscle: 'hamstrings', sets: 44 }, { muscle: 'biceps', sets: 20 }],
    top: [
      { key: 'demo-squat', name: 'Back squat', points: [['2026-08-10', 280], ['2026-09-01', 292], ['2026-09-20', 300], ['2026-10-12', 306]].map(([day, e1rm]) => ({ day, e1rm })), latest: 306, change: 0.093 },
      { key: 'demo-bench', name: 'Bench press', points: [['2026-08-12', 210], ['2026-09-15', 206]].map(([day, e1rm]) => ({ day, e1rm })), latest: 206, change: -0.019 },
      { key: 'demo-row', name: 'Barbell row', points: [{ day: '2026-10-14', e1rm: 190 }], latest: 190, change: null },
    ],
  } },
}));
