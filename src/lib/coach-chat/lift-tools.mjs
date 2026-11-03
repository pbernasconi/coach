// @ts-check
// Lift tools for the Coach chat (lift/COACH-CHAT.md, "Lifts"): read the Lift templates in full (sets, reps, load, rest,
// cues) and an exercise's history, and change a template from the change card ({ op: "template" }), so "3 sets of RDLs
// with 3 min rest next time" changes every lift planned from then on (Paolo, 2026-11-03: the chat said it couldn't).
// Pure: definitions, input checks, the text the tools answer with, and the new template rows. lift-tools.ts reads
// and writes them.

export const TEMPLATES_TOOL = {
  name: 'get_lift_templates',
  description:
    "Read his Lift templates in full: each exercise slot's sets, rep range, planned load, rest between sets and cue, " +
    'and which planned lifts use each template. Use it before you change a template, and for "what\'s in my heavy ' +
    'day", "how long do I rest on squats".',
  input_schema: { type: 'object', properties: {} },
};

export const HISTORY_TOOL = {
  name: 'get_exercise_history',
  description:
    'One exercise\'s logged history in Lift: every session\'s sets (weight × reps), the best estimated 1RM per ' +
    'session and the all-time best. Use it for "am I getting stronger on squats", "what did I lift last time", and ' +
    'before you suggest a load. exercise: its name ("Romanian deadlift", "RDL" works too).',
  input_schema: {
    type: 'object',
    properties: { exercise: { type: 'string' }, sessions: { type: 'integer', minimum: 1, maximum: 20, description: 'Most recent sessions to list (default 8).' } },
    required: ['exercise'],
  },
};

export const LIFT_READ_TOOLS = [TEMPLATES_TOOL, HISTORY_TOOL];

/**
 * @typedef {{ id: string, templateId: string, position: number, exerciseId: string | null, exercise: string,
 *   sets: number, repMin: number, repMax: number, weight: number | null, unit: string | null, rest: number | null,
 *   note: string | null, payload: Record<string, any> }} Slot
 * @typedef {{ id: string, name: string, slots: Slot[] }} LiftTemplate
 * @typedef {{ id: string, name: string }} LibraryExercise
 * @typedef {{ sets?: number, repMin?: number, repMax?: number, rest?: number | null, weight?: number | null, note?: string | null }} SlotPatch
 * @typedef {{ op: 'template', action: 'update' | 'add' | 'remove', template: string, templateId: string,
 *   slotId: string | null, exercise: string, exerciseId: string | null, set: SlotPatch,
 *   was: SlotPatch | null }} TemplateChange
 */

/** Common short names → the library's words. */
const ALIASES = {
  rdl: 'romanian deadlift', rdls: 'romanian deadlift', ohp: 'overhead press', db: 'dumbbell', bb: 'barbell',
  kb: 'kettlebell', squats: 'squat', rows: 'row', curls: 'curl', 'pull ups': 'pull-up', pullups: 'pull-up',
};

/** @param {string} s */
export function normName(s) {
  let t = String(s ?? '').toLowerCase().replace(/[^a-z0-9 -]+/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [k, v] of Object.entries(ALIASES)) t = t.replace(new RegExp(`\\b${k}\\b`, 'g'), v);
  return t;
}

/**
 * The one name among `names` that `query` means: exact, then one containing the other. Null when none; the list
 * when several fit.
 * @template {{ name: string }} T
 * @param {string} query @param {T[]} items
 * @returns {{ hit: T } | { none: true } | { many: T[] }}
 */
export function matchName(query, items) {
  const q = normName(query);
  if (!q) return { none: true };
  const exact = items.filter((i) => normName(i.name) === q);
  if (exact.length === 1) return { hit: exact[0] };
  if (exact.length > 1) return { many: exact };
  const near = items.filter((i) => { const n = normName(i.name); return n.includes(q) || q.includes(n); });
  if (near.length === 1) return { hit: near[0] };
  return near.length ? { many: near } : { none: true };
}

