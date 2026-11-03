'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { ownerForSignedInUser } from '@/lib/owner';
import { editTemplate, replanLifts } from '@/lib/lift/templates';
import type { TemplateEdit } from '@/lib/lift/templates.mjs';

/**
 * One edit from the template library: saves it through Lift sync (the iPhone pulls it) and, after the response,
 * re-plans the lifts on it that have not started.
 */
export async function editTemplateAction(edit: TemplateEdit): Promise<{ ok: true; changed: boolean } | { error: string }> {
  if (!(await ownerForSignedInUser())) return { error: 'Not signed in' };
  const r = await editTemplate(edit);
  if ('error' in r) return r;
  if (r.changed) {
    revalidatePath('/lift/templates');
    after(replanLifts);
  }
  return { ok: true, changed: r.changed };
}
