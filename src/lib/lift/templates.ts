/**
 * Lift templates for the web's template library (Lift → Templates) and the Coach chat: read them in full with the
 * planned lifts on each, and apply one edit. Every write goes through the Lift sync push code, so the iPhone pulls it
 * like its own edit, and starts plan-apply.yml so the lifts on the template that have not started are planned again.
 * The slot reads and writes are the chat's (src/lib/coach-chat/lift-tools.ts); the edit checks are in templates.mjs.
 */

import { sql } from '@/db';
import { push } from '@/lib/lift-sync/sync.mjs';
import { drizzleLiftRepository } from '@/lib/lift-sync/drizzle-repository';
import { applyTemplateChange, loadLiftTemplates } from '@/lib/coach-chat/lift-tools';
import type { LiftTemplate } from '@/lib/coach-chat/lift-tools.mjs';
import { exerciseMedia } from '@/lib/lift/catalog';
import { dispatchWorkflow } from '@/lib/plan/proposals';
import { addDays } from '@/lib/plan/week.mjs';
import { cleanTemplateEdit, type TemplateEdit } from './templates.mjs';

export { applyTemplateChange, loadLiftTemplates, undoTemplateChange } from '@/lib/coach-chat/lift-tools';

export type TemplateSlotView = {
  id: string;
  exercise: string;
  sets: number;
  repMin: number;
  repMax: number;
  weight: number | null;
  unit: string | null;
  rest: number | null;
  note: string | null;
  image: string | null;
  gif: string | null;
};
export type TemplateView = { id: string; name: string; slots: TemplateSlotView[]; planned: { day: string; title: string }[] };
export type TemplateLibrary = { templates: TemplateView[]; library: { id: string; name: string }[] };

/** The templates in list order, each slot with its catalog picture and each template with its lifts in the next 4 weeks. */
export async function loadTemplateLibrary(userId: string, today: string): Promise<TemplateLibrary> {
  const [{ templates, library }, catalogIds, planned] = await Promise.all([
    loadLiftTemplates(),
    sql`
      SELECT lower(id::text) AS id, payload->>'catalogID' AS catalog FROM lift_rows
      WHERE entity = 'exercise' AND deleted_at IS NULL AND payload->>'catalogID' IS NOT NULL` as unknown as Promise<{ id: string; catalog: string }[]>,
    sql`
      SELECT to_char(a.scheduled_date, 'YYYY-MM-DD') AS day, a.lift_template AS template, a.title
        FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
       WHERE p.user_id = ${userId} AND a.lift_template IS NOT NULL AND a.status IS DISTINCT FROM 'skipped'
         AND a.scheduled_date >= ${today} AND a.scheduled_date <= ${addDays(today, 27)}
       ORDER BY a.scheduled_date` as unknown as Promise<{ day: string; template: string; title: string | null }[]>,
  ]);
  const catalog = new Map(catalogIds.map((r) => [r.id, r.catalog]));
  return {
    library,
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      planned: planned.filter((p) => p.template.toLowerCase() === t.name.toLowerCase()).map((p) => ({ day: p.day, title: p.title ?? t.name })),
      slots: t.slots.map((s) => {
        const media = exerciseMedia(s.exerciseId ? catalog.get(s.exerciseId.toLowerCase()) : null);
        return {
          id: s.id, exercise: s.exercise, sets: s.sets, repMin: s.repMin, repMax: s.repMax, weight: s.weight, unit: s.unit,
          rest: s.rest, note: s.note, image: media?.image ?? null, gif: media?.gif ?? null,
        };
      }),
    })),
  };
}

async function templateRow(templates: LiftTemplate[], edit: TemplateEdit): Promise<Record<string, unknown> | null> {
  if (edit.kind !== 'rename') return null;
  const t = templates.find((x) => x.id.toLowerCase() === String(edit.templateId).toLowerCase());
  if (!t) return null;
  const [r] = (await sql`SELECT payload FROM lift_rows WHERE entity = 'template' AND id = ${t.id}::uuid AND deleted_at IS NULL`) as { payload: Record<string, unknown> }[];
  return r?.payload ?? null;
}

/**
 * Applies one template edit. Returns `changed: false` when the value was already that. A change starts
 * plan-apply.yml (queued: a burst of edits re-plans once more after the run in progress).
 */
export async function editTemplate(edit: TemplateEdit): Promise<{ changed: boolean } | { error: string }> {
  const lift = await loadLiftTemplates();
  const checked = cleanTemplateEdit(edit, lift, await templateRow(lift.templates, edit));
  if ('problem' in checked) return { error: checked.problem };
  if ('none' in checked) return { changed: false };
  try {
    if ('change' in checked) await applyTemplateChange(checked.change);
    else {
      const result = await push(
        drizzleLiftRepository,
        checked.rows.map((r) => ({ idempotencyKey: crypto.randomUUID(), entity: r.entity, op: 'update', rowId: String(r.payload.id), payload: r.payload }))
      );
      if (result.rejected.length) return { error: `Lift refused the change: ${result.rejected[0].reason}` };
    }
  } catch (e) {
    return { error: String((e as Error)?.message ?? e) };
  }
  return { changed: true };
}

/** Plans the lifts on the changed templates again (plan-apply.yml). Never throws: the template change is saved. */
export async function replanLifts(): Promise<void> {
  const started = await dispatchWorkflow('plan-apply.yml').catch((e: unknown) => ({ error: String(e) }));
  if ('error' in started) console.error('Re-plan after a template edit failed:', started.error);
}
