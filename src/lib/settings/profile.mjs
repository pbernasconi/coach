// @ts-check
/**
 * The athlete's profile in users.settings.profile: birth date, height and sex. The scale bridge's body fat formula
 * uses the same three (set on the board, devices/scale-bridge/include/config.h), and so do age-based ranges.
 */

/** @typedef {{ birthDate: string | null, heightCm: number | null, sex: 'male' | 'female' | null }} Profile */

/**
 * A clean profile from anything: a real date between 1900 and `today`, a height of 100–250 cm (to 0.5 cm), and
 * male or female. Anything else is null.
 * @param {unknown} raw @param {string} today YYYY-MM-DD
 * @returns {Profile}
 */
export function profileFrom(raw, today) {
  const r = /** @type {Record<string, unknown>} */ (raw && typeof raw === 'object' ? raw : {});
  const d = typeof r.birthDate === 'string' ? r.birthDate.trim() : '';
  const real = /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
  const birthDate = real && d >= '1900-01-01' && d <= today ? d : null;
  const h = r.heightCm === '' || r.heightCm == null ? NaN : Number(r.heightCm);
  const heightCm = Number.isFinite(h) && h >= 100 && h <= 250 ? Math.round(h * 2) / 2 : null;
  const sex = r.sex === 'male' || r.sex === 'female' ? r.sex : null;
  return { birthDate, heightCm, sex };
}

/**
 * Whole years from `birthDate` to `today` (both YYYY-MM-DD), or null without a birth date.
 * @param {string | null} birthDate @param {string} today
 */
export function ageOn(birthDate, today) {
  if (!birthDate) return null;
  const years = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return today.slice(5) < birthDate.slice(5) ? years - 1 : years;
}
