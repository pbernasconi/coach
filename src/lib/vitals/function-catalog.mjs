// Function Health's biomarker catalog, for the /health/labs pages: which biomarkers Paolo has, their category,
// Function's status, range bands, and the reading text ("Why it matters", the recommendation sections, sources).
// Pure: no I/O, so node:test covers it (function-catalog.test.mjs, synthetic fixtures only). The I/O is in
// scripts/function-sync.mjs. The rules copy the Function app's own (my.functionhealth.com, read from its JS):
// - status: a discontinued or neutral record is "other"; else the current result's inRange (allergens: <= 0.1).
// - order inside a category: out of range, in range, other; each by name. Categories by name.
// - content: biomarker-data/<sexDetailId>, the sex detail for "All" or the member's sex, in Function's order.
// - the recommendation shown: the in-range one for an in-range result, else the one for its outOfRangeType.

import { toDay } from '../db-time.mjs';
import { normalizeBiomarker } from './labs.mjs';

const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const list = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

/** @typedef {'in_range' | 'out_of_range' | 'other'} LabStatus */

const ALLERGEN_TYPE = 2;
const VERY_LOW = 0.1;

/**
 * Function's status for a results-report record.
 * @returns {LabStatus}
 */
export function statusOf(rec) {
  const cur = obj(rec?.currentResult);
  const neutral = cur?.neutral ?? rec?.neutral;
  if (rec?.biomarker?.status === 'discontinued' || neutral) return 'other';
  if (rec?.type === ALLERGEN_TYPE) {
    const v = num(cur?.calculatedResult);
    return v !== null && v <= VERY_LOW ? 'in_range' : 'out_of_range';
  }
  return cur?.inRange === true ? 'in_range' : 'out_of_range';
}

/**
 * "Mean Corpuscular Hemoglobin Concentration (MCHC)" → "mean-corpuscular-hemoglobin-concentration-mchc".
 * "%" becomes "pct", so "Neutrophils %" and "Neutrophils" get different slugs.
 */
