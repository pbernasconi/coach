// @ts-check
/**
 * The watch's own numbers for an activity: Garmin Connect's record of the same workout (garmin_activities, stored
 * by scripts/garmin/activities.py), matched to the Strava activity by start time. Strava does not carry these:
 * training effect, Garmin's training load, running dynamics, stamina, respiration, Body Battery, performance
 * condition. No framework or database imports (node --test).
 */

/** A Strava and a Garmin activity are the same workout when they start within this many seconds. */
export const MATCH_SECONDS = 120;

const MAX_ACTIVITIES = 20;
const MAX_ITEM_BYTES = 900_000;

const num = (/** @type {unknown} */ v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Validates POST /api/vitals/garmin/activities. Returns the rows to store, or an error.
 * @param {unknown} body
 * @returns {{ rows: Array<{ id: string, startUtc: string, type: string | null, summary: string | null, detail: string | null, series: string | null }>, rejected: Array<{ index: number, reason: string }> } | { error: string }}
 */
export function parseActivityPush(body) {
  const list = body && typeof body === 'object' && !Array.isArray(body) ? /** @type {Record<string, unknown>} */ (body).activities : undefined;
  if (!Array.isArray(list)) return { error: 'activities must be an array' };
  if (list.length > MAX_ACTIVITIES) return { error: `at most ${MAX_ACTIVITIES} activities per request` };
  const rows = [];
  const rejected = [];
  for (const [index, a] of list.entries()) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) { rejected.push({ index, reason: 'not an object' }); continue; }
    const id = String(a.id ?? '');
    if (!/^\d{1,20}$/.test(id)) { rejected.push({ index, reason: 'id must be digits' }); continue; }
    const start = typeof a.startUtc === 'string' ? Date.parse(a.startUtc) : NaN;
    if (!Number.isFinite(start) || start < Date.UTC(2000, 0, 1) || start > Date.now() + 86_400_000) {
      rejected.push({ index, reason: 'startUtc must be an ISO time, not in the future' });
      continue;
    }
    const json = (/** @type {unknown} */ v) => (v && typeof v === 'object' ? JSON.stringify(v) : null);
    const summary = json(a.summary);
    const detail = json(a.detail);
    const series = json(a.series);
    const size = (summary?.length ?? 0) + (detail?.length ?? 0) + (series?.length ?? 0);
    // Postgres jsonb cannot hold U+0000.
    if ([summary, detail, series].some((t) => t?.includes('\\u0000'))) { rejected.push({ index, reason: 'contains U+0000' }); continue; }
    if (size > MAX_ITEM_BYTES) { rejected.push({ index, reason: 'too big' }); continue; }
    rows.push({ id, startUtc: new Date(start).toISOString(), type: typeof a.type === 'string' ? a.type.slice(0, 60) : null, summary, detail, series });
  }
  return { rows, rejected };
}

/** 'LACTATE_THRESHOLD' → 'Lactate threshold'. */
function labelOf(/** @type {unknown} */ v) {
  if (typeof v !== 'string' || !v.trim()) return null;
  const t = v.trim().toLowerCase().replace(/_/g, ' ');
  return t === 'vo2max' ? 'VO2max' : t[0].toUpperCase() + t.slice(1);
}

/** The first value of a series after `fromS` seconds that is a number. */
function firstAfter(/** @type {any} */ series, /** @type {string} */ key, fromS = 0) {
  const t = series?.t;
  const v = series?.[key];
  if (!Array.isArray(t) || !Array.isArray(v)) return null;
  for (let i = 0; i < v.length; i++) if ((num(t[i]) ?? 0) >= fromS && num(v[i]) != null) return v[i];
  return null;
}

/**
 * The watch's values from a garmin_activities row. Garmin's list item has flat names (aerobicTrainingEffect,
 * avgGroundContactTime); the activity page has them under summaryDTO (trainingEffect, groundContactTime). Each
 * field takes the first one that is a number.
 * @param {{ summary?: any, detail?: any, series?: any, garmin_activity_id?: string } | null} row
 */
export function watchValues(row) {
  if (!row) return null;
  const s = row.summary ?? {};
  const d = row.detail?.summaryDTO ?? {};
  const pick = (/** @type {unknown[]} */ ...vs) => { for (const v of vs) { const n = num(v); if (n != null) return n; } return null; };
  const stride = pick(s.avgStrideLength, d.strideLength);
  const out = {
    garminId: row.garmin_activity_id ? String(row.garmin_activity_id) : null,
    aerobicTe: pick(s.aerobicTrainingEffect, d.trainingEffect, d.aerobicTrainingEffect),
    anaerobicTe: pick(s.anaerobicTrainingEffect, d.anaerobicTrainingEffect),
    teLabel: labelOf(s.trainingEffectLabel ?? d.trainingEffectLabel),
    load: pick(s.activityTrainingLoad, d.activityTrainingLoad),
    vo2max: pick(s.vO2MaxValue, d.vO2MaxValue),
    gctMs: pick(s.avgGroundContactTime, d.groundContactTime),
    verticalOscCm: pick(s.avgVerticalOscillation, d.verticalOscillation),
    verticalRatioPct: pick(s.avgVerticalRatio, d.verticalRatio),
    // Garmin sends stride length in cm.
    strideM: stride == null ? null : stride > 5 ? stride / 100 : stride,
    powerW: pick(s.avgPower, d.averagePower),
    respirationBrpm: pick(s.avgRespirationRate, d.avgRespirationRate, d.averageRespirationRate),
    staminaStart: pick(s.beginPotentialStamina, d.beginPotentialStamina),
    staminaEnd: pick(s.endPotentialStamina, d.endPotentialStamina),
    bodyBatteryDelta: pick(s.differenceBodyBattery, d.differenceBodyBattery),
    // Garmin shows performance condition after 6 minutes.
    performanceCondition: num(firstAfter(row.series, 'directPerformanceCondition', 360)),
  };
  return Object.values(out).some((v) => v != null && typeof v !== 'string') ? out : null;
}

