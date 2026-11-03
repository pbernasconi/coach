/**
 * The Coach chat's Lift tools on the server (lift-tools.mjs has the pure parts): the templates in full, an exercise's
 * history, and a template change on Apply, pushed through Lift sync so the phone pulls it like its own edit.
 */

import { sql } from '@/db';
import { push } from '@/lib/lift-sync/sync.mjs';
import { drizzleLiftRepository } from '@/lib/lift-sync/drizzle-repository';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { convert, isCountedSet } from '@/lib/lift-dashboard/stats.mjs';
import { addDays, mondayOf } from '@/lib/plan/week.mjs';
import {
  historyText, matchName, slotPayload, stampAfter, templatesText,
  type HistorySet, type LibraryExercise, type LiftTemplate, type Slot, type TemplateChange,
} from './lift-tools.mjs';

type Row = { entity: string; id: string; payload: Record<string, unknown> };
const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const archived = (p: Record<string, unknown>) => p.isArchived === true || p.isArchived === 1 || p.isArchived === '1';

/** Every live Lift template with its slots in order, and the exercise library. */
export async function loadLiftTemplates(): Promise<{ templates: LiftTemplate[]; library: LibraryExercise[] }> {
  const rows = (await sql`
    SELECT entity, id::text AS id, payload FROM lift_rows
    WHERE deleted_at IS NULL AND entity IN ('template', 'templateExercise', 'exercise')`) as Row[];
  const library = rows
    .filter((r) => r.entity === 'exercise' && !archived(r.payload) && r.payload.name)
    .map((r) => ({ id: String(r.payload.id ?? r.id), name: String(r.payload.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const names = new Map(library.map((e) => [e.id.toLowerCase(), e.name]));
  const templates = rows
    .filter((r) => r.entity === 'template' && !archived(r.payload))
    .sort((a, b) => Number(a.payload.position ?? 0) - Number(b.payload.position ?? 0))
    .map((t) => ({
      id: String(t.payload.id ?? t.id),
      name: String(t.payload.name ?? 'Template'),
      slots: rows
        .filter((r) => r.entity === 'templateExercise' && String(r.payload.templateID ?? '').toLowerCase() === t.id.toLowerCase())
        .sort((a, b) => Number(a.payload.position ?? 0) - Number(b.payload.position ?? 0))
        .map((r): Slot => {
          const p = r.payload;
          const exerciseId = p.exerciseID ? String(p.exerciseID) : null;
          return {
            id: String(p.id ?? r.id), templateId: t.id, position: Number(p.position ?? 0), exerciseId,
            exercise: (exerciseId && names.get(exerciseId.toLowerCase())) || String(p.displayName ?? 'Exercise'),
            sets: Number(p.setCount ?? 3), repMin: Number(p.repMin ?? 8), repMax: Number(p.repMax ?? p.repMin ?? 8),
            weight: num(p.weightValue), unit: p.weightUnit ? String(p.weightUnit) : null, rest: num(p.restSeconds),
            note: p.note ? String(p.note) : null, payload: p,
          };
        }),
    }));
  return { templates, library };
}

/** get_lift_templates: the templates and the lifts planned on them for the next three weeks. */
async function templatesAnswer(userId: string, today: string): Promise<string> {
  const [{ templates }, planned] = await Promise.all([
    loadLiftTemplates(),
    sql`
      SELECT to_char(a.scheduled_date, 'YYYY-MM-DD') AS day, a.lift_template AS template, a.title
        FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
       WHERE p.user_id = ${userId} AND a.lift_template IS NOT NULL AND a.status IS DISTINCT FROM 'skipped'
         AND a.scheduled_date >= ${today} AND a.scheduled_date <= ${addDays(mondayOf(today), 20)}
       ORDER BY a.scheduled_date` as unknown as Promise<{ day: string; template: string; title: string }[]>,
  ]);
  return templatesText(templates, planned);
}

/** get_exercise_history: one exercise's logged sets, by session, from the Lift dashboard's model. */
async function historyAnswer(input: { exercise?: unknown; sessions?: unknown }): Promise<{ ok: boolean; text: string }> {
  const q = String(input.exercise ?? '').trim();
  if (!q) return { ok: false, text: 'exercise is missing' };
  const { model, unit } = await loadLiftModel();
  const byKey = new Map<string, { name: string; key: string }>();
  for (const s of model.sets) if (!byKey.has(s.exerciseKey)) byKey.set(s.exerciseKey, { name: s.exerciseName, key: s.exerciseKey });
  const m = matchName(q, [...byKey.values()]);
  if ('many' in m) return { ok: false, text: `${q} could be ${m.many.slice(0, 8).map((x) => x.name).join(', ')}: name one` };
  if (!('hit' in m)) return { ok: true, text: `No logged sets of ${q} in Lift.` };
  const sets: HistorySet[] = model.sets
    .filter((s) => s.exerciseKey === m.hit.key && isCountedSet(s))
    .map((s) => ({ day: s.day, sessionId: s.sessionId, reps: s.reps, kind: s.kind, weight: s.weight == null ? null : Math.round(convert(s.weight, s.unit, unit) * 10) / 10 }));
  const n = Math.min(20, Math.max(1, Math.round(Number(input.sessions ?? 8)) || 8));
  return { ok: true, text: historyText(m.hit.name, sets, unit, n) };
}

/** Answers one Lift read tool. */
export async function runLiftTool(userId: string, today: string, name: string, input: unknown): Promise<{ ok: boolean; text: string }> {
  try {
    if (name === 'get_lift_templates') return { ok: true, text: await templatesAnswer(userId, today) };
    if (name === 'get_exercise_history') return await historyAnswer((input ?? {}) as Record<string, unknown>);
    return { ok: false, text: 'unknown tool' };
  } catch (e) {
    console.error('[coach-chat] lift tool failed', name, e);
    return { ok: false, text: `The read failed (${String((e as Error)?.message ?? e).slice(0, 120)}). Say you couldn't look it up.` };
  }
}

async function pushRow(payload: Record<string, unknown>, op: 'insert' | 'update' | 'delete') {
  const result = await push(drizzleLiftRepository, [
    { idempotencyKey: crypto.randomUUID(), entity: 'templateExercise', op, rowId: String(payload.id), payload },
  ]);
  if (result.rejected.length) throw new Error(`Lift refused the template change: ${result.rejected[0].reason}`);
}

/** The stored payload of one templateExercise row, deleted or not. */
async function slotRow(id: string): Promise<Record<string, unknown> | null> {
  const [r] = (await sql`SELECT payload FROM lift_rows WHERE entity = 'templateExercise' AND id = ${id}::uuid`) as { payload: Record<string, unknown> }[];
  return r?.payload ?? null;
}

/**
 * Apply of a { op: "template" } change. Returns the slot as it was (null for an add) and its id, for Undo.
 * plan-apply.yml then re-plans the lifts on the template that haven't started (server.ts starts it).
 */
export async function applyTemplateChange(c: TemplateChange, now = new Date()): Promise<{ slotId: string; before: Record<string, unknown> | null }> {
  if (c.action === 'add') {
    const [last] = (await sql`
      SELECT COALESCE(MAX((payload->>'position')::int), -1) AS position FROM lift_rows
      WHERE entity = 'templateExercise' AND deleted_at IS NULL AND lower(payload->>'templateID') = lower(${c.templateId})`) as { position: number }[];
    const units = (await sql`
      SELECT payload->>'weightUnit' AS unit FROM lift_rows WHERE entity = 'templateExercise' AND deleted_at IS NULL
        AND payload->>'weightUnit' IS NOT NULL LIMIT 1`) as { unit: string }[];
    const id = crypto.randomUUID().toUpperCase();
    const at = now.toISOString();
    await pushRow(slotPayload(c, null, { now: at, id, position: Number(last?.position ?? -1) + 1, unit: units[0]?.unit ?? 'lb' }), 'insert');
    return { slotId: id, before: null };
  }
  const current = c.slotId ? await slotRow(c.slotId) : null;
  if (!current || current.deletedAt) throw new Error(`${c.exercise} is no longer in ${c.template}`);
  const next = slotPayload(c, current, { now: stampAfter(current, now), id: String(current.id), position: Number(current.position ?? 0), unit: 'lb' });
  await pushRow(next, c.action === 'remove' ? 'delete' : 'update');
  return { slotId: String(current.id), before: current };
}

/** Undo of a template change: the slot as it was (back from deleted), or an added slot deleted. */
export async function undoTemplateChange(slotId: string, before: Record<string, unknown> | null, now = new Date()): Promise<void> {
  const current = await slotRow(slotId);
  if (!current) return;
  const at = stampAfter(current, now);
  if (!before) {
    await pushRow({ ...current, updatedAt: at, deletedAt: at }, 'delete');
    return;
  }
  await pushRow({ ...before, updatedAt: at, deletedAt: null }, 'update');
}