export function slug(name) {
  return String(name ?? '')
    .replace(/%/g, ' pct ')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** The sex detail id whose content applies: the first one for "All" or the member's sex, in Function's order. */
export function sexDetailId(sexDetails, sex) {
  const wanted = sex ? ['All', sex] : ['All'];
  const hit = list(sexDetails).find((d) => wanted.includes(d?.sex));
  return text(hit?.id);
}

/** The member's biological sex from a requisitions response ("Male", "Female") or null. */
export function sexFromRequisitions(requisitions) {
  for (const r of list(requisitions)) {
    const s = text(r?.patient?.biologicalSex);
    if (s) return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
  return null;
}

/**
 * The reference range as numbers and operators, from the record's interpretation (preferred) or its display fields.
 * @returns {{ min: number | null, max: number | null, minOp: string | null, maxOp: string | null, text: string | null }}
 */
export function rangeOf(rec) {
  const i = obj(rec?.interpretation);
  const fromInterp = i && (i.kind === 'continuous_range' || num(i.rangeMin) !== null || num(i.rangeMax) !== null);
  const min = fromInterp ? num(i.rangeMin) : num(rec?.rangeMinDisplay);
  const max = fromInterp ? num(i.rangeMax) : num(rec?.rangeMaxDisplay);
  return {
    min,
    max,
    minOp: text(fromInterp ? i.rangeMinOperator : rec?.rangeMinOperator),
    maxOp: text(fromInterp ? i.rangeMaxOperator : rec?.rangeMaxOperator),
    text: text(rec?.rangeString),
  };
}

const fmt = (v) => String(+Number(v).toPrecision(6));

/**
 * The bands of a range, top to bottom, as the detail chart shows them: Above Range / In Range / Below Range. A range
 * with one bound has two bands. `from`/`to` are the band's value limits (null = open).
 * @returns {{ key: 'above' | 'in' | 'below', label: string, text: string, from: number | null, to: number | null }[]}
 */
export function bandsFor(range) {
  const min = range?.min ?? null;
  const max = range?.max ?? null;
  // The operator says whether the bound itself is in range: "<" 200 → 200 is above; "<=" 200 → 200 is in range.
  const maxIn = range?.maxOp !== '<';
  const minIn = range?.minOp !== '>';
  const bands = [];
  if (max !== null) bands.push({ key: 'above', label: 'Above Range', text: `${maxIn ? '>' : '≥'} ${fmt(max)}`, from: max, to: null });
  if (min !== null || max !== null) {
    const t = min !== null && max !== null ? `${fmt(min)}–${fmt(max)}` : max !== null ? `${maxIn ? '≤' : '<'} ${fmt(max)}` : `${minIn ? '≥' : '>'} ${fmt(min)}`;
    bands.push({ key: 'in', label: 'In Range', text: t, from: min, to: max });
  }
  if (min !== null) bands.push({ key: 'below', label: 'Below Range', text: `${minIn ? '<' : '≤'} ${fmt(min)}`, from: null, to: min });
  return bands;
}

/**
 * The biomarkers and categories of a results-report, ready for lab_biomarkers and lab_categories. `resultNames` are
 * the names labs-import stores in lab_results.biomarker for this record's draws, so the pages can join them.
 */
export function catalogFromReport(report, sex = null) {
  const data = obj(report?.data);
  const records = list(data?.biomarkerResultsRecord);
  const cats = list(data?.categories).map((c) => obj(c)).filter(Boolean);
  const catName = new Map(cats.map((c) => [text(c.category?.id), text(c.category?.categoryName)]).filter(([k, v]) => k && v));
  const biomarkers = [];
  const seen = new Set();
  for (const rec of records) {
    const b = obj(rec?.biomarker);
    const key = text(b?.id) ?? text(rec?.questBiomarkerId);
    const name = text(b?.name);
    if (!key || !name || seen.has(key)) continue;
    seen.add(key);
    const categories = [
      ...new Set([
        ...list(rec.categories).map((id) => catName.get(id)).filter(Boolean),
        ...list(b.categories).map((c) => text(c?.categoryName)).filter(Boolean),
      ]),
    ];
    const resultNames = [
      ...new Set(list(rec.biomarkerResults).map((r) => normalizeBiomarker(text(r?.biomarkerName) ?? name)).filter(Boolean)),
    ];
    if (!resultNames.length) resultNames.push(normalizeBiomarker(name));
    const range = rangeOf(rec);
    const cur = obj(rec.currentResult);
    biomarkers.push({
      key,
      name,
      slug: slug(name),
      resultNames,
      categories,
      description: text(b.oneLineDescription) ?? text(list(b.sexDetails).find((d) => d?.sex === 'All' || d?.sex === sex)?.oneLineDescription),
      units: text(rec.units),
      status: statusOf(rec),
      outOfRangeType: text(rec.outOfRangeType),
      kind: text(rec?.interpretation?.kind),
      rangeText: range.text,
      rangeMin: range.min,
      rangeMax: range.max,
      rangeMinOp: range.minOp,
      rangeMaxOp: range.maxOp,
      optimalRange: text(rec.optimalRange),
      optimalLow: num(rec.optimalRangeMin),
      optimalHigh: num(rec.optimalRangeMax),
      currentDisplay: text(cur?.displayResult) ?? text(cur?.calculatedResult),
      currentOn: toDay(cur?.dateOfService),
      improving: rec.improving === true,
      sexDetailId: sexDetailId(b.sexDetails, sex),
    });
  }
  const categories = cats
    .map((c) => ({
      key: text(c.category?.id),
      name: text(c.category?.categoryName),
      description: text(c.description) ?? text(c.category?.description),
      biomarkerKeys: list(c.biomarkerIds).filter((id) => seen.has(id)),
    }))
    .filter((c) => c.key && c.name && c.biomarkerKeys.length)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c, position) => ({ ...c, position }));
  return { biomarkers, categories };
}