const r1 = (/** @type {number} */ v) => (Math.round(v * 10) / 10).toFixed(1);

/**
 * The watch's stats as overview tiles ({ label, valueText, unit? }), after Strava's. Running dynamics only for
 * runs; power only when Strava has none (Strava shows the same watch power for most runs).
 * @param {ReturnType<typeof watchValues>} w
 * @param {{ foot: boolean, stravaPower: boolean }} opts
 */
export function watchStats(w, { foot, stravaPower }) {
  if (!w) return [];
  /** @type {Array<{ label: string, valueText: string, unit?: string } | false | null>} */
  const rows = [
    // Short values: a tile holds about 12 characters. Aerobic / anaerobic, the label in the tile's title.
    w.aerobicTe != null && {
      label: `Training Effect${w.teLabel ? ` · ${w.teLabel}` : ''}`,
      valueText: w.anaerobicTe != null ? `${r1(w.aerobicTe)} / ${r1(w.anaerobicTe)}` : r1(w.aerobicTe),
    },
    w.load != null && { label: 'Garmin Load', valueText: String(Math.round(w.load)) },
    w.performanceCondition != null && { label: 'Performance Condition', valueText: `${w.performanceCondition > 0 ? '+' : ''}${Math.round(w.performanceCondition)}` },
    w.vo2max != null && { label: 'VO2max', valueText: String(Math.round(w.vo2max)) },
    foot && w.gctMs != null && { label: 'Ground Contact', valueText: String(Math.round(w.gctMs)), unit: 'ms' },
    foot && w.verticalOscCm != null && { label: 'Vertical Oscillation', valueText: r1(w.verticalOscCm), unit: 'cm' },
    foot && w.verticalRatioPct != null && { label: 'Vertical Ratio', valueText: r1(w.verticalRatioPct), unit: '%' },
    foot && w.strideM != null && { label: 'Stride Length', valueText: w.strideM.toFixed(2), unit: 'm' },
    !stravaPower && w.powerW != null && { label: 'Avg Power', valueText: String(Math.round(w.powerW)), unit: 'W' },
    w.respirationBrpm != null && { label: 'Respiration', valueText: String(Math.round(w.respirationBrpm)), unit: 'brpm' },
    w.staminaStart != null && w.staminaEnd != null && { label: 'Stamina', valueText: `${Math.round(w.staminaStart)} → ${Math.round(w.staminaEnd)}`, unit: '%' },
    // Garmin sends the change during the activity (negative: drained).
    w.bodyBatteryDelta != null && {
      label: w.bodyBatteryDelta <= 0 ? 'Body Battery Used' : 'Body Battery Gained',
      valueText: String(Math.abs(Math.round(w.bodyBatteryDelta))),
    },
  ];
  return /** @type {Array<{ label: string, valueText: string, unit?: string }>} */ (rows.filter(Boolean));
}

/**
 * The feel and perceived effort logged on the watch after a workout, on Coach's scales, or null. Garmin stores the
 * feel as 0, 25, 50, 75 or 100 (very weak … very strong) and the RPE as 10 to 100.
 * @param {{ summary?: any, detail?: any } | null} row
 * @returns {{ feel: number | null, rpe: number | null } | null}
 */
export function watchFeedback(row) {
  if (!row) return null;
  const s = row.summary ?? {};
  const d = row.detail?.summaryDTO ?? {};
  const first = (/** @type {unknown[]} */ ...vs) => { for (const v of vs) { const n = num(v); if (n != null) return n; } return null; };
  const feelRaw = first(d.directWorkoutFeel, s.directWorkoutFeel, s.workoutFeel);
  const rpeRaw = first(d.directWorkoutRpe, s.directWorkoutRpe, s.workoutRpe);
  const feel = feelRaw != null && feelRaw >= 0 && feelRaw <= 100 ? Math.round(feelRaw / 25) + 1 : null;
  const rpe = rpeRaw != null && rpeRaw >= 5 && rpeRaw <= 100 ? Math.min(10, Math.max(1, Math.round(rpeRaw / 10))) : null;
  return feel == null && rpe == null ? null : { feel, rpe };
}
