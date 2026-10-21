// @ts-check
// BodySpec DEXA scans: the API's result sections mapped to a dexa_scans row, and the view /health shows. Pure, so
// it is tested without the API or a database (bodyspec.test.mjs). The API calls are in bodyspec-api.ts.

/** The result sections Coach reads, by their API path (/api/v1/users/me/results/{id}/dexa/<section>). */
export const SECTIONS = /** @type {const} */ (['scan-info', 'composition', 'visceral-fat', 'bone-density', 'percentiles', 'rmr']);

/** @param {unknown} v */
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** @param {unknown} v @returns {Record<string, any>} */
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? /** @type {Record<string, any>} */ (v) : {});

/**
 * The calendar day of a BodySpec time. The API sends times "in location timezone"; the date part is the local day
 * whether or not the text has an offset.
 * @param {string | null | undefined} t
 */
export function dayOf(t) {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(t ?? '');
  return m ? m[1] : null;
}

/**
 * Resting metabolic rate: the mean of BodySpec's formula estimates, rounded.
 * @param {unknown} estimates
 */
export function rmrOf(estimates) {
  const values = (Array.isArray(estimates) ? estimates : []).map((e) => num(obj(e).kcal_per_day)).filter((v) => v !== null);
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

/**
 * One dexa_scans row from a result summary and its sections (missing sections leave their columns null).
 * @param {string} userId
 * @param {{ result_id: string, start_time?: string | null, update_time?: string | null, location?: { name?: string | null } | null }} summary
 * @param {Partial<Record<(typeof SECTIONS)[number], any>>} sections
 */
export function toScanRow(userId, summary, sections) {
  const info = obj(sections['scan-info']);
  const comp = obj(sections.composition);
  const total = obj(comp.total);
  const vat = obj(sections['visceral-fat']);
  const bone = obj(sections['bone-density']);
  const pct = obj(sections.percentiles);
  const intake = obj(info.patient_intake);
  const when = summary.start_time ?? info.acquire_time ?? null;
  const scanDate = dayOf(when);
  if (!scanDate) throw new Error(`BodySpec result ${summary.result_id} has no date`);
  const text = String(when);
  const scannedAt = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text}Z`);
  return {
    resultId: summary.result_id,
    userId,
    scannedAt: Number.isNaN(scannedAt.getTime()) ? new Date(`${scanDate}T12:00:00Z`) : scannedAt,
    scanDate,
    location: summary.location?.name ?? null,
    scanner: typeof info.scanner_model === 'string' ? info.scanner_model : null,
    ageYears: num(intake.age_years),
    heightCm: num(intake.height_cm),
    totalMassKg: num(total.total_mass_kg),
    fatMassKg: num(total.fat_mass_kg),
    leanMassKg: num(total.lean_mass_kg),
    boneMassKg: num(total.bone_mass_kg),
    bodyFatPct: num(total.region_fat_pct) ?? num(total.tissue_fat_pct),
    vatMassKg: num(vat.vat_mass_kg),
    vatVolumeCm3: num(vat.vat_volume_cm3),
    androidGynoidRatio: num(comp.android_gynoid_ratio),
    boneDensity: num(obj(bone.total).bone_mineral_density),
    rmrKcal: rmrOf(obj(sections.rmr).estimates),
    regions: Object.keys(obj(comp.regions)).length ? obj(comp.regions) : null,
    boneRegions: Object.keys(obj(bone.regions)).length ? obj(bone.regions) : null,
    percentiles: Object.keys(obj(pct.metrics)).length ? obj(pct.metrics) : null,
    raw: sections,
    resultUpdatedAt: summary.update_time ?? null,
  };
}

/**
 * @typedef {{ resultId: string, scanDate: string, location: string | null, totalMassKg: number | null, fatMassKg: number | null,
 *   leanMassKg: number | null, bodyFatPct: number | null, vatMassKg: number | null, androidGynoidRatio: number | null,
 *   boneDensity: number | null, rmrKcal: number | null, regions: Record<string, Record<string, number>> | null,
 *   percentiles: Record<string, { value: number, percentile: number }> | null }} Scan
 */

/**
 * Lean mass of both arms together, in kg, or null when a side is missing.
 * @param {Scan['regions']} regions
 */
export function armsLeanKg(regions) {
  const l = num(regions?.left_arm?.lean_mass_kg);
  const r = num(regions?.right_arm?.lean_mass_kg);
  return l === null || r === null ? null : l + r;
}

/** The measures /health shows for each scan, in display order. `better` is the direction that is good. */
export const MEASURES = /** @type {const} */ ([
  { key: 'bodyFatPct', label: 'Body fat', unit: '%', digits: 1, better: 'down' },
  { key: 'vatMassKg', label: 'Visceral fat', unit: 'kg', digits: 2, better: 'down' },
  { key: 'fatMassKg', label: 'Fat mass', unit: 'kg', digits: 1, better: 'down' },
  { key: 'leanMassKg', label: 'Lean mass', unit: 'kg', digits: 1, better: 'up' },
  { key: 'armsLeanKg', label: 'Arms, lean', unit: 'kg', digits: 2, better: 'up' },
  { key: 'totalMassKg', label: 'Weight', unit: 'kg', digits: 1, better: null },
  { key: 'androidGynoidRatio', label: 'Belly : hip fat', unit: '', digits: 2, better: 'down' },
]);

/**
 * @param {Scan} s
 * @param {(typeof MEASURES)[number]['key']} key
 */
export function measure(s, key) {
  return key === 'armsLeanKg' ? armsLeanKg(s.regions) : num(s[key]);
}

/**
 * The DEXA section of /health: scans oldest first, and for each measure the latest value with its change since the
 * scan before and since the first scan.
 * @param {Scan[]} scans any order
 */
export function dexaView(scans) {
  const ordered = [...scans].sort((a, b) => a.scanDate.localeCompare(b.scanDate));
  const latest = ordered.at(-1) ?? null;
  const previous = ordered.length > 1 ? ordered[ordered.length - 2] : null;
  const first = ordered.length > 1 ? ordered[0] : null;
  /** @param {number | null} a @param {number | null} b */
  const diff = (a, b) => (a === null || b === null ? null : a - b);
  const measures = MEASURES.map((m) => {
    const value = latest ? measure(latest, m.key) : null;
    return {
      ...m,
      value,
      sincePrevious: previous ? diff(value, measure(previous, m.key)) : null,
      sinceFirst: first && first !== previous ? diff(value, measure(first, m.key)) : null,
      series: ordered.map((s) => ({ date: s.scanDate, value: measure(s, m.key) })),
    };
  });
  return { scans: ordered, latest, previous, first, measures };
}
