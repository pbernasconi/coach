// The short Labs list on /health: every out-of-range biomarker, then the longevity markers Paolo watches (heart,
// metabolic, inflammation, brain). The full report stays one click away. Pure, so node:test covers it
// (labs-highlights.test.mjs).

import { normalizeBiomarker } from './labs.mjs';

const fold = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

/** Key markers in display order. `names` are canonical names (labs.mjs) or folded spellings Function uses. */
export const KEY_MARKERS = [
  { name: 'Apolipoprotein B', names: ['apolipoproteinb'] },
  { name: 'Lipoprotein(a)', names: ['lipoproteina'] },
  { name: 'LDL Cholesterol', names: ['ldlcholesterol'] },
  { name: 'Triglycerides', names: ['triglycerides'] },
  { name: 'Hemoglobin A1c', names: ['hemoglobina1c'] },
  { name: 'Insulin', names: ['insulin'] },
  { name: 'hs-CRP', names: ['hscrp'] },
  { name: 'Homocysteine', names: ['homocysteine'] },
  { name: 'Omega-3 Index', names: ['omega3index', 'omega3total', 'omega3'] },
  { name: 'Vitamin D (25-OH)', names: ['vitamind25oh'] },
  { name: 'Vitamin B12', names: ['vitaminb12'] },
  { name: 'APOE genotype', names: ['apoegenotype', 'apoe', 'apolipoproteine'] },
];

/** The index of a biomarker in KEY_MARKERS, or -1. */
export function keyIndex(biomarker) {
  const f = fold(normalizeBiomarker(biomarker) ?? '');
  if (!f) return -1;
  return KEY_MARKERS.findIndex((k) => k.names.includes(f));
}

/**
 * Out-of-range biomarkers first (key ones in key order, then the rest by name), then the in-range key markers.
 * @template {{ biomarker: string, latest: { status: string } }} B
 * @param {B[]} biomarkers
 * @returns {{ b: B, key: boolean }[]}
 */
export function pickHighlights(biomarkers) {
  const seen = new Set();
  const rows = [];
  for (const b of biomarkers) {
    if (seen.has(b.biomarker)) continue;
    seen.add(b.biomarker);
    const k = keyIndex(b.biomarker);
    const out = b.latest.status === 'out_of_range';
    if (k >= 0 || out) rows.push({ b, key: k >= 0, out, k });
  }
  rows.sort(
    (x, y) =>
      Number(y.out) - Number(x.out) ||
      (x.k < 0 ? 1e3 : x.k) - (y.k < 0 ? 1e3 : y.k) ||
      x.b.biomarker.localeCompare(y.b.biomarker)
  );
  return rows.map(({ b, key }) => ({ b, key }));
}

/** How far a value is outside [low, high]; 0 inside, null without bounds. */
function distance(v, low, high) {
  if (low === null && high === null) return null;
  if (low !== null && v < low) return low - v;
  if (high !== null && v > high) return v - high;
  return 0;
}

/**
 * The change since the previous numeric draw. `better` is true when the value moved toward its optimal range
 * (or the reference range when there is no optimal one), false when it moved away, null when it can't say.
 * @param {{ optimalLow: number | null, optimalHigh: number | null, refLow: number | null, refHigh: number | null,
 *   history: { collectedOn: string, value: number | null }[] }} b
 * @returns {{ delta: number, previous: number, previousOn: string, better: boolean | null } | null}
 */
export function trend(b) {
  const vals = b.history.filter((r) => r.value !== null && Number.isFinite(r.value));
  if (vals.length < 2) return null;
  const cur = vals[vals.length - 1];
  const prev = vals[vals.length - 2];
  const delta = cur.value - prev.value;
  const hasOpt = b.optimalLow !== null || b.optimalHigh !== null;
  const [lo, hi] = hasOpt ? [b.optimalLow, b.optimalHigh] : [b.refLow, b.refHigh];
  const d0 = distance(prev.value, lo, hi);
  const d1 = distance(cur.value, lo, hi);
  const better = d0 === null || d1 === null || d0 === d1 ? null : d1 < d0;
  return { delta, previous: prev.value, previousOn: prev.collectedOn, better };
}
