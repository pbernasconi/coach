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
  { name: 'Omega-3 Index', names: ['omega3index', 'omega3total', 'omega3totalomegacheck', 'omega3'] },
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

/**
 * One biomarker per Function biomarker, as on /health/labs. Function can report one marker under two result names
 * ("Omega-3 Total" and "Omega-3 Total / OmegaCheck"): their draws merge under the newest name. The latest reading
 * takes Function's own status for the marker, so the out-of-range count matches the full report.
 * @template {{ biomarker: string, latest: { collectedOn: string, status: string }, history: { collectedOn: string, status: string }[] }} B
 * @param {B[]} biomarkers one per lab_results name
 * @param {{ resultNames: string[], name?: string | null, status: string }[]} catalog lab_biomarkers rows (source 'function')
 * @returns {B[]}
 */
export function mergeByCatalog(biomarkers, catalog) {
  const entryOf = new Map();
  // By its result names, and by its own name: a row can carry Function's display name ("Omega-3 Total") when the
  // draw's result name is another ("Omega-3 Total / OmegaCheck").
  for (const c of catalog) for (const nm of [...(c.resultNames ?? []), c.name]) if (nm && !entryOf.has(fold(nm))) entryOf.set(fold(nm), c);
  const groups = new Map();
  const out = [];
  for (const b of biomarkers) {
    const c = entryOf.get(fold(b.biomarker));
    if (!c) { out.push(b); continue; }
    if (!groups.has(c)) { groups.set(c, []); out.push(c); }
    groups.get(c).push(b);
  }
  return out.map((x) => {
    const members = groups.get(x);
    if (!members) return x;
    const newest = members.reduce((a, m) => (m.latest.collectedOn > a.latest.collectedOn ? m : a));
    const byDay = new Map();
    for (const m of members) for (const r of m.history) if (m === newest || !byDay.has(r.collectedOn)) byDay.set(r.collectedOn, r);
    const history = [...byDay.values()].sort((a, c) => a.collectedOn.localeCompare(c.collectedOn));
    const last = history[history.length - 1];
    const status =
      x.status === 'out_of_range' ? 'out_of_range' : x.status === 'other' ? 'unknown' : last.status === 'out_of_range' ? 'in_range' : last.status;
    const latest = { ...last, status };
    return { ...newest, latest, history: [...history.slice(0, -1), latest] };
  });
}

/**
 * One row per marker when the same marker comes in under a longer name ("Omega-3 Total / OmegaCheck" from the
 * OmegaCheck panel, "Omega-3 Total" from Function without a range). The row with a reference range leads; the
 * other's draws join its history.
 * @template {{ biomarker: string, refLow: number | null, refHigh: number | null, latest: { collectedOn: string, value?: number | null, valueText?: string | null },
 *   history: { collectedOn: string }[] }} B
 * @param {B[]} biomarkers
 * @returns {B[]}
 */
export function mergeAliases(biomarkers) {
  // Same name before " / " and the same latest reading: one result under two names. "BUN" and "BUN / Creatinine
  // Ratio" share the start but not the reading, so they stay apart.
  const key = (b) => `${fold(String(b.biomarker).split(' / ')[0])}|${b.latest.collectedOn}|${b.latest.value ?? b.latest.valueText ?? ''}`;
  const groups = new Map();
  for (const b of biomarkers) groups.set(key(b), [...(groups.get(key(b)) ?? []), b]);
  const out = [];
  for (const b of biomarkers) {
    const g = groups.get(key(b));
    if (g.length === 1) { out.push(b); continue; }
    if (g[0] !== b) continue; // the group goes out once
    const ranged = (x) => x.refLow !== null || x.refHigh !== null;
    const lead = g.find(ranged) ?? g.reduce((a, x) => (x.latest.collectedOn > a.latest.collectedOn ? x : a));
    const byDay = new Map(lead.history.map((r) => [r.collectedOn, r]));
    for (const x of g) for (const r of x.history) if (!byDay.has(r.collectedOn)) byDay.set(r.collectedOn, r);
    const history = [...byDay.values()].sort((a, c) => a.collectedOn.localeCompare(c.collectedOn));
    // The lead's latest status stands when its draw is the newest; a newer draw from the other name leads the history.
    out.push({ ...lead, history, latest: history[history.length - 1] });
  }
  return out;
}
