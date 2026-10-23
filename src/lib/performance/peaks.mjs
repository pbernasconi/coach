// Peak performances from Strava streams: best average power over fixed durations (rides) and the fastest
// time over fixed distances (runs). Also Strava rate-limit reading and the all-time / 90-day / 28-day
// bests. No framework or database imports, so node --test can run it (peaks.test.mjs).

import { fastestStretch } from '../activity/streams.mjs';

/** Bump when the extraction changes: the backfill then recomputes every activity. */
export const PEAKS_VERSION = 1;

/** Power durations in seconds. */
export const POWER_DURATIONS = [5, 60, 300, 1200, 3600];

/** Run distances: `span` is the stored key (meters, whole), `meters` the exact distance. */
export const RUN_DISTANCES = [
  { span: 1000, meters: 1000, label: '1 km' },
  { span: 5000, meters: 5000, label: '5 km' },
  { span: 10000, meters: 10000, label: '10 km' },
  { span: 21097, meters: 21097.5, label: 'Half' },
];

// A pause longer than this many seconds counts as 0 W after its first second (the rider was stopped).
const MAX_HOLD_S = 5;
// Values past these are sensor or GPS errors.
const MAX_WATTS = 2500;

/** 'ride' or 'run' for a Strava sport_type that has peaks, else null. E-bikes have no rider power. */
export function peakSportOf(sportType) {
  const t = String(sportType ?? '');
  if (/^E(Bike|MountainBike)Ride$/.test(t)) return null;
  if (/Ride$/.test(t) || t === 'Velomobile' || t === 'Handcycle') return 'ride';
  if (/Run$/.test(t)) return 'run';
  return null;
}

/**
 * Power on a 1-second grid from the watts and time streams. Each sample covers the seconds since the sample
 * before it; a gap longer than MAX_HOLD_S gives the sample one second and zeros for the rest.
 * @param {(number | null)[]} watts
 * @param {number[]} time  seconds from the start, rising
 */
export function powerPerSecond(watts, time) {
  const n = Math.min(watts?.length ?? 0, time?.length ?? 0);
  if (n === 0) return new Float64Array(0);
  const total = Math.max(1, Math.round(time[n - 1] - time[0]) + 1);
  const grid = new Float64Array(total);
  for (let i = 0; i < n; i++) {
    const w = Number(watts[i]);
    const v = Number.isFinite(w) && w > 0 && w <= MAX_WATTS ? w : 0;
    const at = Math.round(time[i] - time[0]);
    if (at < 0 || at >= total) continue;
    const prev = i === 0 ? at - 1 : Math.round(time[i - 1] - time[0]);
    const dt = at - prev;
    const hold = dt <= MAX_HOLD_S ? dt : 1;
    for (let s = Math.max(0, at - hold + 1); s <= at; s++) grid[s] = v;
  }
  return grid;
}

/**
 * Best average power for each duration, rounded to whole watts. A duration longer than the ride is left out.
 * @returns {{ durationS: number, watts: number }[]}
 */
export function bestPower(watts, time, durations = POWER_DURATIONS) {
  const grid = powerPerSecond(watts, time);
  const prefix = new Float64Array(grid.length + 1);
  for (let i = 0; i < grid.length; i++) prefix[i + 1] = prefix[i] + grid[i];
  const out = [];
  for (const d of durations) {
    if (d > grid.length) continue;
    let best = 0;
    for (let end = d; end <= grid.length; end++) {
      const sum = prefix[end] - prefix[end - d];
      if (sum > best) best = sum;
    }
    if (best > 0) out.push({ durationS: d, watts: Math.round(best / d) });
  }
  return out;
}

/**
 * Fastest elapsed time over each distance, in seconds to one decimal. The start of the best stretch is
 * interpolated between samples. A distance longer than the run is left out.
 * @param {number[]} distance  meters from the start, rising
 * @param {number[]} time  seconds from the start, rising
 * @returns {{ distanceM: number, seconds: number }[]}
 */
export function bestEfforts(distance, time, distances = RUN_DISTANCES) {
  const out = [];
  for (const { span, meters } of distances) {
    const f = fastestStretch(distance, time, meters);
    if (f) out.push({ distanceM: span, seconds: Math.round(f.seconds * 10) / 10 });
  }
  return out;
}

