// Lab results: the import file format (scripts/labs-import.mjs) and the pure functions that turn one raw result
// into a lab_results row. No I/O here, so node:test covers it (labs.test.mjs).
//
// Import file (JSON):
//   {
//     "source": "function",                    // optional, default "function"
//     "results": [{
//       "biomarker": "LDL Cholesterol",        // required; aliases are folded ("LDL-C" -> "LDL Cholesterol")
//       "collectedOn": "2026-03-04",           // required, the draw date (YYYY-MM-DD)
//       "category": "Heart",                   // optional
//       "value": 98 | "98" | "<5" | "Negative",// required; text that is not a number goes to value_text
//       "unit": "mg/dL",                       // optional
//       "referenceRange": "0-99" | "<100" | ">=60" | { "low": 0, "high": 99 },   // optional
//       "optimalRange": same forms,            // optional
//       "status": "out of range",              // optional; what the source says. Otherwise computed from the ranges
//       "sourceId": "…"                        // optional, the source's id for the result
//     }]
//   }

/** @typedef {'optimal' | 'in_range' | 'out_of_range' | 'unknown'} LabStatus */
/** @typedef {{ low: number | null, high: number | null }} Range */

const fold = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

/** Canonical names for the biomarkers that labs write in many ways. Keys are folded (see `fold`). */
const ALIASES = new Map(
  /** @type {[string, string[]][]} */ ([
    ['LDL Cholesterol', ['ldl', 'ldlc', 'ldlcholesterol', 'ldlcholesterolcalc', 'ldlcholcalcnih', 'ldlcholesterolcalculated']],
    ['HDL Cholesterol', ['hdl', 'hdlc', 'hdlcholesterol']],
    ['Total Cholesterol', ['cholesteroltotal', 'totalcholesterol', 'cholesterol']],
    ['Triglycerides', ['triglycerides', 'triglyceride', 'tg']],
    ['Apolipoprotein B', ['apob', 'apolipoproteinb', 'apolipoproteinbapob']],
    ['Lipoprotein(a)', ['lpa', 'lipoproteina', 'lipoproteinalpa']],
    ['Hemoglobin A1c', ['hba1c', 'a1c', 'hemoglobina1c', 'haemoglobina1c', 'glycatedhemoglobin']],
    ['Glucose', ['glucose', 'fastingglucose', 'glucosefasting']],
    ['Insulin', ['insulin', 'fastinginsulin', 'insulinfasting']],
    ['hs-CRP', ['hscrp', 'crphs', 'highsensitivitycrp', 'creactiveproteincardiac', 'hscreactiveprotein', 'highsensitivitycreactiveprotein']],
    ['Vitamin D (25-OH)', ['vitamind', 'vitamind25hydroxy', '25hydroxyvitamind', 'vitamind25oh', '25ohvitamind', 'vitamin25ohd']],
    ['TSH', ['tsh', 'thyroidstimulatinghormone']],
    ['Free T4', ['freet4', 't4free', 'thyroxinefree', 'freethyroxine']],
    ['Free T3', ['freet3', 't3free', 'triiodothyroninefree']],
    ['Testosterone, Total', ['testosterone', 'testosteronetotal', 'totaltestosterone', 'testosteronetotalmsms']],
    ['Testosterone, Free', ['testosteronefree', 'freetestosterone']],
    ['Ferritin', ['ferritin']],
    ['Homocysteine', ['homocysteine']],
    ['Uric Acid', ['uricacid']],
    ['Creatinine', ['creatinine']],
    ['eGFR', ['egfr', 'estimatedglomerularfiltrationrate']],
    ['ALT', ['alt', 'altsgpt', 'alanineaminotransferase']],
    ['AST', ['ast', 'astsgot', 'aspartateaminotransferase']],
    ['Vitamin B12', ['vitaminb12', 'b12', 'cobalamin']],
    ['Magnesium', ['magnesium', 'magnesiumrbc', 'rbcmagnesium']],
    ['Cortisol', ['cortisol', 'cortisoltotal']],
  ]).flatMap(([name, keys]) => keys.map((k) => [k, name]))
);

