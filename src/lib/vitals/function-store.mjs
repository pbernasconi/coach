// Stores one Function Health sync in Coach: the lab results, the clinician notes, the catalog for /health/labs and
// the next planned draw. POST /api/vitals/function calls it with what scripts/function-sync.mjs read from Function,
// so the job needs no database access. It also records the run in users.settings.functionSync (status, counts).
// Counts only in logs and results, never values: they are health data.

import { normalizeImport } from './labs.mjs';

/** A new catalog smaller than this share of the stored one is treated as partial: nothing is deleted. */
export const PARTIAL_CATALOG = 0.8;

/**
 * The payload's shape, with limits, before anything is written. Returns an error text, or null when it is valid.
 * @param {any} p
 */
export function checkPayload(p) {
  if (!p || typeof p !== 'object') return 'body must be a JSON object';
  if (p.error != null) return typeof p.error === 'string' ? null : 'error must be a string';
  if (!p.file || !Array.isArray(p.file.results)) return 'file.results must be an array';
  if (!Array.isArray(p.notes)) return 'notes must be an array';
  if (!p.catalog || !Array.isArray(p.catalog.biomarkers) || !Array.isArray(p.catalog.categories)) return 'catalog must have biomarkers and categories';
  if (p.contents != null && typeof p.contents !== 'object') return 'contents must be an object';
  if (p.raw != null && typeof p.raw !== 'object') return 'raw must be an object';
  if (!Array.isArray(p.planned)) return 'planned must be an array';
  return null;
}

/** Records the run: a success sets lastSuccessAt; a failure keeps it and sets the error. */
export async function recordFunctionRun(sql, userId, run) {
  const [u] = await sql`SELECT settings -> 'functionSync' AS s FROM users WHERE id = ${userId}`;
  const prev = u?.s ?? {};
  const now = new Date().toISOString();
  const next = run.error
    ? { ...prev, lastAttemptAt: now, status: 'failed', error: String(run.error).slice(0, 200) }
    : { ...prev, lastAttemptAt: now, lastSuccessAt: now, status: run.partial ? 'partial' : 'ok', error: null, counts: run.counts };
  await sql`
    UPDATE users SET settings = jsonb_set(settings, '{functionSync}', ${JSON.stringify(next)}::jsonb), updated_at = NOW()
    WHERE id = ${userId}`;
  return next;
}

/**
 * Writes one sync. The payload: { file (labs.mjs import format), notes (function-api notesFromResponse), catalog
 * (function-catalog catalogFromReport), contents ({ key: content }), raw ({ key: record without the draws }), planned,
 * plannedOk } or { error } for a run that failed before it read Function.
 * @returns {Promise<{ results: number, rejected: number, notes: number, biomarkers: number, partial: boolean, plannedUpdated: boolean }>}
 */
