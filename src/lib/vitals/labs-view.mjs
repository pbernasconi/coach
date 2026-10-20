// View helpers for /health/labs and /health/labs/[biomarker]: the list order, previous/next, the status of each
// draw, the value text, the band scale of the detail chart, and Markdown with links for Function's reading text.
// Pure, so node:test covers it (labs-view.test.mjs).

import { parseNote } from './note-markdown.mjs';
import { orderInCategory } from './function-catalog.mjs';

/** @typedef {'in_range' | 'out_of_range' | 'other'} LabStatus */

export const STATUS_LABEL = { in_range: 'In Range', out_of_range: 'Out of Range', other: 'Other' };

/**
 * Categories with their biomarkers in Function's order, and the flat order for previous/next (a biomarker in two
 * categories is visited once, where it first appears).
 * @param {{ key: string, name: string, description: string | null, position: number, biomarkerKeys: string[] }[]} categories
 * @param {{ key: string, name: string, slug: string, status: LabStatus }[]} biomarkers
 */
export function buildIndex(categories, biomarkers) {
  const byKey = new Map(biomarkers.map((b) => [b.key, b]));
  const placed = new Set();
  const sections = [...categories]
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .map((c) => {
      const items = orderInCategory(c.biomarkerKeys.map((k) => byKey.get(k)).filter(Boolean));
      items.forEach((b) => placed.add(b.key));
      return { key: c.key, name: c.name, description: c.description, items };
    })
    .filter((s) => s.items.length);
  // Biomarkers in no category still get a section, so nothing is hidden.
  const loose = orderInCategory(biomarkers.filter((b) => !placed.has(b.key)));
  if (loose.length) sections.push({ key: 'uncategorized', name: 'Other results', description: null, items: loose });
  const order = [];
  const seen = new Set();
  for (const s of sections) for (const b of s.items) if (!seen.has(b.key)) { seen.add(b.key); order.push({ slug: b.slug, name: b.name, category: s.name }); }
  const counts = { all: biomarkers.length, out_of_range: 0, in_range: 0, other: 0 };
  for (const b of biomarkers) counts[b.status] = (counts[b.status] ?? 0) + 1;
  return { sections, order, counts };
}

/** The previous and next biomarker in list order, and the position. */
export function neighbours(order, slug) {
  const i = order.findIndex((o) => o.slug === slug);
  if (i < 0) return { prev: null, next: null, index: -1, total: order.length };
  return { prev: order[i - 1] ?? null, next: order[i + 1] ?? null, index: i, total: order.length, category: order[i].category };
}

/**
 * The status of one draw, for its dot: Function's flag on the draw (lab_results.status is 'out_of_range' when
 * Function flagged it), else in range. A biomarker whose status is "other" has "other" draws.
 * @returns {LabStatus}
 */
export function drawStatus(resultStatus, biomarkerStatus) {
  if (biomarkerStatus === 'other') return 'other';
  if (resultStatus === 'out_of_range') return 'out_of_range';
  // A draw without a range ("NEGATIVE", no reference) takes the biomarker's status.
  if (resultStatus === 'unknown' || !resultStatus) return biomarkerStatus === 'out_of_range' ? 'out_of_range' : 'in_range';
  return 'in_range';
}

/** "NEGATIVE" → "Negative"; other text as written. */
export function displayText(s) {
  if (typeof s !== 'string' || !s.trim()) return null;
  const t = s.trim();
  return /^[A-Z][A-Z\s-]+$/.test(t) ? t.charAt(0) + t.slice(1).toLowerCase() : t;
}

/** The value of a draw as text, with its unit unless the value is a word. */
export function valueText(value, valueText, unit) {
  const t = displayText(valueText);
  if (t) return /^[<>≤≥]?\s*[\d.]+$/.test(t) && unit ? `${t} ${unit}` : t;
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-';
  const v = String(+Number(value).toPrecision(4));
  return unit ? `${v} ${unit}` : v;
}

/**
 * The detail chart's scale. Each band gets the same height (Function's layout); inside a band the value is linear.
 * Values outside every band are clamped to the chart's edges, which the bands stretch to hold.
 * @param {{ key: string, from: number | null, to: number | null }[]} bands top to bottom
 * @param {number[]} values
 * @returns {{ position: (v: number) => number, edges: { key: string, lo: number, hi: number }[] }} position: 0 bottom … 1 top
 */
export function bandScale(bands, values) {
  const vs = values.filter((v) => Number.isFinite(v));
  if (!bands.length) {
    const lo = Math.min(...vs, 0);
    const hi = Math.max(...vs, lo + 1);
    return { position: (v) => (v - lo) / (hi - lo || 1), edges: [] };
  }
  const limits = bands.flatMap((b) => [b.from, b.to]).filter((x) => x !== null);
  const min = Math.min(...limits);
  const max = Math.max(...limits);
  const span = max - min || Math.abs(max) * 0.5 || 1;
  // Bottom to top, with open ends closed around the bound and the values.
  const edges = [...bands].reverse().map((b) => {
    let lo = b.from;
    let hi = b.to;
    if (lo === null) lo = Math.min(min - span * 0.6, ...vs);
    if (hi === null) hi = Math.max(max + span * 0.6, ...vs);
    if (b.key === 'in' && bands.length === 2 && b.from === null && min >= 0 && vs.every((v) => v >= 0)) lo = Math.min(0, ...vs); // "< 200" starts at 0
    if (lo < 0 && min >= 0 && vs.every((v) => v >= 0)) lo = 0;
    return { key: b.key, lo, hi: Math.max(hi, lo + 1e-9) };
  });
  const n = edges.length;
  const position = (v) => {
    const i = edges.findIndex((e) => v <= e.hi);
    const k = i < 0 ? n - 1 : i;
    const e = edges[k];
    const f = Math.min(1, Math.max(0, (v - e.lo) / (e.hi - e.lo)));
    return (k + f) / n;
  };
  return { position, edges };
}

const LINK = /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g;

/** Spans with links: [text](https://…) becomes { text, href }. Only https links; anything else stays text. */
function withLinks(spans) {
  return spans.flatMap((s) => {
    const out = [];
    let last = 0;
    for (const m of s.text.matchAll(LINK)) {
      if (m.index > last) out.push({ ...s, text: s.text.slice(last, m.index) });
      out.push({ ...s, text: m[1], href: m[2] });
      last = m.index + m[0].length;
    }
    if (last < s.text.length) out.push({ ...s, text: s.text.slice(last) });
    return out;
  });
}

/** Function's reading text as blocks (headings, lists, paragraphs, bold, https links). Plain data, no HTML. */
export function parseContent(text) {
  return parseNote(text).map((b) =>
    b.type === 'list' ? { ...b, items: b.items.map(withLinks) } : { ...b, spans: withLinks(b.spans) }
  );
}