/**
 * One name per biomarker: whitespace collapsed, dashes and quotes made plain, and known aliases folded to their
 * canonical name. Unknown names keep their own spelling.
 * @param {unknown} name
 * @returns {string | null}
 */
export function normalizeBiomarker(name) {
  if (typeof name !== 'string') return null;
  const clean = name.replace(/[‐-―]/g, '-').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return ALIASES.get(fold(clean)) ?? clean;
}

const NUM = String.raw`[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?`;
const toNumber = (s) => Number(s.replace(/,/g, ''));
const COMPARATOR = { '<': '<', '≤': '<=', '<=': '<=', '=<': '<=', '>': '>', '≥': '>=', '>=': '>=', '=>': '>=' };

/**
 * A result value: a number, or text the lab wrote. `"<5"` keeps 5 as the number and `<` as the comparator, so
 * the range check still works; `"Negative"` has no number.
 * @param {unknown} raw
 * @returns {{ value: number | null, valueText: string | null, comparator: string | null }}
 */
export function parseValue(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? { value: raw, valueText: null, comparator: null } : { value: null, valueText: null, comparator: null };
  if (typeof raw !== 'string' || !raw.trim()) return { value: null, valueText: null, comparator: null };
  const text = raw.trim();
  const m = new RegExp(String.raw`^(<=|>=|=<|=>|<|>|≤|≥)?\s*(${NUM})$`).exec(text);
  if (!m) return { value: null, valueText: text, comparator: null };
  const comparator = m[1] ? COMPARATOR[m[1]] : null;
  return { value: toNumber(m[2]), valueText: comparator ? text.replace(/\s+/g, '') : null, comparator };
}

/**
 * A range from what a lab writes: "3.5-5.0", "3.5 – 5.0", "<5", "<=5", ">=60", ">60", "0-99", "-1.0 - 2",
 * or `{ low, high }`. Unbounded sides are null. Text that is not a range ("Negative") gives null.
 * @param {unknown} raw
 * @returns {Range | null}
 */
export function parseRange(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(toNumber(v.trim())) ? toNumber(v.trim()) : null);
    const low = num(/** @type {any} */ (raw).low);
    const high = num(/** @type {any} */ (raw).high);
    return low === null && high === null ? null : { low, high };
  }
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/[‐-―]/g, '-').replace(/\s+/g, ' ').trim();
  const between = new RegExp(String.raw`^(${NUM})\s*(?:-|to)\s*(${NUM})$`, 'i').exec(text);
  if (between) {
    const a = toNumber(between[1]);
    const b = toNumber(between[2]);
    return { low: Math.min(a, b), high: Math.max(a, b) };
  }
  const v = parseValue(text);
  if (v.value === null || !v.comparator) return null;
  return v.comparator.startsWith('<') ? { low: null, high: v.value } : { low: v.value, high: null };
}

/** True when `value` (with its comparator, if any) lies in `range`. Bounds are inclusive. */
function within(value, comparator, range) {
  if (!range) return null;
  const { low, high } = range;
  // "<5" is below 5: in range for high >= 5; ">90" is above 90: in range for low <= 90.
  if (low !== null && (comparator?.startsWith('<') ? value <= low : value < low)) return false;
  if (high !== null && (comparator?.startsWith('>') ? value >= high : value > high)) return false;
  return true;
}

/** The source's own status words, folded to ours. */
export function mapStatus(raw) {
  if (typeof raw !== 'string') return null;
  const s = fold(raw);
  if (!s) return null;
  if (s === 'optimal' || s === 'inoptimalrange') return 'optimal';
  if (['inrange', 'normal', 'withinrange', 'ok', 'inrangenotoptimal'].includes(s)) return 'in_range';
  if (['outofrange', 'high', 'low', 'abnormal', 'critical', 'flagged', 'outsiderange', 'veryhigh', 'verylow'].includes(s)) return 'out_of_range';
  if (s === 'unknown' || s === 'pending') return 'unknown';
  return null;
}