/** Function's section titles, in the app's order. */
export const SECTION_TITLES = {
  summaryDescription: 'Summary',
  causesDescription: 'Causes',
  diseasesDescription: 'Associated conditions',
  foodsToEatDescription: 'Foods to eat',
  foodsToAvoidDescription: 'Foods to limit',
  supplementsDescription: 'Supplements',
  symptomsDescription: 'Symptoms',
  selfCareDescription: 'Self care',
  additionalTestsDescription: 'Additional tests',
  followUpsDescription: 'Follow up',
  howItsCalculatedDescription: "How it's calculated",
  epigeneticsDescription: 'Epigenetics',
  dnaMethylationDescription: 'DNA methylation',
  disclaimerDescription: 'Disclaimer',
};

/**
 * The reading content of a biomarker-data response: why it matters, sources, and each recommendation with its
 * non-empty sections in Function's order.
 */
export function contentFromBiomarkerData(data) {
  const d = obj(data);
  if (!d) return null;
  const recommendations = list(d.recommendations)
    .map(obj)
    .filter(Boolean)
    .map((r) => ({
      inRange: r.inRange === true,
      outOfRangeType: text(r.outOfRangeType),
      sections: Object.entries(SECTION_TITLES).flatMap(([k, title]) => (text(r[k]) ? [{ key: k, title, body: text(r[k]) }] : [])),
    }))
    .filter((r) => r.sections.length);
  return {
    whyItMatters: text(d.whyItMatters),
    sources: list(d.resourcesCited).map(text).filter(Boolean),
    recommendations,
  };
}

/** The recommendation Function shows for a status: in range → the in-range one; else the one for outOfRangeType. */
export function pickRecommendation(recommendations, status, outOfRangeType) {
  const recs = list(recommendations);
  if (status === 'in_range') return recs.find((r) => r.inRange) ?? null;
  if (status === 'other') return null;
  const t = text(outOfRangeType)?.toLowerCase();
  return (t ? recs.find((r) => !r.inRange && r.outOfRangeType?.toLowerCase() === t) : null) ?? recs.find((r) => !r.inRange) ?? null;
}

/**
 * The tabs of the detail page: "Why it matters", the chosen recommendation's sections, and "Sources".
 * @returns {{ key: string, title: string, body: string }[]}
 */
export function tabsFor(content, status, outOfRangeType) {
  if (!content) return [];
  const rec = pickRecommendation(content.recommendations, status, outOfRangeType);
  return [
    ...(content.whyItMatters ? [{ key: 'whyItMatters', title: 'Why it matters', body: content.whyItMatters }] : []),
    ...(rec?.sections ?? []),
    ...(content.sources.length ? [{ key: 'sources', title: 'Sources', body: content.sources.map((s, i) => `${i + 1}. ${s}`).join('\n\n') }] : []),
  ];
}

/**
 * The planned draws of a pending-schedules response: the window Function recommends for the next test order and
 * the visit date when it is booked.
 */
export function plannedDraws(pending) {
  const rows = [];
  for (const p of list(pending)) {
    const o = obj(p);
    const key = text(o?.id);
    if (!key || o.completed === true) continue;
    const visit = obj(o.nextVisit);
    rows.push({
      key,
      type: text(o.type),
      recommendedOn: toDay(o.recommendedDate),
      windowStart: toDay(o.schedulerRangeStart ?? visit?.startDate),
      windowEnd: toDay(o.schedulerRangeEnd ?? visit?.endDate),
      visitOn: toDay(visit?.date),
      scheduled: o.scheduled === true || visit?.scheduled === true,
    });
  }
  return rows;
}

/** Category order for one category's biomarkers: out of range, in range, other; each by name. */
export function orderInCategory(items) {
  const rank = { out_of_range: 0, in_range: 1, other: 2 };
  return [...items].sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || a.name.localeCompare(b.name));
}