/** 90 → "1:30". @param {number | null | undefined} s */
export function restText(s) {
  if (!s) return 'no rest set';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} rest`;
}
/** @param {number} a @param {number} b */
const repsText = (a, b) => (a === b ? `${a}` : `${a}–${b}`);

/** One slot as a line: "Romanian deadlift: 3 × 8–10 @ 135 lb, 3:00 rest (Hinge, soft knees)". @param {Pick<Slot, 'exercise' | 'sets' | 'repMin' | 'repMax' | 'weight' | 'unit' | 'rest' | 'note'>} s */
export function slotText(s) {
  const load = s.weight ? ` @ ${s.weight} ${s.unit ?? ''}`.trimEnd() : '';
  return `${s.exercise}: ${s.sets} × ${repsText(s.repMin, s.repMax)}${load}, ${restText(s.rest)}${s.note ? ` (${s.note.replace(/\s+/g, ' ').slice(0, 160)})` : ''}`;
}

/**
 * get_lift_templates' answer.
 * @param {LiftTemplate[]} templates @param {{ day: string, template: string, title: string }[]} planned  upcoming lifts
 */
export function templatesText(templates, planned = []) {
  if (!templates.length) return 'No Lift templates.';
  return templates
    .map((t) => {
      const uses = planned.filter((p) => p.template.toLowerCase() === t.name.toLowerCase()).map((p) => `${p.day} ${p.title}`);
      return [
        `## ${t.name}`,
        ...t.slots.map((s, i) => `${i + 1}. ${slotText(s)}`),
        uses.length ? `Planned: ${uses.join('; ')}` : 'Planned: none in the next three weeks',
      ].join('\n');
    })
    .join('\n\n') + '\n\nA change to a template ({ op: "template" } on the card) re-plans every lift on it that has not started.';
}

/**
 * @typedef {{ day: string, sessionId: string, reps: number | null, weight: number | null, kind: string }} HistorySet
 */

/**
 * get_exercise_history's answer: newest sessions first, each with its working sets, and the best e1RM (Epley, 1–12
 * reps) of each and of all time.
 * @param {string} name @param {HistorySet[]} sets  logged sets of the exercise @param {string} unit @param {number} sessions
 */
