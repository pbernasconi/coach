// Number formats for the activity page. A plain module (no 'use client'), so server and client components share it.

/** Seconds as h:mm:ss or m:ss. */
export function duration(totalSeconds) {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return '–';
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Pace per km (m:ss) for a speed in m/s. */
export function pace(speed) {
  if (!(speed > 0.3)) return '–';
  return duration(1000 / speed);
}

/** Seconds per km as m:ss. */
export function paceOfSeconds(secPerKm) {
  return secPerKm > 0 ? duration(secPerKm) : '–';
}

/** km/h with one decimal for a speed in m/s. */
export function kmh(speed) {
  return speed > 0 ? (speed * 3.6).toFixed(1) : '–';
}

/** Kilometers with two decimals (one at 100 km and more), rounded down as Strava shows them. */
export function km(meters) {
  if (!(meters > 0)) return '0';
  const k = meters / 1000;
  return k >= 100 ? (Math.floor(k * 10) / 10).toFixed(1) : (Math.floor(k * 100) / 100).toFixed(2);
}

/** A whole number with thousands separators, or '–'. */
export function int(n) {
  return n == null || !Number.isFinite(Number(n)) ? '–' : Math.round(Number(n)).toLocaleString('en-US');
}

/** '+3', '−2', '0'. */
export function signed(n, digits = 0) {
  if (n == null || !Number.isFinite(n)) return '–';
  const v = Number(n.toFixed(digits));
  return v > 0 ? `+${v.toFixed(digits)}` : v < 0 ? `−${Math.abs(v).toFixed(digits)}` : (0).toFixed(digits);
}

/** Strava's names for the 5 heart-rate zones and the 7 power zones. */
export const HR_ZONE_NAMES = ['Endurance', 'Moderate', 'Tempo', 'Threshold', 'Anaerobic'];
export const POWER_ZONE_NAMES = ['Active Recovery', 'Endurance', 'Tempo', 'Threshold', 'VO2 Max', 'Anaerobic', 'Neuromuscular'];

/** A zone range as text: '122–153', '182+'. */
/** A zone's range as Strava shows it: "< 122", "123–153", "> 183" (an edge value belongs to the lower zone). */
export function zoneRange(min, max, unit = '') {
  const u = unit ? ` ${unit}` : '';
  if (max === -1 || max == null) return `> ${min + 1}${u}`;
  if (!min) return `< ${max}${u}`;
  return `${min + 1}–${max}${u}`;
}

/**
 * Whole percentages that add up to 100 (largest remainder), for values that do not all equal 0. All zero: all 0.
 * @param {number[]} values
 */
export function percents(values) {
  const total = values.reduce((n, v) => n + Math.max(0, v || 0), 0);
  if (!(total > 0)) return values.map(() => 0);
  const raw = values.map((v) => (Math.max(0, v || 0) / total) * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((n, v) => n + v, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i] += 1;
    left -= 1;
  }
  return out;
}
