// @ts-check
/**
 * Healthy ranges for DEXA measures by sex and age, for /health/dexa. Each range cites its source; a measure with no
 * well-sourced cut-off (visceral fat in kg) has none here and is shown as a trend only.
 *
 * - Body fat %: Gallagher et al., "Healthy percentage body fat ranges", Am J Clin Nutr 2000;72:694–701 (DEXA, by sex
 *   and age band; the ranges match BMI 18.5 / 25 / 30).
 * - Low fat-free mass index: ESPEN malnutrition criteria, Cederholm et al., Clin Nutr 2015 (FFMI < 17 men, < 15 women).
 * - Drug-free FFMI ceiling: Kouri et al., Clin J Sport Med 1995 (about 25 kg/m² in men).
 * - Low appendicular lean mass index: EWGSOP2, Cruz-Jentoft et al., Age Ageing 2019 (ALMI < 7.0 men, < 5.5 women).
 * - Bone density: ISCD, a Z-score of −2.0 or lower is "below the expected range for age" (before age 50).
 */

/** @typedef {'good' | 'warn' | 'bad' | 'neutral' | 'strong'} Tone */
/** @typedef {{ from: number, to: number, tone: Tone, label: string }} Zone */
/**
 * @typedef {{ key: string, label: string, unit: string, digits: number, min: number, max: number, zones: Zone[],
 *   source: string }} HealthRange
 */

/**
 * Gallagher 2000 body fat % cut-offs [underfat below, healthy below, overweight below] by sex and age band.
 * @type {Record<'male' | 'female', { maxAge: number, cuts: [number, number, number] }[]>}
 */
const BODY_FAT = {
  male: [{ maxAge: 39, cuts: [8, 20, 25] }, { maxAge: 59, cuts: [11, 22, 28] }, { maxAge: 200, cuts: [13, 25, 30] }],
  female: [{ maxAge: 39, cuts: [21, 33, 39] }, { maxAge: 59, cuts: [23, 34, 40] }, { maxAge: 200, cuts: [24, 36, 42] }],
};

/** @param {string | null} gender @returns {'male' | 'female'} */
const sexOf = (gender) => (gender?.toLowerCase().startsWith('f') ? 'female' : 'male');

/**
 * The body fat % zones for a sex and age (Gallagher 2000). Ages under 20 use the 20–39 band.
 * @param {string | null} gender
 * @param {number | null} age
 * @returns {HealthRange}
 */
export function bodyFatRange(gender, age) {
  const sex = sexOf(gender);
  const band = BODY_FAT[sex].find((b) => (age ?? 30) <= b.maxAge) ?? BODY_FAT[sex][0];
  const [under, healthy, over] = band.cuts;
  const ages = band.maxAge === 39 ? '20–39' : band.maxAge === 59 ? '40–59' : '60+';
  return {
    key: 'fatPct', label: 'Body fat', unit: '%', digits: 1, min: Math.max(0, under - 5), max: over + 12,
    zones: [
      { from: Math.max(0, under - 5), to: under, tone: 'neutral', label: 'Low' },
      { from: under, to: healthy, tone: 'good', label: 'Healthy' },
      { from: healthy, to: over, tone: 'warn', label: 'Over' },
      { from: over, to: over + 12, tone: 'bad', label: 'Obese' },
    ],
    source: `${sex === 'male' ? 'Men' : 'Women'} ${ages}, Gallagher 2000`,
  };
}

/**
 * The healthy ranges shown for one scan, in display order.
 * @param {{ gender: string | null, age: number | null }} who
 * @returns {HealthRange[]}
 */
export function healthRanges({ gender, age }) {
  const male = sexOf(gender) === 'male';
  const lowFfmi = male ? 17 : 15;
  const lowAlmi = male ? 7 : 5.5;
  return [
    bodyFatRange(gender, age),
    {
      key: 'ffmi', label: 'Lean mass for height (FFMI)', unit: 'kg/m²', digits: 1, min: lowFfmi - 3, max: 27,
      zones: [
        { from: lowFfmi - 3, to: lowFfmi, tone: 'bad', label: 'Low' },
        { from: lowFfmi, to: 25, tone: 'good', label: 'Healthy' },
        { from: 25, to: 27, tone: 'strong', label: 'Above natural ceiling' },
      ],
      source: `Low below ${lowFfmi} (ESPEN 2015); drug-free ceiling about 25 (Kouri 1995)`,
    },
    {
      key: 'almi', label: 'Arm and leg muscle (ALMI)', unit: 'kg/m²', digits: 2, min: lowAlmi - 2, max: lowAlmi + 4.5,
      zones: [
        { from: lowAlmi - 2, to: lowAlmi, tone: 'bad', label: 'Low' },
        { from: lowAlmi, to: lowAlmi + 4.5, tone: 'good', label: 'Healthy' },
      ],
      source: `Low below ${lowAlmi} (EWGSOP2 2019)`,
    },
    {
      key: 'boneZ', label: 'Bone density for age', unit: 'Z', digits: 1, min: -3, max: 3,
      zones: [
        { from: -3, to: -2, tone: 'bad', label: 'Below expected' },
        { from: -2, to: 3, tone: 'good', label: 'Expected for age' },
      ],
      source: 'Z-score above −2 (ISCD)',
    },
  ];
}

/**
 * The zone a value falls in (the last zone takes values past the end, the first those before the start).
 * @param {HealthRange} range
 * @param {number} value
 * @returns {Zone}
 */
export function zoneOf(range, value) {
  return range.zones.find((z) => value < z.to) ?? range.zones[range.zones.length - 1];
}

/**
 * How far a value is from the healthy zone: 0 inside it, else the distance to its nearer edge (in the range's unit).
 * @param {HealthRange} range
 * @param {number} value
 */
export function distanceToHealthy(range, value) {
  const good = range.zones.filter((z) => z.tone === 'good');
  if (!good.length) return 0;
  const lo = Math.min(...good.map((z) => z.from));
  const hi = Math.max(...good.map((z) => z.to));
  return value < lo ? lo - value : value >= hi ? value - hi : 0;
}

/**
 * The change per year between two dated values (null under 30 days apart).
 * @param {{ date: string, value: number }} a
 * @param {{ date: string, value: number }} b
 */
export function perYear(a, b) {
  const days = (Date.parse(`${b.date}T00:00:00Z`) - Date.parse(`${a.date}T00:00:00Z`)) / 864e5;
  return days < 30 ? null : ((b.value - a.value) / days) * 365.25;
}

/**
 * The inverse standard normal CDF (Acklam's rational approximation), for a Z-score from a percentile.
 * @param {number} p in (0, 1)
 * @returns {number}
 */
export function normInv(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) return -normInv(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/**
 * The bone density Z-score from BodySpec's age- and sex-matched percentile (1–99), or null.
 * @param {number | null | undefined} percentile
 */
export function zFromPercentile(percentile) {
  if (percentile === null || percentile === undefined || !(percentile > 0 && percentile < 100)) return null;
  return normInv(percentile / 100);
}

/**
 * The value a healthy-range row reads from a scan (null when the scan lacks it).
 * @param {{ totals: { fatPct: number | null }, derived: { ffmi: number | null, almi: number | null }, bone: { total: { zPercentile: number | null } | null } }} s
 * @param {string} key
 * @returns {number | null}
 */
export function rangeValue(s, key) {
  if (key === 'fatPct') return s.totals.fatPct;
  if (key === 'ffmi') return s.derived.ffmi;
  if (key === 'almi') return s.derived.almi;
  if (key === 'boneZ') return zFromPercentile(s.bone.total?.zPercentile);
  return null;
}
