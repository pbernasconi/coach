// The closed set of daily vitals that Coach stores (COACH-API.md, Health). Garmin Connect (the GitHub Actions job)
// and Apple Health (the Lift app, later) both push them to POST /api/vitals/sync. Each metric has one canonical unit
// and a plausible range. A sample outside the range is rejected, so a unit mistake (pounds sent as kg, a 0-1
// fraction sent as a percent) cannot reach the database.

/** @typedef {'hrv_night_avg_ms' | 'hrv_weekly_avg_ms' | 'hrv_status' | 'hrv_sdnn_ms' | 'resting_hr_bpm' | 'resting_hr_7d_avg_bpm' | 'sleep_total_min' | 'sleep_deep_min' | 'sleep_rem_min' | 'sleep_core_min' | 'sleep_awake_min' | 'sleep_score' | 'body_battery_high' | 'body_battery_low' | 'stress_avg' | 'training_readiness' | 'steps' | 'active_energy_kcal' | 'weight_kg' | 'body_fat_pct' | 'vo2max' | 'respiratory_rate' | 'spo2_pct' | 'wrist_temp_delta_c' | 'sleep_avg_hr_bpm' | 'sleep_avg_stress' | 'sleep_awake_count' | 'hrv_baseline_low_ms' | 'hrv_baseline_high_ms' | 'readiness_sleep_factor' | 'readiness_hrv_factor' | 'readiness_recovery_time_h' | 'readiness_acute_load' | 'intensity_minutes_moderate' | 'intensity_minutes_vigorous' | 'floors_climbed' | 'training_load_acute' | 'training_load_chronic' | 'training_load_ratio' | 'load_focus_anaerobic' | 'load_focus_high_aerobic' | 'load_focus_low_aerobic' | 'training_status' | 'endurance_score' | 'hill_score' | 'race_pred_5k_s' | 'race_pred_10k_s' | 'race_pred_half_s' | 'race_pred_marathon_s' | 'lactate_threshold_hr_bpm' | 'lactate_threshold_pace_s_per_km' | 'cycling_ftp_w' | 'fitness_age' | 'vo2max_cycling' | 'wear_min'} VitalMetric */