/**
 * The status of one result. The source's own status wins when it gives one we know; otherwise: optimal when
 * inside the optimal range, in_range when inside the reference range, out_of_range when outside it.
 * @returns {LabStatus}
 */
export function computeStatus({ value, comparator = null, ref = null, optimal = null, sourceStatus = null }) {
  const mapped = mapStatus(sourceStatus);
  if (mapped) return mapped;
  if (value === null || value === undefined) return 'unknown';
  const inRef = within(value, comparator, ref);
  if (inRef === false) return 'out_of_range';
  if (within(value, comparator, optimal) === true) return 'optimal';
  if (inRef === true) return 'in_range';
  return 'unknown';
}

/**
 * One raw result from an import file → a lab_results row (without user_id), or a reason it cannot be stored.
 * @param {Record<string, unknown>} raw
 * @param {string} [source]
 */
export function normalizeResult(raw, source = 'function') {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'result is not an object' };
  const biomarker = normalizeBiomarker(raw.biomarker ?? raw.name);
  if (!biomarker) return { ok: false, reason: 'biomarker missing' };
  if (biomarker.length > 200) return { ok: false, reason: 'biomarker name too long' };
  const collectedOn = typeof raw.collectedOn === 'string' ? raw.collectedOn.slice(0, 10) : null;
  if (!collectedOn || !/^\d{4}-\d{2}-\d{2}$/.test(collectedOn) || Number.isNaN(Date.parse(`${collectedOn}T00:00:00Z`))) {
    return { ok: false, reason: 'collectedOn must be YYYY-MM-DD' };
  }
  const v = parseValue(raw.value);
  if (v.value === null && v.valueText === null) return { ok: false, reason: 'value missing' };
  const ref = parseRange(raw.referenceRange);
  const optimal = parseRange(raw.optimalRange);
  const text = (x, max = 200) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : null);
  return {
    ok: true,
    row: {
      collectedOn,
      biomarker,
      category: text(raw.category),
      value: v.value,
      valueText: v.valueText,
      unit: text(raw.unit, 50),
      refLow: ref?.low ?? null,
      refHigh: ref?.high ?? null,
      optimalLow: optimal?.low ?? null,
      optimalHigh: optimal?.high ?? null,
      status: computeStatus({ value: v.value, comparator: v.comparator, ref, optimal, sourceStatus: raw.status }),
      source: text(source, 50) ?? 'function',
      sourceId: raw.sourceId == null ? null : String(raw.sourceId).slice(0, 200),
      raw,
    },
  };
}

/**
 * Every result in an import file. Rows for the same (biomarker, collectedOn) collapse to the last one, because the
 * table is unique on them.
 * @param {unknown} file the parsed JSON
 */
export function normalizeImport(file) {
  if (!file || typeof file !== 'object' || !Array.isArray(/** @type {any} */ (file).results)) {
    return { rows: [], rejected: [{ index: -1, reason: 'file must be an object with a results array' }] };
  }
  const f = /** @type {{ source?: unknown, results: unknown[] }} */ (file);
  const source = typeof f.source === 'string' && f.source.trim() ? f.source.trim() : 'function';
  const rejected = [];
  const byKey = new Map();
  f.results.forEach((raw, index) => {
    const r = normalizeResult(/** @type {any} */ (raw), source);
    if (!r.ok) return rejected.push({ index, reason: r.reason });
    const key = `${r.row.biomarker}|${r.row.collectedOn}`;
    byKey.delete(key);
    byKey.set(key, r.row);
  });
  return { rows: [...byKey.values()], rejected };
}
