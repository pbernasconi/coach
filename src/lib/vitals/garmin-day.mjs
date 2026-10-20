// Parsers for one day of raw Garmin Connect payloads (garmin_raw, filled by scripts/garmin/sync.py), for the
// /health/day/[date] page. Pure and defensive: any missing or odd field gives null or an empty list, never an
// error, so a payload shape change empties one chart instead of breaking the page. node:test: garmin-day.test.mjs.
//
// Times: Garmin sends GMT times (epoch ms or "2026-10-18T06:12:36.0" without a zone) and, beside them, local ones.
// Each parser works out the payload's local offset and returns "local ms": epoch ms shifted by that offset. Charts
// format them with timeZone UTC, which shows the wall-clock time where the watch was. No server time zone is used.

import { toDate } from '../db-time.mjs';

/** A finite number, or null. Numeric text counts. */
export const num = (v) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const list = (v) => (Array.isArray(v) ? v : []);
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Epoch ms for a Garmin time (ms number, or GMT text without a zone), or null. */
export function gmtMs(v) {
  return toDate(v)?.getTime() ?? null;
}

/** Local offset in ms from a pair of times (local − GMT), rounded to 15 minutes; 0 when unknown. */
export function offsetOf(localV, gmtV) {
  const l = gmtMs(localV);
  const g = gmtMs(gmtV);
  if (l === null || g === null) return 0;
  const off = Math.round((l - g) / 900_000) * 900_000;
  return Math.abs(off) <= 14 * 3600_000 ? off : 0;
}

/**
 * [{ t, v }] sorted by t, from pairs or objects. Values that `keep` rejects are dropped.
 * @returns {{ t: number, v: number }[]}
 */