/**
 * The peak rows for one activity: metric 'power' (span = seconds, value = watts) for rides with a power
 * meter, metric 'run' (span = meters, value = seconds) for runs.
 * @param {{ watts?: (number | null)[], distance?: number[], time?: number[] }} streams
 * @param {{ sportType: string, deviceWatts?: boolean | null }} activity
 * @returns {{ metric: 'power' | 'run', span: number, value: number }[]}
 */
export function extractPeaks(streams, activity) {
  const sport = peakSportOf(activity.sportType);
  if (sport === 'ride' && activity.deviceWatts && streams.watts?.length && streams.time?.length) {
    return bestPower(streams.watts, streams.time).map((p) => ({ metric: 'power', span: p.durationS, value: p.watts }));
  }
  if (sport === 'run' && streams.distance?.length && streams.time?.length) {
    return bestEfforts(streams.distance, streams.time).map((p) => ({ metric: 'run', span: p.distanceM, value: p.seconds }));
  }
  return [];
}

/**
 * A run effort faster than this pace (seconds per km) is a GPS jump, not a run: 2:50/km is faster than any 1 km
 * Coach's athlete has run. Such rows are kept in the table but never shown as a best.
 */
export const FASTEST_RUN_S_PER_KM = 170;

/** Whether a peak row is believable (run efforts under FASTEST_RUN_S_PER_KM are GPS errors). */
export const plausiblePeak = (r) => r.metric !== 'run' || r.value / (r.span / 1000) >= FASTEST_RUN_S_PER_KM;

export const PEAK_WINDOWS = [
  { key: 'all', label: 'All time', days: null },
  { key: 'd90', label: '90 days', days: 90 },
  { key: 'd28', label: '28 days', days: 28 },
];

/**
 * The best value for each metric, span and window. Power: highest watts. Run: lowest seconds.
 * @param {{ metric: string, span: number, value: number, date: string, activityId: string, name?: string }[]} rows
 * @param {string} today  'YYYY-MM-DD'
 * @returns {Record<string, Record<number, Record<string, { value: number, date: string, activityId: string, name?: string } | null>>>}
 */
export function bestByWindow(rows, today) {
  const startOf = (days) => new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const starts = Object.fromEntries(PEAK_WINDOWS.map((w) => [w.key, w.days == null ? '' : startOf(w.days)]));
  const out = { power: {}, run: {} };
  for (const d of POWER_DURATIONS) out.power[d] = { all: null, d90: null, d28: null };
  for (const d of RUN_DISTANCES) out.run[d.span] = { all: null, d90: null, d28: null };
  for (const r of rows) {
    const cell = out[r.metric]?.[r.span];
    if (!cell || r.date > today || !plausiblePeak(r)) continue;
    const better = (b) => !b || (r.metric === 'power' ? r.value > b.value : r.value < b.value);
    for (const w of PEAK_WINDOWS) {
      if (r.date >= starts[w.key] && better(cell[w.key])) {
        cell[w.key] = { value: r.value, date: r.date, activityId: r.activityId, ...(r.name ? { name: r.name } : {}) };
      }
    }
  }
  return out;
}

/**
 * Strava's usage from response headers. The read limits (X-ReadRateLimit-*) apply to GET requests when Strava
 * sends them; else the overall limits. Missing headers give null.
 * @param {{ get(name: string): string | null }} headers
 * @returns {{ short: number, shortLimit: number, daily: number, dailyLimit: number } | null}
 */
export function rateUsage(headers) {
  const pair = (name) => {
    const v = headers.get(name);
    if (!v) return null;
    const [a, b] = v.split(',').map((s) => Number(s.trim()));
    return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
  };
  const usage = pair('x-readratelimit-usage') ?? pair('x-ratelimit-usage');
  const limit = pair('x-readratelimit-limit') ?? pair('x-ratelimit-limit');
  if (!usage || !limit) return null;
  return { short: usage[0], shortLimit: limit[0], daily: usage[1], dailyLimit: limit[1] };
}