/** @type {Record<VitalMetric, { unit: string, min: number, max: number, label: string, integer?: boolean }>} */
export const METRICS = {
  hrv_night_avg_ms: { unit: 'ms', min: 1, max: 500, label: 'HRV (RMSSD), overnight average' },
  hrv_weekly_avg_ms: { unit: 'ms', min: 1, max: 500, label: 'HRV (RMSSD), 7-day average' },
  hrv_status: { unit: 'code', min: 0, max: 4, integer: true, label: 'HRV status' },
  hrv_sdnn_ms: { unit: 'ms', min: 1, max: 500, label: 'HRV (SDNN)' },
  resting_hr_bpm: { unit: 'bpm', min: 20, max: 150, label: 'Resting heart rate' },
  resting_hr_7d_avg_bpm: { unit: 'bpm', min: 20, max: 150, label: 'Resting heart rate, 7-day average' },
  sleep_total_min: { unit: 'min', min: 0, max: 1440, label: 'Sleep' },
  sleep_deep_min: { unit: 'min', min: 0, max: 1440, label: 'Deep sleep' },
  sleep_rem_min: { unit: 'min', min: 0, max: 1440, label: 'REM sleep' },
  sleep_core_min: { unit: 'min', min: 0, max: 1440, label: 'Core (light) sleep' },
  sleep_awake_min: { unit: 'min', min: 0, max: 1440, label: 'Awake in bed' },
  sleep_score: { unit: 'score', min: 0, max: 100, label: 'Sleep score' },
  body_battery_high: { unit: 'score', min: 0, max: 100, label: 'Body Battery, high' },
  body_battery_low: { unit: 'score', min: 0, max: 100, label: 'Body Battery, low' },
  stress_avg: { unit: 'score', min: 0, max: 100, label: 'Average stress' },
  training_readiness: { unit: 'score', min: 0, max: 100, label: 'Training readiness' },
  steps: { unit: 'count', min: 0, max: 200000, label: 'Steps' },
  active_energy_kcal: { unit: 'kcal', min: 0, max: 20000, label: 'Active energy' },
  weight_kg: { unit: 'kg', min: 20, max: 400, label: 'Weight' },
  body_fat_pct: { unit: '%', min: 1, max: 80, label: 'Body fat' },
  vo2max: { unit: 'mL/kg/min', min: 10, max: 100, label: 'VO2max (running)' },
  vo2max_cycling: { unit: 'mL/kg/min', min: 10, max: 100, label: 'VO2max (cycling)' },
  respiratory_rate: { unit: 'breaths/min', min: 4, max: 60, label: 'Respiratory rate' },
  spo2_pct: { unit: '%', min: 50, max: 100, label: 'Blood oxygen' },
  wrist_temp_delta_c: { unit: 'degC', min: -5, max: 5, label: 'Wrist temperature' },
  // Sleep detail (Garmin dailySleepDTO).
  sleep_avg_hr_bpm: { unit: 'bpm', min: 20, max: 200, label: 'Average heart rate in sleep' },
  sleep_avg_stress: { unit: 'score', min: 0, max: 100, label: 'Average stress in sleep' },
  sleep_awake_count: { unit: 'count', min: 0, max: 200, integer: true, label: 'Times awake' },
  // HRV baseline: Garmin's balanced range for the user.
  hrv_baseline_low_ms: { unit: 'ms', min: 1, max: 500, label: 'HRV baseline, low' },
  hrv_baseline_high_ms: { unit: 'ms', min: 1, max: 500, label: 'HRV baseline, high' },
  // Training readiness factors (the morning value).
  readiness_sleep_factor: { unit: '%', min: 0, max: 100, label: 'Readiness: sleep factor' },
  readiness_hrv_factor: { unit: '%', min: 0, max: 100, label: 'Readiness: HRV factor' },
  readiness_recovery_time_h: { unit: 'h', min: 0, max: 200, label: 'Recovery time' },
  readiness_acute_load: { unit: 'load', min: 0, max: 5000, label: 'Readiness: acute load' },
  // Daily activity.
  intensity_minutes_moderate: { unit: 'min', min: 0, max: 1440, integer: true, label: 'Moderate intensity minutes' },
  intensity_minutes_vigorous: { unit: 'min', min: 0, max: 1440, integer: true, label: 'Vigorous intensity minutes' },
  floors_climbed: { unit: 'floors', min: 0, max: 2000, label: 'Floors climbed' },
  // Training status (Garmin's performance pages).
  training_load_acute: { unit: 'load', min: 0, max: 5000, label: 'Acute training load' },
  training_load_chronic: { unit: 'load', min: 0, max: 5000, label: 'Chronic training load' },
  training_load_ratio: { unit: 'ratio', min: 0, max: 10, label: 'Acute:chronic load ratio' },
  load_focus_anaerobic: { unit: 'load', min: 0, max: 20000, label: '4-week load: anaerobic' },
  load_focus_high_aerobic: { unit: 'load', min: 0, max: 20000, label: '4-week load: high aerobic' },
  load_focus_low_aerobic: { unit: 'load', min: 0, max: 20000, label: '4-week load: low aerobic' },
  training_status: { unit: 'code', min: 0, max: 9, integer: true, label: 'Training status' },
  endurance_score: { unit: 'score', min: 0, max: 15000, integer: true, label: 'Endurance score' },
  hill_score: { unit: 'score', min: 0, max: 100, integer: true, label: 'Hill score' },
  race_pred_5k_s: { unit: 's', min: 300, max: 86400, label: 'Race prediction: 5K' },
  race_pred_10k_s: { unit: 's', min: 300, max: 86400, label: 'Race prediction: 10K' },
  race_pred_half_s: { unit: 's', min: 300, max: 86400, label: 'Race prediction: half marathon' },
  race_pred_marathon_s: { unit: 's', min: 300, max: 86400, label: 'Race prediction: marathon' },
  lactate_threshold_hr_bpm: { unit: 'bpm', min: 60, max: 230, label: 'Lactate threshold heart rate' },
  lactate_threshold_pace_s_per_km: { unit: 's/km', min: 120, max: 900, label: 'Lactate threshold pace' },
  cycling_ftp_w: { unit: 'W', min: 20, max: 700, label: 'Cycling FTP' },
  fitness_age: { unit: 'years', min: 10, max: 120, label: 'Fitness age' },
  // Minutes the watch recorded heart rate. 0: synced, not worn. No row: not synced.
  wear_min: { unit: 'min', min: 0, max: 1440, integer: true, label: 'Watch worn' },
};

/** @type {VitalMetric[]} */
export const METRIC_IDS = /** @type {VitalMetric[]} */ (Object.keys(METRICS));

/** @param {unknown} m @returns {m is VitalMetric} */
export const isMetric = (m) => typeof m === 'string' && Object.hasOwn(METRICS, m);

/** hrv_status values: Garmin's HRV status as a code. */
export const HRV_STATUS = ['none', 'poor', 'low', 'unbalanced', 'balanced'];

/**
 * training_status values: Coach's code, made from Garmin's trainingStatusFeedbackPhrase ("PRODUCTIVE_9" is 5).
 * scripts/garmin/mapping.py TRAINING_STATUS_CODES is the other half; the contract test checks that they match.
 */
export const TRAINING_STATUS = ['no status', 'detraining', 'recovery', 'maintaining', 'unproductive', 'productive', 'peaking', 'overreaching', 'strained', 'paused'];
