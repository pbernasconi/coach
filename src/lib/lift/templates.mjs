// @ts-check
// The template library's edits (Lift → Templates on the web; the iPhone edits templates in its own store). One edit
// is one field of one slot, a new slot, a removed slot, a slot moved one place, or a new template name. Pure: the
// checks and the rows a move or a rename pushes. templates.ts reads the templates and applies the change through
// the Coach chat's template code (src/lib/coach-chat/lift-tools.ts), so chat and web write templates one way.

import { stampAfter } from '../coach-chat/lift-tools.mjs';

/**
 * @typedef {import('../coach-chat/lift-tools.mjs').LiftTemplate} LiftTemplate
 * @typedef {import('../coach-chat/lift-tools.mjs').LibraryExercise} LibraryExercise
 * @typedef {import('../coach-chat/lift-tools.mjs').TemplateChange} TemplateChange
 * @typedef {import('../coach-chat/lift-tools.mjs').SlotPatch} SlotPatch
 * @typedef {{ kind: 'slot', slotId: string, field: 'sets' | 'reps' | 'weight' | 'rest' | 'note', value: unknown }
 *   | { kind: 'add', templateId: string, exerciseId: string }
 *   | { kind: 'remove', slotId: string }
 *   | { kind: 'move', slotId: string, by: -1 | 1 }
 *   | { kind: 'rename', templateId: string, name: string }} TemplateEdit
 */

/** "8", "8-12", "8–12" → [8, 12]; null when not 1 to 50 with min ≤ max. @param {unknown} v @returns {[number, number] | null} */
export function parseRepRange(v) {
  const m = /^\s*(\d{1,2})\s*(?:[-–]\s*(\d{1,2}))?\s*$/.exec(String(v ?? ''));
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return a >= 1 && b >= a && b <= 50 ? [a, b] : null;
}

/** The rest choices on the web, in seconds (0 is none). */
export const REST_CHOICES = [0, 30, 45, 60, 75, 90, 120, 150, 180, 210, 240, 300];

/** @param {LiftTemplate[]} templates @param {string} slotId */
function findSlot(templates, slotId) {
  const id = String(slotId ?? '').toLowerCase();
  for (const t of templates) {
    const i = t.slots.findIndex((s) => s.id.toLowerCase() === id);
    if (i >= 0) return { template: t, slot: t.slots[i], index: i };
  }
  return null;
}

/** @param {LiftTemplate[]} templates @param {string} id */
const findTemplate = (templates, id) => templates.find((t) => t.id.toLowerCase() === String(id ?? '').toLowerCase()) ?? null;

/**
 * Checks one edit against the templates as they are now.
 * - `change`: a slot update, add or remove, for applyTemplateChange (the chat's change shape);
 * - `rows`: templateExercise or template rows to push as they are (a move swaps two positions; a rename);
 * - `none`: nothing to do (the value is already that);
 * - `problem`: why not, in words for a toast.
 * @param {TemplateEdit} edit @param {{ templates: LiftTemplate[], library: LibraryExercise[] }} lift
 * @param {Record<string, any> | null} [templateRow] the template's stored payload, for a rename
 * @param {Date} [now]
 * @returns {{ change: TemplateChange } | { rows: { entity: 'template' | 'templateExercise', payload: Record<string, any> }[] } | { none: true } | { problem: string }}
 */
