// @ts-check
// What coach_proposals.undo holds after Apply (lift/COACH-CHAT.md, "Applying"): the steps that put each change back,
// each touched workout's fingerprint right after Apply (`after`, so Undo leaves alone what Paolo changed since), and
// `result`, what Apply or Undo did when it isn't simply what the card showed. Cards applied before 2026-10-29 hold the
// steps as a plain list. Pure, so node --test can run it.

/**
 * @typedef {{ op: string, id?: string, row?: Record<string, unknown>, title?: string, [k: string]: unknown }} UndoStep
 * @typedef {{ steps: any[], after: Record<string, string> | null, result: string[] }} UndoRecord
 */

/** @param {unknown} raw  coach_proposals.undo @returns {UndoRecord} */
export function undoRecord(raw) {
  if (Array.isArray(raw)) return { steps: raw, after: null, result: [] };
  const r = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  return {
    steps: Array.isArray(r.steps) ? r.steps : [],
    after: r.after && typeof r.after === 'object' ? /** @type {Record<string, string>} */ (r.after) : null,
    result: Array.isArray(r.result) ? r.result.map(String) : [],
  };
}
