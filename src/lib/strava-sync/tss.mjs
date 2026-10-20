// Training Stress Score for one activity. No framework or database imports, so node --test can run it (tss.test.mjs).
//
// The methods, best first:
//   power_stream  rides with a power meter and a watts stream: Normalized Power from the stream against the FTP
//   power         rides with a power meter, no stream: Strava's weighted average watts against the FTP
//   pace          runs with velocity and grade streams and a threshold pace: normalized grade-adjusted pace (rTSS)
//   hr_stream     anything with a heart-rate stream: each sample's heart-rate reserve against the sport's LTHR
//   hr            average heart rate only: the same, from the average (it counts interval sessions a little low)
//   duration_fallback  no power, pace or heart rate: a typical intensity for the sport
//
// The heart-rate methods use the heart-rate reserve, (HR − rest) / (LTHR − rest), as the intensity factor. A plain
// HR / LTHR ratio counts easy sessions far too high: 135 bpm against an LTHR of 168 is 0.80, or 65 TSS an hour,
// when an easy hour is 40 to 55. With a resting HR of 42 the reserve gives 0.74, or 54 an hour.

import { gapSpeeds } from '../activity/streams.mjs';

export const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide', 'EMountainBikeRide', 'Velomobile', 'Handcycle']);
const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

/** The sport family of an activity, for its threshold heart rate: ride, run or other. */
export function sportFamily(a) {
  const t = a?.sport_type ?? a?.type;
  if (RIDE_TYPES.has(t)) return 'ride';
  if (RUN_TYPES.has(t)) return 'run';
  return 'other';
}

// A typical intensity factor without power, pace or heart rate.
const FALLBACK_IF = { Run: 0.75, TrailRun: 0.75, Ride: 0.65, VirtualRide: 0.7, Swim: 0.7, WeightTraining: 0.55, Yoga: 0.35, Walk: 0.4 };

const round1 = (x) => Math.round(x * 10) / 10;
const tssOf = (hours, intensity) => round1(hours * intensity * intensity * 100);

/** The seconds a sample counts for: the time to the next sample; a gap over 30 s (a pause) counts 1 s. */
function dtAt(time, i) {
  let dt = time && i + 1 < time.length ? time[i + 1] - time[i] : 1;
  if (!Number.isFinite(dt) || dt <= 0 || dt > 30) dt = 1;
  return dt;
}

/**
 * Normalized Power: the 4th-power mean of the 30-second rolling average of power (Coggan). Zeros (coasting)
 * count; gaps (pauses) do not. Null when the stream is shorter than 30 s.
 * @param {(number | null)[]} watts
 * @param {number[]} [time]  seconds from the start
 */
export function normalizedPower(watts, time) {
  if (!watts?.length) return null;
  const queue = [];
  let sum = 0;
  let span = 0;
  let acc = 0;
  let w = 0;
  for (let i = 0; i < watts.length; i++) {
    const p = typeof watts[i] === 'number' && watts[i] > 0 ? watts[i] : 0;
    const dt = dtAt(time, i);
    queue.push([p, dt]);
    sum += p * dt;
    span += dt;
    while (span - queue[0][1] >= 30) {
      const [q, qdt] = queue.shift();
      sum -= q * qdt;
      span -= qdt;
    }
    if (span >= 30) {
      const avg = sum / span;
      acc += avg ** 4 * dt;
      w += dt;
    }
  }
  return w ? (acc / w) ** 0.25 : null;
}

/**
 * Normalized grade-adjusted speed (m/s) of a run: the 4th-power mean of the 30-second rolling grade-adjusted
 * speed, over moving samples. The 4th power gives hard stretches their weight, as Normalized Power does.
 */
export function normalizedGradedSpeed(velocity, gradePct, time) {
  if (!velocity?.length) return null;
  const gap = gapSpeeds(velocity, gradePct ?? []);
  const powered = gap.map((v) => (typeof v === 'number' && v > 0.5 ? v : 0));
  return normalizedPower(powered, time);
}