function points(raw, pick, offset, keep = (v) => v !== null) {
  const out = [];
  for (const item of list(raw)) {
    const [t, v] = pick(item);
    const tm = gmtMs(t);
    const val = num(v);
    if (tm === null || !keep(val)) continue;
    out.push({ t: tm + offset, v: /** @type {number} */ (val) });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Index of a key in a Garmin descriptor list ([{ key, index }] or [{ bodyBatteryValueDescriptorKey, …Index }]). */
function descriptorIndex(descriptors, key, fallback) {
  for (const d of list(descriptors)) {
    const o = obj(d);
    if (!o) continue;
    const k = o.key ?? o.bodyBatteryValueDescriptorKey ?? o.stressValueDescriptorKey;
    const i = num(o.index ?? o.bodyBatteryValueDescriptorIndex ?? o.stressValueDescriptorIndex);
    if (k === key && i !== null) return i;
  }
  return fallback;
}

export const STAGES = /** @type {const} */ (['deep', 'light', 'rem', 'awake']);
// sleepLevels.activityLevel: 0 deep, 1 light, 2 REM, 3 awake.
const STAGE_OF_LEVEL = ['deep', 'light', 'rem', 'awake'];

/**
 * get_sleep_data → the night that ends on the payload's day.
 * @returns {null | { start: number | null, end: number | null, totalMin: number | null, deepMin: number | null,
 *   lightMin: number | null, remMin: number | null, awakeMin: number | null, score: number | null, quality: string | null,
 *   awakeCount: number | null, avgStress: number | null, avgSpo2: number | null, lowestSpo2: number | null,
 *   avgRespiration: number | null, restingHr: number | null, avgHrv: number | null, bodyBatteryChange: number | null,
 *   stages: { start: number, end: number, stage: 'deep' | 'light' | 'rem' | 'awake' }[],
 *   hr: { t: number, v: number }[], stress: { t: number, v: number }[], spo2: { t: number, v: number }[],
 *   bodyBattery: { t: number, v: number }[], respiration: { t: number, v: number }[] }}
 */
export function parseSleep(payload) {
  const p = obj(payload);
  const dto = obj(p?.dailySleepDTO);
  if (!p || !dto) return null;
  const offset = offsetOf(dto.sleepStartTimestampLocal, dto.sleepStartTimestampGMT);
  const sec = (k) => (num(dto[k]) === null ? null : num(dto[k]) / 60);
  const startG = gmtMs(dto.sleepStartTimestampGMT);
  const endG = gmtMs(dto.sleepEndTimestampGMT);
  const stages = [];
  for (const s of list(p.sleepLevels)) {
    const o = obj(s);
    const a = gmtMs(o?.startGMT);
    const b = gmtMs(o?.endGMT);
    const lvl = num(o?.activityLevel);
    const stage = lvl === null ? undefined : STAGE_OF_LEVEL[Math.round(lvl)];
    if (a === null || b === null || b <= a || !stage) continue;
    stages.push({ start: a + offset, end: b + offset, stage });
  }
  stages.sort((x, y) => x.start - y.start);
  const timed = (k) => points(p[k], (o) => [obj(o)?.startGMT, obj(o)?.value], offset, (v) => v !== null && v >= 0);
  const scores = obj(dto.sleepScores);
  const totalMin = sec('sleepTimeSeconds');
  if (totalMin === null && !stages.length) return null;
  return {
    start: startG === null ? null : startG + offset,
    end: endG === null ? null : endG + offset,
    totalMin,
    deepMin: sec('deepSleepSeconds'),
    lightMin: sec('lightSleepSeconds'),
    remMin: sec('remSleepSeconds'),
    awakeMin: sec('awakeSleepSeconds'),
    score: num(obj(scores?.overall)?.value),
    quality: text(obj(scores?.overall)?.qualifierKey),
    awakeCount: num(dto.awakeCount ?? obj(scores?.awakeCount)?.value),
    avgStress: num(dto.avgSleepStress),
    avgSpo2: num(dto.averageSpO2Value),
    lowestSpo2: num(dto.lowestSpO2Value),
    avgRespiration: num(dto.averageRespirationValue),
    restingHr: num(p.restingHeartRate),
    avgHrv: num(p.avgOvernightHrv ?? dto.avgSleepHRV),
    bodyBatteryChange: num(p.bodyBatteryChange),
    stages,
    hr: timed('sleepHeartRate'),
    stress: timed('sleepStress'),
    bodyBattery: timed('sleepBodyBattery'),
    spo2: points(p.wellnessEpochSPO2DataDTOList, (o) => [obj(o)?.epochTimestamp, obj(o)?.spo2Reading], offset, (v) => v !== null && v > 0),
    respiration: points(p.wellnessEpochRespirationDataDTOList, (o) => [obj(o)?.startTimeGMT, obj(o)?.respirationValue], offset, (v) => v !== null && v > 0),
  };
}

/** Minutes per stage, from the stage list when the totals are missing. */
export function stageMinutes(sleep) {
  const m = { deep: 0, light: 0, rem: 0, awake: 0 };
  for (const s of sleep?.stages ?? []) m[s.stage] += (s.end - s.start) / 60_000;
  return {
    deep: sleep?.deepMin ?? m.deep,
    light: sleep?.lightMin ?? m.light,
    rem: sleep?.remMin ?? m.rem,
    awake: sleep?.awakeMin ?? m.awake,
  };
}

/** get_heart_rates → { resting, min, max, values: [{ t, v }] }. */
export function parseHeartRates(payload) {
  const p = obj(payload);
  if (!p) return null;
  const offset = offsetOf(p.startTimestampLocal, p.startTimestampGMT);
  const ti = descriptorIndex(p.heartRateValueDescriptors, 'timestamp', 0);
  const vi = descriptorIndex(p.heartRateValueDescriptors, 'heartrate', 1);
  const values = points(p.heartRateValues, (row) => (Array.isArray(row) ? [row[ti], row[vi]] : [null, null]), offset, (v) => v !== null && v > 0);
  return { resting: num(p.restingHeartRate), min: num(p.minHeartRate), max: num(p.maxHeartRate), values };
}

/**
 * get_stress_data → { avg, max, stress: [{ t, v }], bodyBattery: [{ t, v }] }. Stress values below 0 mean "not
 * enough data" (-1) or "activity" (-2) and are dropped.
 */
export function parseStress(payload) {
  const p = obj(payload);
  if (!p) return null;
  const offset = offsetOf(p.startTimestampLocal, p.startTimestampGMT);
  const si = descriptorIndex(p.stressValueDescriptorsDTOList, 'stressLevel', 1);
  const stress = points(p.stressValuesArray, (row) => (Array.isArray(row) ? [row[0], row[si]] : [null, null]), offset, (v) => v !== null && v >= 0 && v <= 100);
  const bi = descriptorIndex(p.bodyBatteryValueDescriptorsDTOList ?? p.bodyBatteryValueDescriptorDTOList, 'bodyBatteryLevel', 2);
  const bodyBattery = points(
    p.bodyBatteryValuesArray,
    (row) => (Array.isArray(row) ? [row[0], row.length > bi ? row[bi] : row[row.length - 1]] : [null, null]),
    offset,
    (v) => v !== null && v >= 0 && v <= 100
  );
  return { avg: num(p.avgStressLevel) !== null && num(p.avgStressLevel) >= 0 ? num(p.avgStressLevel) : null, max: num(p.maxStressLevel), stress, bodyBattery };
}

/** get_body_battery (a list of days) → [{ t, v }] for the day `date`, or every day when it is not found. */
export function parseBodyBattery(payload, date) {
  const days = Array.isArray(payload) ? payload : obj(payload) ? [payload] : [];
  const day = days.find((d) => obj(d)?.date === date) ?? (days.length === 1 ? days[0] : null);
  const o = obj(day);
  if (!o) return [];
  const offset = offsetOf(o.startTimestampLocal, o.startTimestampGMT);
  const bi = descriptorIndex(o.bodyBatteryValueDescriptorDTOList ?? o.bodyBatteryValueDescriptorsDTOList, 'bodyBatteryLevel', -1);
  return points(o.bodyBatteryValuesArray, (row) => (Array.isArray(row) ? [row[0], bi >= 0 ? row[bi] : row[row.length - 1]] : [null, null]), offset, (v) => v !== null && v >= 0 && v <= 100);
}

const EVENT_LABEL = { SLEEP: 'Sleep', ACTIVITY: 'Activity', NAP: 'Nap', RECOVERY: 'Rest', STRESS: 'Stress', MEDITATION: 'Meditation' };

/** get_body_battery_events → [{ start, end, type, label, impact, feedback }] in local ms. */
export function parseBodyBatteryEvents(payload) {
  const out = [];
  for (const item of list(payload)) {
    const o = obj(item);
    const e = obj(o?.event) ?? o;
    const start = gmtMs(e?.eventStartTimeGmt ?? e?.startTimestampGMT);
    if (start === null) continue;
    const offset = num(e.timezoneOffset) ?? 0;
    const duration = num(e.durationInMilliseconds) ?? 0;
    const type = text(e.eventType)?.toUpperCase() ?? 'EVENT';
    out.push({
      start: start + offset,
      end: start + offset + Math.max(0, duration),
      type,
      label: text(o?.activityName) ?? EVENT_LABEL[type] ?? type.charAt(0) + type.slice(1).toLowerCase(),
      impact: num(e.bodyBatteryImpact),
      feedback: text(e.shortFeedback ?? e.feedbackType),
    });
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * get_hrv_data → the night's readings and Garmin's baseline band.
 * @returns {null | { readings: { t: number, v: number }[], lastNightAvg: number | null, lastNight5MinHigh: number | null,
 *   weeklyAvg: number | null, status: string | null, baseline: { low: number, high: number } | null, lowUpper: number | null }}
 */
export function parseHrv(payload) {
  const p = obj(payload);
  if (!p) return null;
  const s = obj(p.hrvSummary);
  const offset = offsetOf(p.startTimestampLocal, p.startTimestampGMT);
  const b = obj(s?.baseline);
  const low = num(b?.balancedLow);
  const high = num(b?.balancedUpper);
  const readings = points(p.hrvReadings, (o) => [obj(o)?.readingTimeGMT, obj(o)?.hrvValue], offset, (v) => v !== null && v > 0);
  if (!s && !readings.length) return null;
  return {
    readings,
    lastNightAvg: num(s?.lastNightAvg),
    lastNight5MinHigh: num(s?.lastNight5MinHigh),
    weeklyAvg: num(s?.weeklyAvg),
    status: text(s?.status),
    baseline: low !== null && high !== null && high > low ? { low, high } : null,
    lowUpper: num(b?.lowUpper),
  };
}

const FACTORS = [
  ['sleepScoreFactorPercent', 'sleepScoreFactorFeedback', 'Sleep score'],
  ['recoveryTimeFactorPercent', 'recoveryTimeFactorFeedback', 'Recovery time'],
  ['acwrFactorPercent', 'acwrFactorFeedback', 'Acute load'],
  ['hrvFactorPercent', 'hrvFactorFeedback', 'HRV status'],
  ['sleepHistoryFactorPercent', 'sleepHistoryFactorFeedback', 'Sleep history'],
  ['stressHistoryFactorPercent', 'stressHistoryFactorFeedback', 'Stress history'],
];

/** "MODERATE" → "Moderate", "VERY_GOOD" → "Very good". */
export const words = (s) => (typeof s === 'string' && s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : null);

/**
 * get_training_readiness (a list over the day) → the newest score, and the factors from the newest entry that has
 * them (the morning one usually does).
 * @returns {null | { score: number | null, level: string | null, at: number | null, feedback: string | null,
 *   recoveryTimeH: number | null, acuteLoad: number | null, sleepScore: number | null,
 *   factors: { key: string, label: string, percent: number, feedback: string | null }[] }}
 */
export function parseReadiness(payload) {
  const entries = (Array.isArray(payload) ? payload : [payload]).map(obj).filter(Boolean);
  if (!entries.length) return null;
  const at = (e) => gmtMs(e.timestamp) ?? 0;
  const sorted = [...entries].sort((a, b) => at(b) - at(a));
  const latest = sorted.find((e) => num(e.score) !== null) ?? sorted[0];
  const withFactors = sorted.find((e) => FACTORS.some(([k]) => num(e[k]) !== null)) ?? latest;
  const offset = offsetOf(latest.timestampLocal, latest.timestamp);
  const factors = FACTORS.flatMap(([k, f, label]) =>
    num(withFactors[k]) === null ? [] : [{ key: k, label, percent: Math.max(0, Math.min(100, num(withFactors[k]))), feedback: words(text(withFactors[f])) }]
  );
  const recovery = num(withFactors.recoveryTime ?? latest.recoveryTime);
  return {
    score: num(latest.score),
    level: words(text(latest.level)),
    at: at(latest) ? at(latest) + offset : null,
    feedback: text(latest.feedbackShort),
    recoveryTimeH: recovery === null ? null : recovery / 60,
    acuteLoad: num(withFactors.acuteLoad ?? latest.acuteLoad),
    sleepScore: num(withFactors.sleepScore),
    factors,
  };
}

/** get_user_summary → the day's totals. Garmin's -1 and -2 stress values become null. */
export function parseSummary(payload) {
  const p = obj(payload);
  if (!p) return null;
  const stress = num(p.averageStressLevel);
  return {
    steps: num(p.totalSteps),
    stepGoal: num(p.dailyStepGoal),
    distanceKm: num(p.totalDistanceMeters) === null ? null : num(p.totalDistanceMeters) / 1000,
    moderateMin: num(p.moderateIntensityMinutes),
    vigorousMin: num(p.vigorousIntensityMinutes),
    intensityGoal: num(p.intensityMinutesGoal),
    floors: num(p.floorsAscended),
    activeKcal: num(p.activeKilocalories),
    restingHr: num(p.restingHeartRate),
    minHr: num(p.minHeartRate),
    maxHr: num(p.maxHeartRate),
    avgStress: stress !== null && stress >= 0 ? stress : null,
    maxStress: num(p.maxStressLevel),
    bodyBatteryHigh: num(p.bodyBatteryHighestValue),
    bodyBatteryLow: num(p.bodyBatteryLowestValue),
    bodyBatteryCharged: num(p.bodyBatteryChargedValue),
    bodyBatteryDrained: num(p.bodyBatteryDrainedValue),
  };
}

/** garmin_raw kinds the day page reads, and the other names a kind may have (the first one present wins). */
export const KIND_ALIASES = {
  sleep: ['sleep', 'sleep_data'],
  heart_rates: ['heart_rates', 'heart_rate', 'heartrate'],
  stress: ['stress', 'stress_data', 'all_day_stress'],
  body_battery: ['body_battery'],
  body_battery_events: ['body_battery_events'],
  hrv: ['hrv', 'hrv_data'],
  readiness: ['readiness', 'training_readiness'],
  summary: ['summary', 'user_summary'],
};

/**
 * Everything the day page shows, from the raw payloads of one day keyed by kind. Kinds that are missing give null.
 * @param {Record<string, unknown>} raw
 * @param {string} date
 */
export function parseDay(raw, date) {
  const r = obj(raw) ?? {};
  const kind = (k) => r[KIND_ALIASES[k].find((a) => r[a] != null) ?? k];
  const stress = parseStress(kind('stress'));
  let bodyBattery = stress?.bodyBattery ?? [];
  if (!bodyBattery.length) bodyBattery = parseBodyBattery(kind('body_battery'), date);
  return {
    date,
    sleep: parseSleep(kind('sleep')),
    heartRate: parseHeartRates(kind('heart_rates')),
    stress: stress?.stress ?? [],
    stressAvg: stress?.avg ?? null,
    bodyBattery,
    events: parseBodyBatteryEvents(kind('body_battery_events')),
    hrv: parseHrv(kind('hrv')),
    readiness: parseReadiness(kind('readiness')),
    summary: parseSummary(kind('summary')),
  };
}
