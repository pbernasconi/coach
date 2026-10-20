// Function Health's member API (the API behind my.functionhealth.com), turned into the lab import file format of
// labs.mjs. Pure: no I/O, so node:test covers it. The I/O is in scripts/function-sync.mjs.
//
// Login: POST {API}/login with { email, password } returns a Firebase-style session ({ idToken, refreshToken }).
// Data: GET {API}/results-report (Bearer idToken) returns data.biomarkerResultsRecord: one record per biomarker,
// with every draw in biomarkerResults[] and Function's optimal range on the record.

import { toDay } from '../db-time.mjs';

export const FUNCTION_API = 'https://member-app-mid.functionhealth.com/api/v1';
export const FUNCTION_HEADERS = {
  origin: 'https://my.functionhealth.com',
  referer: 'https://my.functionhealth.com/',
  accept: 'application/json',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
};

const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * The lab import file ({ source, results }) for a results-report response. Every visible draw of every biomarker
 * becomes one result. The source's out-of-range flag is kept; optimal vs in-range is computed from the ranges.
 * @param {any} report the parsed results-report body
 */
export function importFromResultsReport(report) {
  const records = report?.data?.biomarkerResultsRecord;
  if (!Array.isArray(records)) return { source: 'function', results: [] };
  const results = [];
  for (const rec of records) {
    const category = typeof rec?.categories?.[0] === 'string' ? rec.categories[0] : rec?.biomarker?.categories?.[0]?.categoryName ?? null;
    const optLow = num(rec?.optimalRangeMin);
    const optHigh = num(rec?.optimalRangeMax);
    const optimalRange = optLow !== null || optHigh !== null ? { low: optLow, high: optHigh } : undefined;
    for (const r of Array.isArray(rec?.biomarkerResults) ? rec.biomarkerResults : []) {
      if (r?.visible === false) continue;
      const collectedOn = toDay(r?.dateOfService); // '2025-08-20' or an ISO time: the day as written
      const biomarker = r?.biomarkerName || rec?.biomarker?.name; // biomarkerName is often ''
      if (!collectedOn || !biomarker || r?.testResult == null || r.testResult === '') continue;
      results.push({
        biomarker,
        collectedOn,
        ...(category ? { category } : {}),
        value: String(r.testResult),
        ...(r.measurementUnits || rec?.units ? { unit: r.measurementUnits || rec.units } : {}),
        ...(r.questReferenceRange ? { referenceRange: r.questReferenceRange } : {}),
        ...(optimalRange ? { optimalRange } : {}),
        ...(r.testResultOutOfRange === true ? { status: 'out of range' } : {}),
        ...(r.id ? { sourceId: String(r.id) } : {}),
      });
    }
  }
  return { source: 'function', results };
}