export async function storeFunctionSync(sql, userId, p) {
  const { rows, rejected } = normalizeImport(p.file);

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const c = (k) => chunk.map((r) => r[k]);
    await sql`
      INSERT INTO lab_results (user_id, collected_on, biomarker, category, value, value_text, unit, ref_low, ref_high,
                               optimal_low, optimal_high, status, source, source_id, raw, imported_at)
      SELECT ${userId}, t.collected_on, t.biomarker, t.category, t.value, t.value_text, t.unit, t.ref_low, t.ref_high,
             t.optimal_low, t.optimal_high, t.status, t.source, t.source_id, t.raw::jsonb, now()
      FROM unnest(${c('collectedOn')}::date[], ${c('biomarker')}::text[], ${c('category')}::text[], ${c('value')}::numeric[],
                  ${c('valueText')}::text[], ${c('unit')}::text[], ${c('refLow')}::numeric[], ${c('refHigh')}::numeric[],
                  ${c('optimalLow')}::numeric[], ${c('optimalHigh')}::numeric[], ${c('status')}::text[], ${c('source')}::text[],
                  ${c('sourceId')}::text[], ${chunk.map((r) => JSON.stringify(r.raw))}::text[])
        AS t(collected_on, biomarker, category, value, value_text, unit, ref_low, ref_high, optimal_low, optimal_high,
             status, source, source_id, raw)
      ON CONFLICT (user_id, source, biomarker, collected_on) DO UPDATE SET
        category = EXCLUDED.category, value = EXCLUDED.value, value_text = EXCLUDED.value_text, unit = EXCLUDED.unit,
        ref_low = EXCLUDED.ref_low, ref_high = EXCLUDED.ref_high, optimal_low = EXCLUDED.optimal_low,
        optimal_high = EXCLUDED.optimal_high, status = EXCLUDED.status, source_id = EXCLUDED.source_id,
        raw = EXCLUDED.raw, imported_at = now()`;
  }

  // Clinician notes: a sync replaces the notes of each test order it reads (one transaction per order).
  const orders = [...new Set(p.notes.map((n) => n.requisitionId))];
  for (const id of orders) {
    const list = p.notes.filter((n) => n.requisitionId === id);
    await sql.transaction([
      sql`DELETE FROM clinician_notes WHERE user_id = ${userId} AND source = 'function' AND requisition_id = ${id}`,
      ...list.map((n) => sql`
        INSERT INTO clinician_notes (user_id, source, requisition_id, position, noted_on, category, body, raw, imported_at)
        VALUES (${userId}, 'function', ${id}, ${n.position}, ${n.notedOn}, ${n.category}, ${n.body}, ${JSON.stringify(n.raw)}::jsonb, now())`),
    ]);
  }

  // The catalog. A report with far fewer biomarkers than Coach has is partial (a Function API problem): upsert what
  // came, but delete nothing.
  const biomarkers = p.catalog.biomarkers;
  const [{ n: stored }] = await sql`SELECT count(*)::int AS n FROM lab_biomarkers WHERE user_id = ${userId} AND source = 'function'`;
  const partial = stored > 0 && biomarkers.length < stored * PARTIAL_CATALOG;
  if (biomarkers.length) {
    const keys = biomarkers.map((b) => b.key);
    const contents = p.contents ?? {};
    const raw = p.raw ?? {};
    await sql.transaction([
      ...biomarkers.map((b) => {
        const content = contents[b.key] != null ? JSON.stringify(contents[b.key]) : null;
        return sql`
          INSERT INTO lab_biomarkers (user_id, source, key, name, slug, result_names, categories, description, units, status,
            out_of_range_type, kind, range_text, range_min, range_max, range_min_op, range_max_op, optimal_range, optimal_low,
            optimal_high, current_display, current_on, content, raw, updated_at)
          VALUES (${userId}, 'function', ${b.key}, ${b.name}, ${b.slug}, ${b.resultNames}, ${b.categories}, ${b.description},
            ${b.units}, ${b.status}, ${b.outOfRangeType}, ${b.kind}, ${b.rangeText}, ${b.rangeMin}, ${b.rangeMax}, ${b.rangeMinOp},
            ${b.rangeMaxOp}, ${b.optimalRange}, ${b.optimalLow}, ${b.optimalHigh}, ${b.currentDisplay}, ${b.currentOn},
            ${content}::jsonb, ${JSON.stringify(raw[b.key] ?? {})}::jsonb, now())
          ON CONFLICT (user_id, source, key) DO UPDATE SET
            name = EXCLUDED.name, slug = EXCLUDED.slug, result_names = EXCLUDED.result_names, categories = EXCLUDED.categories,
            description = EXCLUDED.description, units = EXCLUDED.units, status = EXCLUDED.status,
            out_of_range_type = EXCLUDED.out_of_range_type, kind = EXCLUDED.kind, range_text = EXCLUDED.range_text,
            range_min = EXCLUDED.range_min, range_max = EXCLUDED.range_max, range_min_op = EXCLUDED.range_min_op,
            range_max_op = EXCLUDED.range_max_op, optimal_range = EXCLUDED.optimal_range, optimal_low = EXCLUDED.optimal_low,
            optimal_high = EXCLUDED.optimal_high, current_display = EXCLUDED.current_display, current_on = EXCLUDED.current_on,
            content = COALESCE(EXCLUDED.content, lab_biomarkers.content), raw = EXCLUDED.raw, updated_at = now()`;
      }),
      ...(partial
        ? []
        : [
            sql`DELETE FROM lab_biomarkers WHERE user_id = ${userId} AND source = 'function' AND NOT (key = ANY(${keys}::text[]))`,
            sql`DELETE FROM lab_categories WHERE user_id = ${userId} AND source = 'function'`,
            ...p.catalog.categories.map((c) => sql`
              INSERT INTO lab_categories (user_id, source, key, name, description, position, biomarker_keys, updated_at)
              VALUES (${userId}, 'function', ${c.key}, ${c.name}, ${c.description}, ${c.position}, ${c.biomarkerKeys}, now())`),
          ]),
    ]);
  }

  const plannedUpdated = p.plannedOk !== false;
  if (plannedUpdated) {
    await sql.transaction([
      sql`DELETE FROM lab_planned_draws WHERE user_id = ${userId} AND source = 'function'`,
      ...p.planned.map((d) => sql`
        INSERT INTO lab_planned_draws (user_id, source, key, type, recommended_on, window_start, window_end, visit_on, scheduled, updated_at)
        VALUES (${userId}, 'function', ${d.key}, ${d.type}, ${d.recommendedOn}, ${d.windowStart}, ${d.windowEnd}, ${d.visitOn}, ${d.scheduled}, now())`),
    ]);
  }

  return { results: rows.length, rejected: rejected.length, notes: p.notes.length, biomarkers: biomarkers.length, partial, plannedUpdated };
}