export function historyText(name, sets, unit, sessions = 8) {
  const work = sets.filter((s) => s.kind !== 'warmUp' && s.reps != null && s.reps > 0);
  if (!work.length) return `${name}: nothing logged yet.`;
  const e1rm = (/** @type {HistorySet} */ s) => (s.weight && s.reps && s.reps <= 12 ? s.weight * (1 + s.reps / 30) : null);
  /** @type {Map<string, HistorySet[]>} */
  const by = new Map();
  for (const s of work) {
    const k = `${s.day}|${s.sessionId}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k)?.push(s);
  }
  const keys = [...by.keys()].sort().reverse();
  let best = { v: 0, day: '' };
  for (const s of work) { const v = e1rm(s) ?? 0; if (v > best.v) best = { v, day: s.day }; }
  const lines = keys.slice(0, sessions).map((k) => {
    const list = by.get(k) ?? [];
    const top = Math.max(0, ...list.map((s) => e1rm(s) ?? 0));
    return `${k.split('|')[0]}: ${list.map((s) => `${s.weight ?? 'BW'} × ${s.reps}`).join(', ')}${top ? ` · e1RM ${Math.round(top)}` : ''}`;
  });
  return [
    `${name}, in ${unit}: ${keys.length} sessions logged.${best.v ? ` Best e1RM ${Math.round(best.v)} (${best.day}).` : ''}`,
    ...lines,
  ].join('\n');
}

/** "8", 8, "8-12", "8–12" → [min, max]. @param {unknown} v @returns {[number, number] | null} */
export function parseReps(v) {
  if (typeof v === 'number' && Number.isInteger(v)) return v >= 1 && v <= 50 ? [v, v] : null;
  const m = /^\s*(\d{1,2})\s*(?:[-–to]+\s*(\d{1,2}))?\s*$/.exec(String(v ?? ''));
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return a >= 1 && b >= a && b <= 50 ? [a, b] : null;
}

/**
 * One { op: "template" } change, checked against the templates as they are. `action` update (the default) changes
 * the named fields of a slot; add puts a library exercise at the end; remove takes a slot out.
 * @param {Record<string, unknown>} b @param {{ templates: LiftTemplate[], library: LibraryExercise[] }} lift
 * @returns {{ change: TemplateChange } | { problem: string }}
 */
export function cleanTemplateChange(b, { templates, library }) {
  if (!templates.length) return { problem: 'Lift templates are not available here; say so instead' };
  const action = b.action == null ? 'update' : String(b.action);
  if (!['update', 'add', 'remove'].includes(action)) return { problem: 'template action must be update, add or remove' };
  const t = matchName(String(b.template ?? ''), templates);
  if (!('hit' in t)) return { problem: `template must be one of ${templates.map((x) => x.name).join(', ')}` };
  const template = t.hit;
  const exerciseQ = String(b.exercise ?? '').trim();
  if (!exerciseQ) return { problem: 'template change needs exercise' };

  /** @type {SlotPatch} */
  const set = {};
  if (b.sets != null) {
    const n = Number(b.sets);
    if (!Number.isInteger(n) || n < 1 || n > 10) return { problem: 'sets must be 1 to 10' };
    set.sets = n;
  }
  if (b.reps != null) {
    const r = parseReps(b.reps);
    if (!r) return { problem: 'reps must be like 8 or "8-12" (1 to 50)' };
    [set.repMin, set.repMax] = r;
  }
  if (b.rest !== undefined) {
    const s = b.rest === null ? null : Number(b.rest);
    if (s !== null && (!Number.isInteger(s) || s < 0 || s > 900)) return { problem: 'rest is seconds between sets, 0 to 900 (180 = 3 min)' };
    set.rest = s || null;
  }
  if (b.weight !== undefined) {
    const w = b.weight === null ? null : Number(b.weight);
    if (w !== null && !(Number.isFinite(w) && w >= 0 && w <= 2000)) return { problem: 'weight must be 0 to 2000, in the slot\'s unit, or null' };
    set.weight = w;
  }
  if (b.note !== undefined) {
    const n = b.note === null ? null : String(b.note).trim().slice(0, 300);
    set.note = n || null;
  }

  if (action === 'add') {
    const e = matchName(exerciseQ, library);
    if ('many' in e) return { problem: `${exerciseQ} could be ${e.many.slice(0, 6).map((x) => x.name).join(', ')}: name one` };
    if (!('hit' in e)) return { problem: `${exerciseQ} is not in the Lift exercise library` };
    if (template.slots.some((s) => s.exerciseId && s.exerciseId.toLowerCase() === e.hit.id.toLowerCase())) {
      return { problem: `${e.hit.name} is already in ${template.name}: update it instead` };
    }
    return { change: { op: 'template', action: 'add', template: template.name, templateId: template.id, slotId: null, exercise: e.hit.name, exerciseId: e.hit.id, set, was: null } };
  }

  const s = matchName(exerciseQ, template.slots.map((x) => ({ ...x, name: x.exercise })));
  if ('many' in s) return { problem: `${exerciseQ} could be ${s.many.map((x) => x.name).join(', ')} in ${template.name}: name one` };
  if (!('hit' in s)) return { problem: `${template.name} has no ${exerciseQ}; it has ${template.slots.map((x) => x.exercise).join(', ')}` };
  const slot = s.hit;
  const was = { sets: slot.sets, repMin: slot.repMin, repMax: slot.repMax, rest: slot.rest, weight: slot.weight, note: slot.note };
  if (action === 'remove') {
    return { change: { op: 'template', action: 'remove', template: template.name, templateId: template.id, slotId: slot.id, exercise: slot.exercise, exerciseId: slot.exerciseId, set: {}, was } };
  }
  const changed = /** @type {(keyof SlotPatch)[]} */ (Object.keys(set)).filter((k) => set[k] !== was[k]);
  if (!changed.length) return { problem: `${slot.exercise} in ${template.name} is already like that` };
  /** @type {SlotPatch} */
  const only = {};
  for (const k of changed) /** @type {any} */ (only)[k] = set[k];
  return { change: { op: 'template', action: 'update', template: template.name, templateId: template.id, slotId: slot.id, exercise: slot.exercise, exerciseId: slot.exerciseId, set: only, was } };
}

/**
 * What a template change does, in words: "Sets 2 → 3 · Rest 2:00 → 3:00".
 * @param {TemplateChange} c
 */
export function templateChangeText(c) {
  if (c.action === 'remove') return `Out of ${c.template}`;
  const s = c.set;
  const w = c.was ?? {};
  const bits = [];
  if (s.sets != null) bits.push(c.was ? `${w.sets} → ${s.sets} sets` : `${s.sets} sets`);
  if (s.repMin != null && s.repMax != null) bits.push(c.was ? `${repsText(w.repMin ?? 0, w.repMax ?? 0)} → ${repsText(s.repMin, s.repMax)} reps` : `${repsText(s.repMin, s.repMax)} reps`);
  if ('rest' in s) bits.push(c.was ? `rest ${w.rest ? restText(w.rest).replace(' rest', '') : 'none'} → ${s.rest ? restText(s.rest).replace(' rest', '') : 'none'}` : restText(s.rest));
  if ('weight' in s) bits.push(s.weight == null ? 'load from history' : `${s.weight} load`);
  if ('note' in s) bits.push(s.note ? 'new cue' : 'cue removed');
  return `${c.action === 'add' ? `Added to ${c.template}` : c.template}: ${bits.join(', ') || 'as it is'}`;
}

/**
 * The templateExercise row after the change, as Lift sync pushes it (TemplateExerciseRecord in LiftKit).
 * @param {TemplateChange} c @param {Record<string, any> | null} current  the slot's stored payload (null for add)
 * @param {{ now: string, id: string, position: number, unit: string }} at  `id` and `position` for an add
 * @returns {Record<string, any>}
 */
export function slotPayload(c, current, at) {
  if (c.action === 'add') {
    const s = c.set;
    const [repMin, repMax] = [s.repMin ?? 8, s.repMax ?? s.repMin ?? 12];
    return {
      id: at.id, templateID: c.templateId, position: at.position, exerciseID: c.exerciseId, displayName: c.exercise,
      setCount: s.sets ?? 3, repMin, repMax, weightValue: s.weight ?? null, weightUnit: s.weight != null ? at.unit : null,
      restSeconds: s.rest === undefined ? 120 : s.rest, kind: 'working', note: s.note ?? null,
      createdAt: at.now, updatedAt: at.now, deletedAt: null,
    };
  }
  if (!current) throw new Error('the template slot is not there');
  if (c.action === 'remove') return { ...current, updatedAt: at.now, deletedAt: at.now };
  const s = c.set;
  /** @type {Record<string, any>} */
  const next = { ...current, updatedAt: at.now };
  if (s.sets != null) next.setCount = s.sets;
  if (s.repMin != null) next.repMin = s.repMin;
  if (s.repMax != null) next.repMax = s.repMax;
  if ('rest' in s) next.restSeconds = s.rest ?? null;
  if ('weight' in s) {
    next.weightValue = s.weight ?? null;
    next.weightUnit = s.weight == null ? null : (current.weightUnit ?? at.unit);
  }
  if ('note' in s) next.note = s.note ?? null;
  return next;
}

/** An updatedAt 1 ms past the row's own when that one is ahead of `now` (LWW, lift/SYNC.md). @param {any} row @param {Date} now */
export function stampAfter(row, now) {
  const prev = Date.parse(row?.updatedAt ?? '');
  return new Date(Number.isFinite(prev) && prev >= now.getTime() ? prev + 1 : now.getTime()).toISOString();
}
