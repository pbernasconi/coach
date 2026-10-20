import { sql } from '@/db';
import { toDay } from '@/lib/db-time.mjs';
import { cached } from '@/lib/data-cache';
import { bandsFor, slug as slugOf, tabsFor } from './function-catalog.mjs';
import { buildIndex, drawStatus, neighbours, valueText } from './labs-view.mjs';

/**
 * Loaders for /health/labs (Function's "Data" page) and /health/labs/[biomarker]. Owner-scoped. Status, range and
 * text come from lab_biomarkers (Function's catalog); values and history from lab_results; the next draw from
 * lab_planned_draws; the clinician's notes from clinician_notes.
 */

type Row = Record<string, unknown>;
export type LabStatus = 'in_range' | 'out_of_range' | 'other';
const n = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const s = (v: unknown) => (typeof v === 'string' && v ? v : null);

export type Draw = { date: string; value: number | null; text: string; status: LabStatus };
export type LabItem = {
  key: string;
  name: string;
  slug: string;
  status: LabStatus;
  units: string | null;
  latest: Draw | null;
  draws: Draw[]; // oldest first
};

// The lab data changes only when the Function sync (or a labs import) runs, so every read here is cached under
// the 'labs' tag (src/lib/data-cache.ts). The Function workflow clears it after each sync.
const biomarkerRows = cached(async (userId: string) => {
  return (await sql`
    SELECT key, name, slug, result_names, categories, description, units, status, out_of_range_type, kind, range_text,
           range_min::float8 AS range_min, range_max::float8 AS range_max, range_min_op, range_max_op, optimal_range,
           optimal_low::float8 AS optimal_low, optimal_high::float8 AS optimal_high, current_display, current_on
    FROM lab_biomarkers WHERE user_id = ${userId} AND source = 'function'`) as Row[];
}, 'lab-biomarkers', 'labs');

const resultRows = cached(
  async (userId: string, names: string[] | null) =>
    (await sql`
      SELECT biomarker, collected_on, value::float8 AS value, value_text, unit, status FROM lab_results
      WHERE user_id = ${userId} AND source = 'function' AND (${names}::text[] IS NULL OR biomarker = ANY(${names}::text[]))
      ORDER BY collected_on`) as Row[],
  'lab-results',
  'labs'
);

/** Every draw of every biomarker name, oldest first. */
async function results(userId: string, names: string[] | null) {
  const rows = await resultRows(userId, names);
  const by = new Map<string, Row[]>();
  for (const r of rows) by.set(String(r.biomarker), [...(by.get(String(r.biomarker)) ?? []), r]);
  return by;
}

function drawsOf(b: Row, by: Map<string, Row[]>): Draw[] {
  const names = (b.result_names as string[] | null) ?? [];
  const rows = names.flatMap((nm) => by.get(nm) ?? []);
  const byDay = new Map<string, Draw>();
  for (const r of rows) {
    const date = toDay(r.collected_on);
    if (!date) continue;
    byDay.set(date, {
      date,
      value: n(r.value),
      text: valueText(n(r.value), s(r.value_text), s(r.unit) ?? s(b.units)),
      status: drawStatus(s(r.status), b.status as LabStatus),
    });
  }
  return [...byDay.values()].sort((a, c) => a.date.localeCompare(c.date));
}

function item(b: Row, by: Map<string, Row[]>): LabItem {
  const draws = drawsOf(b, by);
  const latest = draws.at(-1) ?? null;
  // The latest draw takes Function's own status for the biomarker (it can differ from the flag on the draw).
  if (latest) latest.status = b.status as LabStatus;
  return { key: String(b.key), name: String(b.name), slug: String(b.slug), status: b.status as LabStatus, units: s(b.units), latest, draws };
}

const categoryQuery = cached(
  async (userId: string) =>
    (await sql`
      SELECT key, name, description, position, biomarker_keys FROM lab_categories
      WHERE user_id = ${userId} AND source = 'function' ORDER BY position`) as Row[],
  'lab-categories',
  'labs'
);

