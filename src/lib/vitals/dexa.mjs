// @ts-check
// One DEXA scan in full, from the sections BodySpec sent (dexa_scans.raw): every region, bone site, percentile and
// RMR formula, plus the measures derived from them (FFMI, ALMI, left/right balance). The same model feeds the
// /health/dexa pages, the plain-text report stored for AI questions (dexa_scans.report_md) and the profile that
// /plan and /check-in read. Pure, tested in dexa.test.mjs.

/** Bump when scanReport or deriveScan change: the sync rebuilds stored reports with an older version. */
export const REPORT_VERSION = 1;

/** @param {unknown} v */
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** @param {unknown} v @returns {Record<string, any>} */
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? /** @type {Record<string, any>} */ (v) : {});
/** @param {number | null} a @param {number | null} b */
const sub = (a, b) => (a === null || b === null ? null : a - b);
/** a − b of the two values rounded to `digits`, as shown on the page. @param {number | null} a @param {number | null} b @param {number} digits */
export const shownDiff = (a, b, digits) => {
  if (a === null || b === null) return null;
  const f = 10 ** digits;
  return (Math.round(a * f) - Math.round(b * f)) / f;
};
/** @param {number | null} a @param {number | null} b */
const add = (a, b) => (a === null || b === null ? null : a + b);
/** @param {number | null} v @param {number} d */
const round = (v, d) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);

/** The composition regions in body order. `side` is the patient's side; a scan image shows their right on the left. */
export const REGIONS = /** @type {const} */ ([
  { key: 'right_arm', label: 'Right arm', side: 'right', limb: 'arm' },
  { key: 'left_arm', label: 'Left arm', side: 'left', limb: 'arm' },
  { key: 'trunk', label: 'Trunk', side: null, limb: null },
  { key: 'android', label: 'Android (belly)', side: null, limb: null },
  { key: 'gynoid', label: 'Gynoid (hips)', side: null, limb: null },
  { key: 'right_leg', label: 'Right leg', side: 'right', limb: 'leg' },
  { key: 'left_leg', label: 'Left leg', side: 'left', limb: 'leg' },
]);

/** BodySpec's percentile metrics. `better` is the good direction for a higher value; null when neither is. */
export const PERCENTILE_METRICS = /** @type {const} */ ({
  total_body_fat_pct: { label: 'Body fat', unit: '%', digits: 1, better: 'down' },
  vat_mass_kg: { label: 'Visceral fat', unit: 'kg', digits: 2, better: 'down' },
  total_lmi_kg_m2: { label: 'Lean mass index', unit: 'kg/m²', digits: 1, better: 'up' },
  limb_lmi_kg_m2: { label: 'Limb lean mass index (ALMI)', unit: 'kg/m²', digits: 2, better: 'up' },
  bone_density_g_cm2: { label: 'Bone density', unit: 'g/cm²', digits: 3, better: 'up' },
});