/** The heart-rate intensity factor of one value: its share of the reserve up to the LTHR, from 0 to 1.3. */
export function hrIntensity(hr, lthr, restHr) {
  if (!(hr > 0) || !(lthr > restHr)) return 0;
  return Math.max(0, Math.min(1.3, (hr - restHr) / (lthr - restHr)));
}

/**
 * The thresholds TSS needs, from the athlete's settings (users.settings.thresholds), with defaults from Strava,
 * Garmin and the run peaks. Each value says where it came from, so Settings can show it.
 * Garmin's values (lactate threshold HR and pace, from the watch) come before the estimates.
 * @param {{ settings?: Record<string, unknown> | null, stravaFtp?: number | null, stravaHrZones?: { min: number, max: number }[] | null,
 *           restingHr?: number | null, garminLthr?: number | null, garminLtPaceS?: number | null,
 *           best10kS?: number | null, best5kS?: number | null }} src
 */
export function resolveThresholds({ settings, stravaFtp, stravaHrZones, restingHr, garminLthr, garminLtPaceS, best10kS, best5kS } = {}) {
  const s = settings ?? {};
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  const pick = (own, fallback, from) => (num(own) != null ? { value: num(own), source: 'settings' } : fallback != null ? { value: fallback, source: from } : { value: null, source: null });

  const zoneLthr = num(stravaHrZones?.[2]?.max);
  const ftp = pick(s.ftp, num(stravaFtp), 'strava');
  const runLthr = num(garminLthr)
    ? pick(s.runLthr, Math.round(num(garminLthr)), 'garmin')
    : pick(s.runLthr, zoneLthr ?? 168, zoneLthr ? 'strava zones' : 'default');
  // Cycling LTHR is usually 5 to 10 bpm below running LTHR (less muscle mass works).
  const rideLthr = pick(s.rideLthr, runLthr.value != null ? runLthr.value - 5 : null, 'run LTHR − 5');
  const rest = pick(s.restingHr, num(restingHr) != null ? Math.round(num(restingHr)) : 50, num(restingHr) ? 'garmin' : 'default');
  // Threshold pace (about one hour's race pace) is about 4 % slower than 10 km pace, 8 % slower than 5 km pace.
  const est = num(best10kS) ? Math.round((num(best10kS) / 10) * 1.04) : num(best5kS) ? Math.round((num(best5kS) / 5) * 1.08) : null;
  const runPace = num(garminLtPaceS)
    ? pick(s.runPaceS, Math.round(num(garminLtPaceS)), 'garmin')
    : pick(s.runPaceS, est, num(best10kS) ? 'best 10 km (365 d) + 4 %' : 'best 5 km (365 d) + 8 %');
  return { ftp, runLthr, rideLthr, restingHr: rest, runPaceS: runPace };
}

/** The plain values of resolveThresholds, for computeTss. */
export function thresholdValues(t) {
  return {
    ftp: t.ftp.value,
    runLthr: t.runLthr.value,
    rideLthr: t.rideLthr.value,
    restingHr: t.restingHr.value,
    runPaceS: t.runPaceS.value,
  };
}

/**
 * The parts of the streams TSS needs, and nothing that depends on a threshold: Normalized Power (W), the normalized
 * grade-adjusted speed (m/s) and the seconds at each heart rate (bpm → s). Stored per activity (tss_inputs), so a
 * new threshold recomputes every TSS without reading the streams again. Null without usable streams.
 * @param {{ time?: number[], heartrate?: (number | null)[], watts?: (number | null)[], velocity_smooth?: (number | null)[], grade_smooth?: (number | null)[] } | null} streams
 * @returns {{ np?: number, ngs?: number, hr?: Record<string, number> } | null}
 */