export function cleanTemplateEdit(edit, { templates, library }, templateRow = null, now = new Date()) {
  if (!edit || typeof edit !== 'object') return { problem: 'Bad edit.' };

  if (edit.kind === 'rename') {
    const t = findTemplate(templates, edit.templateId);
    if (!t || !templateRow) return { problem: 'The template is not there any more.' };
    const name = String(edit.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!name) return { problem: 'A template needs a name.' };
    if (name === t.name) return { none: true };
    if (templates.some((x) => x.id !== t.id && x.name.toLowerCase() === name.toLowerCase())) return { problem: `There is already a template called ${name}.` };
    return { rows: [{ entity: 'template', payload: { ...templateRow, name, updatedAt: stampAfter(templateRow, now) } }] };
  }

  if (edit.kind === 'add') {
    const t = findTemplate(templates, edit.templateId);
    if (!t) return { problem: 'The template is not there any more.' };
    const e = library.find((x) => x.id.toLowerCase() === String(edit.exerciseId ?? '').toLowerCase());
    if (!e) return { problem: 'That exercise is not in the Lift library.' };
    if (t.slots.some((s) => s.exerciseId?.toLowerCase() === e.id.toLowerCase())) return { problem: `${e.name} is already in ${t.name}.` };
    return { change: { op: 'template', action: 'add', template: t.name, templateId: t.id, slotId: null, exercise: e.name, exerciseId: e.id, set: {}, was: null } };
  }

  const found = findSlot(templates, /** @type {any} */ (edit).slotId);
  if (!found) return { problem: 'That exercise is not in the template any more.' };
  const { template: t, slot, index } = found;
  /** @type {SlotPatch} */
  const was = { sets: slot.sets, repMin: slot.repMin, repMax: slot.repMax, rest: slot.rest, weight: slot.weight, note: slot.note };
  /** @param {SlotPatch} set @returns {{ change: TemplateChange }} */
  const change = (set, action = /** @type {'update' | 'remove'} */ ('update')) => ({
    change: { op: 'template', action, template: t.name, templateId: t.id, slotId: slot.id, exercise: slot.exercise, exerciseId: slot.exerciseId, set, was },
  });

  if (edit.kind === 'remove') return change({}, 'remove');

  if (edit.kind === 'move') {
    const other = t.slots[index + (edit.by === -1 ? -1 : 1)];
    if (!other) return { none: true };
    // Positions as stored can repeat or skip; the two swap their places in the list order.
    const a = { ...slot.payload, position: other.position === slot.position ? index + (edit.by === -1 ? -1 : 1) : other.position, updatedAt: stampAfter(slot.payload, now) };
    const b = { ...other.payload, position: other.position === slot.position ? index : slot.position, updatedAt: stampAfter(other.payload, now) };
    return { rows: [{ entity: 'templateExercise', payload: a }, { entity: 'templateExercise', payload: b }] };
  }

  if (edit.kind !== 'slot') return { problem: 'Bad edit.' };
  const v = edit.value;
  if (edit.field === 'sets') {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 10) return { problem: 'Sets must be 1 to 10.' };
    return n === slot.sets ? { none: true } : change({ sets: n });
  }
  if (edit.field === 'reps') {
    const r = parseRepRange(v);
    if (!r) return { problem: 'Reps must be like 8 or 8–12 (1 to 50).' };
    return r[0] === slot.repMin && r[1] === slot.repMax ? { none: true } : change({ repMin: r[0], repMax: r[1] });
  }
  if (edit.field === 'rest') {
    const s = v === null || v === '' ? 0 : Number(v);
    if (!Number.isInteger(s) || s < 0 || s > 900) return { problem: 'Rest must be 0 to 15 minutes.' };
    const rest = s || null;
    return rest === (slot.rest || null) ? { none: true } : change({ rest });
  }
  if (edit.field === 'weight') {
    const text = v == null ? '' : String(v).trim().replace(',', '.');
    const w = text === '' ? null : Number(text);
    if (w !== null && !(Number.isFinite(w) && w >= 0 && w <= 2000)) return { problem: 'Load must be 0 to 2000, or empty to use the last session.' };
    const weight = w === null || w === 0 ? null : Math.round(w * 100) / 100;
    return weight === slot.weight ? { none: true } : change({ weight });
  }
  if (edit.field === 'note') {
    const note = v == null ? null : String(v).trim().slice(0, 300) || null;
    return note === (slot.note || null) ? { none: true } : change({ note });
  }
  return { problem: 'Bad edit.' };
}

/** 150 → "2:30", 0 or null → "—". @param {number | null | undefined} s */
export function restLabel(s) {
  if (!s) return '—';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** [8, 12] → "8–12", [5, 5] → "5". @param {number} a @param {number} b */
export const repsLabel = (a, b) => (a === b ? `${a}` : `${a}–${b}`);