/** @param {string} key */
export function humanize(key) {
  const s = key.replace(/_/g, ' ').replace(/\b(kg|m2|g|cm2|cm3|pct)\b/g, '').replace(/\s+/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : key;
}

/**
 * @typedef {{ key: string, label: string, side: 'left' | 'right' | null, limb: 'arm' | 'leg' | null, fatKg: number | null,
 *   leanKg: number | null, boneKg: number | null, totalKg: number | null, fatPct: number | null }} Region
 * @typedef {{ key: string, label: string, bmd: number | null, bmcG: number | null, areaCm2: number | null,
 *   zPercentile: number | null, tPercentile: number | null }} BoneSite
 * @typedef {{ key: string, label: string, unit: string, digits: number, better: 'up' | 'down' | null, value: number,
 *   percentile: number }} Percentile
 * @typedef {{ resultId: string, scanDate: string, location: string | null, scanner: string | null,
 *   ageYears: number | null, heightCm: number | null, weightKg: number | null, acquiredAt: string | null, analyzedAt: string | null,
 *   totals: { fatKg: number | null, leanKg: number | null, boneKg: number | null, totalKg: number | null, fatPct: number | null },
 *   vat: { massKg: number | null, volumeCm3: number | null }, androidGynoidRatio: number | null,
 *   regions: Region[], bone: { total: BoneSite | null, sites: BoneSite[] },
 *   percentiles: { gender: string | null, minAge: number | null, maxAge: number | null, datasetSize: number | null, metrics: Percentile[] },
 *   rmr: { meanKcal: number | null, estimates: { formula: string, kcal: number }[] },
 *   derived: Derived }} FullScan
 * @typedef {{ ffmi: number | null, almi: number | null, fmi: number | null, armsLeanKg: number | null, legsLeanKg: number | null,
 *   appendicularLeanKg: number | null, armLeanBalancePct: number | null, legLeanBalancePct: number | null,
 *   trunkToLimbFat: number | null, androidFatPct: number | null, gynoidFatPct: number | null, leanToFat: number | null }} Derived
 */

/** @param {Record<string, any>} r */
const regionValues = (r) => ({
  fatKg: num(r.fat_mass_kg),
  leanKg: num(r.lean_mass_kg),
  boneKg: num(r.bone_mass_kg),
  totalKg: num(r.total_mass_kg),
  fatPct: num(r.region_fat_pct) ?? num(r.tissue_fat_pct),
});

/**
 * Right minus left as a share of their mean, in %: +4 means the right side has 4% more.
 * @param {number | null} right @param {number | null} left
 */
export function balancePct(right, left) {
  if (right === null || left === null || right + left === 0) return null;
  return ((right - left) / ((right + left) / 2)) * 100;
}

/**
 * Measures derived from the composition. Index values (kg/m²) need the height from the scan's intake.
 * @param {FullScan['totals']} totals @param {Region[]} regions @param {number | null} heightCm
 * @returns {Derived}
 */
export function deriveScan(totals, regions, heightCm) {
  const r = Object.fromEntries(regions.map((x) => [x.key, x]));
  /** @param {string} k @param {'fatKg' | 'leanKg'} f */
  const v = (k, f) => r[k]?.[f] ?? null;
  const h2 = heightCm ? (heightCm / 100) ** 2 : null;
  const armsLean = add(v('left_arm', 'leanKg'), v('right_arm', 'leanKg'));
  const legsLean = add(v('left_leg', 'leanKg'), v('right_leg', 'leanKg'));
  const appendicular = add(armsLean, legsLean);
  const limbFat = add(add(v('left_arm', 'fatKg'), v('right_arm', 'fatKg')), add(v('left_leg', 'fatKg'), v('right_leg', 'fatKg')));
  const trunkFat = v('trunk', 'fatKg');
  const ffm = add(totals.leanKg, totals.boneKg);
  return {
    ffmi: h2 && ffm !== null ? ffm / h2 : null,
    almi: h2 && appendicular !== null ? appendicular / h2 : null,
    fmi: h2 && totals.fatKg !== null ? totals.fatKg / h2 : null,
    armsLeanKg: armsLean,
    legsLeanKg: legsLean,
    appendicularLeanKg: appendicular,
    armLeanBalancePct: balancePct(v('right_arm', 'leanKg'), v('left_arm', 'leanKg')),
    legLeanBalancePct: balancePct(v('right_leg', 'leanKg'), v('left_leg', 'leanKg')),
    trunkToLimbFat: trunkFat !== null && limbFat ? trunkFat / limbFat : null,
    androidFatPct: r.android?.fatPct ?? null,
    gynoidFatPct: r.gynoid?.fatPct ?? null,
    leanToFat: totals.leanKg !== null && totals.fatKg ? totals.leanKg / totals.fatKg : null,
  };
}

/**
 * The full scan from a dexa_scans row: its columns (resultId, scanDate, location, scanner, ageYears, heightCm) and
 * `raw`, BodySpec's sections by name.
 * @param {{ resultId: string, scanDate: string, location?: string | null, scanner?: string | null, ageYears?: number | null,
 *   heightCm?: number | null, raw: Record<string, unknown> | null }} row
 * @returns {FullScan}
 */
export function fullScan(row) {
  const raw = obj(row.raw);
  const info = obj(raw['scan-info']);
  const intake = obj(info.patient_intake);
  const comp = obj(raw.composition);
  const compRegions = obj(comp.regions);
  const bone = obj(raw['bone-density']);
  const pct = obj(raw.percentiles);
  const params = obj(pct.params);
  const ages = obj(params.reference_age_range);
  const vat = obj(raw['visceral-fat']);
  const totals = regionValues(obj(comp.total));

  const known = new Set(/** @type {string[]} */ (REGIONS.map((x) => x.key)));
  /** @type {Region[]} */
  const regions = [
    ...REGIONS.filter((x) => compRegions[x.key]).map((x) => ({ ...x, ...regionValues(obj(compRegions[x.key])) })),
    ...Object.keys(compRegions)
      .filter((k) => !known.has(k))
      .map((k) => ({ key: k, label: humanize(k), side: /** @type {null} */ (null), limb: /** @type {null} */ (null), ...regionValues(obj(compRegions[k])) })),
  ];

  /** @param {string} key @param {unknown} site @returns {BoneSite} */
  const boneSite = (key, site) => {
    const s = obj(site);
    return {
      key,
      label: key === 'total' ? 'Total body' : REGIONS.find((x) => x.key === key)?.label ?? humanize(key),
      bmd: num(s.bone_mineral_density),
      bmcG: num(s.bone_mineral_content_g),
      areaCm2: num(s.bone_area_cm2),
      zPercentile: num(s.age_sex_z_percentile),
      tPercentile: num(s.peak_sex_t_percentile),
    };
  };
  const boneRegions = obj(bone.regions);
  const order = (/** @type {string} */ k) => {
    const i = REGIONS.findIndex((x) => x.key === k);
    return i === -1 ? 99 : i;
  };

  const metrics = obj(pct.metrics);
  /** @type {Percentile[]} */
  const percentiles = Object.keys(metrics)
    .map((key) => {
      const m = obj(metrics[key]);
      const def = /** @type {Record<string, { label: string, unit: string, digits: number, better: 'up' | 'down' | null }>} */ (PERCENTILE_METRICS)[key];
      const value = num(m.value);
      const percentile = num(m.percentile);
      if (value === null || percentile === null) return null;
      return { key, label: def?.label ?? humanize(key), unit: def?.unit ?? '', digits: def?.digits ?? 2, better: def?.better ?? null, value, percentile };
    })
    .filter((m) => m !== null)
    .sort((a, b) => {
      const keys = Object.keys(PERCENTILE_METRICS);
      const ia = keys.indexOf(a.key);
      const ib = keys.indexOf(b.key);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  const estimates = (Array.isArray(obj(raw.rmr).estimates) ? obj(raw.rmr).estimates : [])
    .map((/** @type {unknown} */ e) => ({ formula: String(obj(e).formula ?? 'Estimate'), kcal: num(obj(e).kcal_per_day) }))
    .filter((/** @type {{ kcal: number | null }} */ e) => e.kcal !== null);
  const heightCm = num(intake.height_cm) ?? row.heightCm ?? null;

  return {
    resultId: row.resultId,
    scanDate: row.scanDate,
    location: row.location ?? null,
    scanner: row.scanner ?? (typeof info.scanner_model === 'string' ? info.scanner_model : null),
    ageYears: num(intake.age_years) ?? row.ageYears ?? null,
    heightCm,
    weightKg: num(intake.weight_kg),
    acquiredAt: typeof info.acquire_time === 'string' ? info.acquire_time : null,
    analyzedAt: typeof info.analyze_time === 'string' ? info.analyze_time : null,
    totals,
    vat: { massKg: num(vat.vat_mass_kg), volumeCm3: num(vat.vat_volume_cm3) },
    androidGynoidRatio: num(comp.android_gynoid_ratio),
    regions,
    bone: {
      total: Object.keys(obj(bone.total)).length ? boneSite('total', bone.total) : null,
      sites: Object.keys(boneRegions)
        .sort((a, b) => order(a) - order(b))
        .map((k) => boneSite(k, boneRegions[k])),
    },
    percentiles: {
      gender: typeof params.gender === 'string' ? params.gender : null,
      minAge: num(ages.min_years),
      maxAge: num(ages.max_years),
      datasetSize: num(params.reference_dataset_size),
      metrics: percentiles,
    },
    rmr: {
      meanKcal: estimates.length ? Math.round(estimates.reduce((/** @type {number} */ a, /** @type {{ kcal: number }} */ e) => a + e.kcal, 0) / estimates.length) : null,
      estimates,
    },
    derived: deriveScan(totals, regions, heightCm),
  };
}

/** The measures followed across scans on /health/dexa, in display order. `better` is the good direction. */
export const TREND_MEASURES = /** @type {const} */ ([
  { key: 'fatPct', label: 'Body fat', unit: '%', digits: 1, better: 'down', get: (/** @type {FullScan} */ s) => s.totals.fatPct },
  { key: 'vatKg', label: 'Visceral fat', unit: 'kg', digits: 2, better: 'down', get: (/** @type {FullScan} */ s) => s.vat.massKg },
  { key: 'fatKg', label: 'Fat mass', unit: 'kg', digits: 1, better: 'down', get: (/** @type {FullScan} */ s) => s.totals.fatKg },
  { key: 'leanKg', label: 'Lean mass', unit: 'kg', digits: 1, better: 'up', get: (/** @type {FullScan} */ s) => s.totals.leanKg },
  { key: 'armsLeanKg', label: 'Arms, lean', unit: 'kg', digits: 2, better: 'up', get: (/** @type {FullScan} */ s) => s.derived.armsLeanKg },
  { key: 'legsLeanKg', label: 'Legs, lean', unit: 'kg', digits: 1, better: 'up', get: (/** @type {FullScan} */ s) => s.derived.legsLeanKg },
  { key: 'almi', label: 'ALMI', unit: 'kg/m²', digits: 2, better: 'up', get: (/** @type {FullScan} */ s) => s.derived.almi },
  { key: 'ffmi', label: 'FFMI', unit: 'kg/m²', digits: 1, better: 'up', get: (/** @type {FullScan} */ s) => s.derived.ffmi },
  { key: 'agRatio', label: 'Belly : hip fat', unit: '', digits: 2, better: 'down', get: (/** @type {FullScan} */ s) => s.androidGynoidRatio },
  { key: 'androidFatPct', label: 'Belly fat', unit: '%', digits: 1, better: 'down', get: (/** @type {FullScan} */ s) => s.derived.androidFatPct },
  { key: 'totalKg', label: 'Weight', unit: 'kg', digits: 1, better: null, get: (/** @type {FullScan} */ s) => s.totals.totalKg },
  { key: 'bmd', label: 'Bone density', unit: 'g/cm²', digits: 3, better: 'up', get: (/** @type {FullScan} */ s) => s.bone.total?.bmd ?? null },
  { key: 'rmr', label: 'Resting burn', unit: 'kcal', digits: 0, better: null, get: (/** @type {FullScan} */ s) => s.rmr.meanKcal },
]);

/**
 * Every scan oldest first, each measure's series with its change since the previous and the first scan, and the
 * regional change between the last two scans.
 * @param {FullScan[]} scans any order
 */
export function dexaTrends(scans) {
  const ordered = [...scans].sort((a, b) => a.scanDate.localeCompare(b.scanDate));
  const latest = ordered.at(-1) ?? null;
  const previous = ordered.length > 1 ? ordered[ordered.length - 2] : null;
  const first = ordered.length > 1 ? ordered[0] : null;
  const measures = TREND_MEASURES.map(({ get, ...m }) => {
    const value = latest ? get(latest) : null;
    return {
      ...m,
      value,
      // From the shown (rounded) values, so "21.8 → 22.2" reads as 0.4 and not 0.5.
      sincePrevious: previous ? shownDiff(value, get(previous), m.digits) : null,
      sinceFirst: first && first !== previous ? shownDiff(value, get(first), m.digits) : null,
      series: ordered.map((s) => ({ date: s.scanDate, resultId: s.resultId, value: get(s) })),
    };
  });
  return { scans: ordered, latest, previous, first, measures };
}

/**
 * The scan before and after one, in date order, for the detail page's arrows and its "since last scan".
 * @param {FullScan[]} ordered oldest first
 * @param {string} resultId
 */
export function neighbours(ordered, resultId) {
  const i = ordered.findIndex((s) => s.resultId === resultId);
  return { index: i, previous: i > 0 ? ordered[i - 1] : null, next: i >= 0 && i < ordered.length - 1 ? ordered[i + 1] : null };
}

// --- The plain-text report ------------------------------------------------------------------------------------

/** @param {number | null} v @param {number} d @param {string} [unit] */
const f = (v, d, unit = '') => (v === null ? 'n/a' : `${v.toFixed(d)}${unit ? ` ${unit}` : ''}`);
/** @param {number | null} v @param {number} d @param {string} [unit] */
const fs = (v, d, unit = '') => (v === null ? 'n/a' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(d)}${unit ? ` ${unit}` : ''}`);
/** @param {number} p */
const ordinal = (p) => `${p}${p % 100 >= 11 && p % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][p % 10] ?? 'th'}`;

/**
 * The scan as Markdown, every number BodySpec gave plus the derived ones, and the change since the scan before.
 * Stored in dexa_scans.report_md so an AI (Coach's API, a Claude session with SQL) can answer questions from it
 * without knowing BodySpec's JSON.
 * @param {FullScan} s
 * @param {FullScan | null} prev the scan before, if any
 */
export function scanReport(s, prev) {
  const md = [`# DEXA scan ${s.scanDate}`, ''];
  md.push(
    `- Source: BodySpec${s.location ? `, ${s.location.replace(/^BodySpec\s*-\s*/, '')}` : ''}${s.scanner ? `; scanner ${s.scanner}` : ''}; result id ${s.resultId}`,
    `- At scan: age ${f(s.ageYears, 1)} years, height ${f(s.heightCm, 1, 'cm')}, intake weight ${f(s.weightKg, 1, 'kg')}`,
    ''
  );
  md.push('## Totals', '');
  md.push(
    `- Body fat: ${f(s.totals.fatPct, 1, '%')}`,
    `- Total mass: ${f(s.totals.totalKg, 2, 'kg')} (fat ${f(s.totals.fatKg, 2, 'kg')}, lean ${f(s.totals.leanKg, 2, 'kg')}, bone ${f(s.totals.boneKg, 2, 'kg')})`,
    `- Visceral fat (VAT): ${f(s.vat.massKg, 2, 'kg')}, volume ${f(s.vat.volumeCm3, 0, 'cm³')}`,
    `- Android/gynoid fat ratio: ${f(s.androidGynoidRatio, 2)}`,
    `- Resting metabolic rate: ${f(s.rmr.meanKcal, 0, 'kcal/day')} (mean of ${s.rmr.estimates.length} formulas)`,
    ''
  );
  const d = s.derived;
  md.push('## Derived (computed by Coach)', '');
  md.push(
    `- FFMI (fat-free mass index): ${f(d.ffmi, 1, 'kg/m²')}; FMI (fat mass index): ${f(d.fmi, 1, 'kg/m²')}`,
    `- ALMI (appendicular lean mass index): ${f(d.almi, 2, 'kg/m²')}; appendicular lean ${f(d.appendicularLeanKg, 2, 'kg')}`,
    `- Arms lean (both): ${f(d.armsLeanKg, 2, 'kg')}; legs lean (both): ${f(d.legsLeanKg, 2, 'kg')}`,
    `- Lean balance, right vs left: arms ${fs(d.armLeanBalancePct, 1, '%')}, legs ${fs(d.legLeanBalancePct, 1, '%')}`,
    `- Trunk-to-limb fat ratio: ${f(d.trunkToLimbFat, 2)}; lean-to-fat ratio: ${f(d.leanToFat, 2)}`,
    ''
  );
  if (s.regions.length) {
    md.push('## Composition by region', '', '| Region | Fat kg | Lean kg | Bone kg | Total kg | Fat % |', '| --- | ---: | ---: | ---: | ---: | ---: |');
    for (const r of s.regions) md.push(`| ${r.label} | ${f(r.fatKg, 2)} | ${f(r.leanKg, 2)} | ${f(r.boneKg, 2)} | ${f(r.totalKg, 2)} | ${f(r.fatPct, 1)} |`);
    md.push('');
  }
  if (s.bone.total || s.bone.sites.length) {
    md.push(
      '## Bone density',
      '',
      '| Site | BMD g/cm² | BMC g | Area cm² | Age-matched percentile (Z) | Young-adult percentile (T) |',
      '| --- | ---: | ---: | ---: | ---: | ---: |'
    );
    for (const b of [...(s.bone.total ? [s.bone.total] : []), ...s.bone.sites]) {
      md.push(`| ${b.label} | ${f(b.bmd, 3)} | ${f(b.bmcG, 1)} | ${f(b.areaCm2, 1)} | ${b.zPercentile ?? 'n/a'} | ${b.tPercentile ?? 'n/a'} |`);
    }
    md.push('');
  }
  if (s.percentiles.metrics.length) {
    const p = s.percentiles;
    const group = [p.gender, p.minAge !== null && p.maxAge !== null ? `aged ${p.minAge}–${p.maxAge}` : null, p.datasetSize ? `${p.datasetSize.toLocaleString('en-US')} BodySpec scans` : null]
      .filter(Boolean)
      .join(', ');
    md.push(`## Percentiles vs peers${group ? ` (${group})` : ''}`, '');
    for (const m of p.metrics) {
      const note = m.better === 'down' ? ' (lower is leaner)' : m.better === 'up' ? ' (higher is better)' : '';
      md.push(`- ${m.label}: ${m.value.toFixed(m.digits)}${m.unit ? ` ${m.unit}` : ''}, ${ordinal(m.percentile)} percentile${note}`);
    }
    md.push('');
  }
  if (s.rmr.estimates.length) {
    md.push('## Resting metabolic rate by formula', '');
    for (const e of s.rmr.estimates) md.push(`- ${e.formula}: ${e.kcal} kcal/day`);
    md.push('');
  }
  if (prev) {
    md.push(`## Change since the scan before (${prev.scanDate})`, '');
    for (const { get, ...m } of TREND_MEASURES) {
      const now = get(s);
      const then = get(prev);
      if (now === null || then === null) continue;
      md.push(`- ${m.label}: ${then.toFixed(m.digits)} → ${now.toFixed(m.digits)}${m.unit ? ` ${m.unit}` : ''} (${fs(now - then, m.digits)})`);
    }
    const byKey = Object.fromEntries(prev.regions.map((r) => [r.key, r]));
    for (const r of s.regions) {
      const p0 = byKey[r.key];
      if (!p0) continue;
      md.push(`- ${r.label}: fat ${fs(sub(r.fatKg, p0.fatKg), 2, 'kg')}, lean ${fs(sub(r.leanKg, p0.leanKg), 2, 'kg')}`);
    }
    md.push('');
  }
  return md.join('\n').trimEnd() + '\n';
}

/**
 * Derived values to store next to the scan (dexa_scans.derived), rounded so the JSON stays readable.
 * @param {FullScan} s
 */
export function storedDerived(s) {
  return Object.fromEntries(Object.entries(s.derived).map(([k, v]) => [k, round(v, 3)]));
}

/**
 * The whole history as one Markdown document: a table of every scan, then each scan's report, newest first.
 * For GET /api/vitals/dexa?format=md and for pasting into a chat.
 * @param {FullScan[]} scans any order
 * @param {{ name: string, kind: string, scanDate: string | null, url: string, text: string | null }[]} [files]
 */
export function historyReport(scans, files = []) {
  const t = dexaTrends(scans);
  const md = ['# DEXA history (BodySpec)', '', `${t.scans.length} scans${t.latest ? `, latest ${t.latest.scanDate}` : ''}.`, ''];
  if (t.scans.length) {
    const cols = TREND_MEASURES.filter((m) => t.scans.some((s) => m.get(s) !== null));
    md.push(`| Date | ${cols.map((m) => `${m.label}${m.unit ? ` (${m.unit})` : ''}`).join(' | ')} |`, `| --- | ${cols.map(() => '---:').join(' | ')} |`);
    for (const s of t.scans) md.push(`| ${s.scanDate} | ${cols.map((m) => f(m.get(s), m.digits)).join(' | ')} |`);
    md.push('');
  }
  for (let i = t.scans.length - 1; i >= 0; i--) md.push(scanReport(t.scans[i], i > 0 ? t.scans[i - 1] : null).replace(/^# /, '## ').replace(/\n## /g, '\n### '));
  if (files.length) {
    md.push('## Files', '');
    for (const file of files) {
      md.push(`- ${file.name} (${file.kind}${file.scanDate ? `, scan ${file.scanDate}` : ''}): ${file.url}`);
      if (file.text) md.push('', '```text', file.text.trim().slice(0, 20_000), '```', '');
    }
  }
  return md.join('\n').trimEnd() + '\n';
}