export function tssInputs(streams) {
  if (!streams) return null;
  const out = {};
  const time = streams.time;
  const np = streams.watts?.length ? normalizedPower(streams.watts, time) : null;
  if (np) out.np = Math.round(np * 10) / 10;
  const ngs = streams.velocity_smooth?.length ? normalizedGradedSpeed(streams.velocity_smooth, streams.grade_smooth, time) : null;
  if (ngs) out.ngs = Math.round(ngs * 1000) / 1000;
  if (streams.heartrate?.length) {
    const hist = {};
    for (let i = 0; i < streams.heartrate.length; i++) {
      const hr = streams.heartrate[i];
      if (!(hr > 0)) continue;
      const k = String(Math.round(hr));
      hist[k] = (hist[k] ?? 0) + dtAt(time, i);
    }
    if (Object.keys(hist).length) out.hr = hist;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * TSS for one activity, from its streams (tssInputs computes them) or its averages.
 * @param {Record<string, any>} a  a Strava activity (list or stored row): sport_type, moving_time, weighted_average_watts, device_watts, average_heartrate
 * @param {{ ftp?: number | null, runLthr?: number | null, rideLthr?: number | null, restingHr?: number | null, runPaceS?: number | null }} th
 * @param {Parameters<typeof tssInputs>[0]} [streams]
 * @returns {{ tss: number, method: string, intensity: number | null }}
 */
export function computeTss(a, th = {}, streams = null) {
  return tssFromInputs(a, th, tssInputs(streams));
}

/**
 * TSS for one activity from its stored tss_inputs (or null: the averages only).
 * @param {Record<string, any>} a
 * @param {{ ftp?: number | null, runLthr?: number | null, rideLthr?: number | null, restingHr?: number | null, runPaceS?: number | null }} th
 * @param {ReturnType<typeof tssInputs>} inputs
 */
export function tssFromInputs(a, th = {}, inputs = null) {
  const hours = (a.moving_time ?? a.elapsed_time ?? 0) / 3600;
  if (!(hours > 0)) return { tss: 0, method: 'duration_fallback', intensity: null };
  const family = sportFamily(a);
  const rest = th.restingHr ?? 50;
  const lthr = family === 'ride' ? th.rideLthr ?? th.runLthr ?? 163 : th.runLthr ?? 168;

  // Power: rides with a power meter only. Running power (Garmin or Stryd) against the cycling FTP counts runs far too high.
  if (family === 'ride' && a.device_watts && th.ftp > 0) {
    if (inputs?.np) return { tss: tssOf(hours, inputs.np / th.ftp), method: 'power_stream', intensity: round2(inputs.np / th.ftp) };
    if (a.weighted_average_watts) return { tss: tssOf(hours, a.weighted_average_watts / th.ftp), method: 'power', intensity: round2(a.weighted_average_watts / th.ftp) };
  }

  // Pace: runs with streams and a threshold pace.
  if (family === 'run' && th.runPaceS > 0 && inputs?.ngs) {
    const intensity = inputs.ngs / (1000 / th.runPaceS);
    return { tss: tssOf(hours, intensity), method: 'pace', intensity: round2(intensity) };
  }

  // Heart rate, per sample: the mean of the squared intensity, so hard intervals get their weight.
  if (inputs?.hr) {
    let acc = 0;
    let w = 0;
    for (const [bpm, secs] of Object.entries(inputs.hr)) {
      acc += hrIntensity(Number(bpm), lthr, rest) ** 2 * secs;
      w += secs;
    }
    if (w > 0) {
      const intensity = Math.sqrt(acc / w);
      return { tss: tssOf(hours, intensity), method: 'hr_stream', intensity: round2(intensity) };
    }
  }

  if (a.average_heartrate > 0) {
    const intensity = hrIntensity(a.average_heartrate, lthr, rest);
    return { tss: tssOf(hours, intensity), method: 'hr', intensity: round2(intensity) };
  }

  const intensity = FALLBACK_IF[a.sport_type ?? a.type] ?? 0.5;
  return { tss: tssOf(hours, intensity), method: 'duration_fallback', intensity };
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

/** A short label for a TSS method, for the activity page. */
export function tssMethodLabel(method) {
  return {
    power_stream: 'from power',
    power: 'from power',
    pace: 'from grade-adjusted pace',
    hr_stream: 'from heart rate',
    hr: 'from average heart rate',
    duration_fallback: 'estimated from time',
  }[method] ?? method;
}