async function categoryRows(userId: string) {
  const rows = await categoryQuery(userId);
  return rows.map((c) => ({ key: String(c.key), name: String(c.name), description: s(c.description), position: Number(c.position), biomarkerKeys: (c.biomarker_keys as string[]) ?? [] }));
}

export async function loadLabsIndex(userId: string) {
  const [bms, cats, by] = await Promise.all([biomarkerRows(userId), categoryRows(userId), results(userId, null)]);
  const items = bms.map((b) => item(b, by));
  const { sections, counts } = buildIndex(cats, items);
  const draws = [...new Set(items.flatMap((i) => i.draws.map((d) => d.date)))].sort();
  return { sections, counts, latestDraw: draws.at(-1) ?? null, drawCount: draws.length };
}
export type LabsIndex = Awaited<ReturnType<typeof loadLabsIndex>>;

export type LabNote = { notedOn: string; category: string; body: string };

/** Function's page text of one biomarker (about 50 KB each, 6.5 MB for all of them in 2026-10). */
const contentRows = cached(
  async (userId: string, key: string) =>
    (await sql`SELECT content FROM lab_biomarkers WHERE user_id = ${userId} AND source = 'function' AND key = ${key}`) as Row[],
  'lab-content',
  'labs'
);

const plannedRows = cached(
  async (userId: string) =>
    (await sql`
      SELECT recommended_on, window_start, window_end, visit_on, scheduled FROM lab_planned_draws
      WHERE user_id = ${userId} AND source = 'function' ORDER BY COALESCE(visit_on, window_end) LIMIT 1`) as Row[],
  'lab-planned',
  'labs'
);

const noteRows = cached(
  async (userId: string, categories: string[]) =>
    (await sql`
      SELECT noted_on, category, body FROM clinician_notes
      WHERE user_id = ${userId} AND category = ANY(${categories}::text[])
      ORDER BY noted_on DESC, position`) as Row[],
  'lab-notes',
  'labs'
);

export async function loadBiomarker(userId: string, slug: string) {
  const [bms, cats] = await Promise.all([biomarkerRows(userId), categoryRows(userId)]);
  // The page slug, or the slug of a lab_results name (the Labs section on /health links by those).
  const b = bms.find((x) => x.slug === slug) ?? bms.find((x) => ((x.result_names as string[]) ?? []).some((nm) => slugOf(nm) === slug));
  if (!b) return null;
  const canonical = String(b.slug);
  const [by, content, planned, notes] = await Promise.all([
    results(userId, (b.result_names as string[]) ?? []),
    contentRows(userId, String(b.key)),
    plannedRows(userId),
    noteRows(userId, (b.categories as string[]) ?? []),
  ]);
  const it = item(b, by);
  const order = buildIndex(cats, bms.map((x) => ({ key: String(x.key), name: String(x.name), slug: String(x.slug), status: x.status as LabStatus }))).order;
  const nb = neighbours(order, canonical);
  const range = { min: n(b.range_min), max: n(b.range_max), minOp: s(b.range_min_op), maxOp: s(b.range_max_op) };
  const p = planned[0];
  return {
    ...it,
    description: s(b.description),
    category: nb.category ?? ((b.categories as string[]) ?? [])[0] ?? null,
    rangeText: s(b.range_text),
    optimalRange: n(b.optimal_low) !== null || n(b.optimal_high) !== null ? { low: n(b.optimal_low), high: n(b.optimal_high) } : null,
    bands: bandsFor(range),
    kind: s(b.kind),
    tabs: tabsFor(content[0]?.content ?? null, it.status, s(b.out_of_range_type)),
    nextDraw: p
      ? { visitOn: toDay(p.visit_on), windowStart: toDay(p.window_start), windowEnd: toDay(p.window_end), recommendedOn: toDay(p.recommended_on), scheduled: p.scheduled === true }
      : null,
    notes: notes.flatMap((r): LabNote[] => {
      const notedOn = toDay(r.noted_on);
      return notedOn ? [{ notedOn, category: String(r.category), body: String(r.body) }] : [];
    }),
    prev: nb.prev,
    next: nb.next,
    position: nb.index + 1,
    total: nb.total,
  };
}
export type BiomarkerView = NonNullable<Awaited<ReturnType<typeof loadBiomarker>>>;