/**
 * What to do before the next request: 'go', 'wait' (the 15-minute window is near full) or 'stop' (the daily
 * limit is near full). `cushion` requests stay free for the regular sync.
 */
export function rateDecision(usage, { cushion = 10, dailyCushion = 50 } = {}) {
  if (!usage) return 'go';
  if (usage.daily >= usage.dailyLimit - dailyCushion) return 'stop';
  if (usage.short >= usage.shortLimit - cushion) return 'wait';
  return 'go';
}

/**
 * Usage after one more request, for responses without usage headers (the streams endpoint sends none).
 * @param {{ short: number, shortLimit: number, daily: number, dailyLimit: number, at?: number } | null} usage
 */
export function countRequest(usage, now = Date.now()) {
  const u = rollUsage(usage ?? { short: 0, shortLimit: 100, daily: 0, dailyLimit: 1000 }, now);
  return { ...u, short: u.short + 1, daily: u.daily + 1, at: now };
}

/** The usage as of `now`: the 15-minute count is 0 in a new quarter hour, the daily count on a new UTC day. */
export function rollUsage(usage, now = Date.now()) {
  if (!usage || usage.at == null) return usage;
  const q = 15 * 60_000;
  const sameWindow = Math.floor(usage.at / q) === Math.floor(now / q);
  const sameDay = Math.floor(usage.at / 86_400_000) === Math.floor(now / 86_400_000);
  if (sameWindow && sameDay) return usage;
  return { ...usage, short: sameWindow ? usage.short : 0, daily: sameDay ? usage.daily : 0, at: now };
}

/** Milliseconds until Strava's next 15-minute window (they start at :00, :15, :30 and :45 UTC), plus a margin. */
export function msToNextWindow(now = Date.now(), marginMs = 5_000) {
  const q = 15 * 60_000;
  return q - (now % q) + marginMs;
}

/** Seconds as h:mm:ss or m:ss. */
export function formatDuration(totalSeconds) {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Pace per km for a distance and a time, as m:ss. */
export function formatPace(meters, seconds) {
  if (!(meters > 0) || !(seconds > 0)) return '-';
  return formatDuration((seconds * 1000) / meters);
}

/** The windows a recent peak can rank in, best first. */
export const RECENT_PEAK_WINDOWS = ['all', 'year', 'd90'];

/**
 * Recent peak performances for the home page, as on Intervals.icu: each peak from the last few weeks that is in
 * the top 3 of a window (all time, this year, the last 90 days), with the widest such window. Newest first, then
 * the better medal; at most `limit`. `maxRank: 1` keeps only the bests.
 * @param {{ metric: 'power' | 'run', span: number, value: number, date: string, activityId: string, name?: string | null,
 *   rankAll: number, rankYear: number, rank90: number }[]} rows  ranks from 1 (the loader counts better values)
 * @param {string} today  'YYYY-MM-DD'
 * @returns {{ metric: 'power' | 'run', span: number, value: number, date: string, activityId: string, name: string | null,
 *   rank: number, window: 'all' | 'year' | 'd90', windowLabel: string }[]}
 */
export function recentPeaks(rows, today, { limit = 6, maxRank = 3 } = {}) {
  const year = today.slice(0, 4);
  const label = { all: 'All time', year, d90: 'Last 90 days' };
  const order = { all: 0, year: 1, d90: 2 };
  const out = [];
  for (const r of rows) {
    if (r.date > today) continue;
    const ranks = { all: r.rankAll, year: r.date.startsWith(year) ? r.rankYear : Infinity, d90: r.rank90 };
    const window = RECENT_PEAK_WINDOWS.find((w) => ranks[w] >= 1 && ranks[w] <= maxRank);
    if (!window) continue;
    out.push({
      metric: r.metric, span: r.span, value: r.value, date: r.date, activityId: r.activityId, name: r.name ?? null,
      rank: ranks[window], window, windowLabel: label[window],
    });
  }
  out.sort((a, b) => b.date.localeCompare(a.date) || order[a.window] - order[b.window] || a.rank - b.rank || a.span - b.span);
  return out.slice(0, limit);
}
