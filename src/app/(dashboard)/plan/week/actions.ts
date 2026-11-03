'use server';

import { revalidatePath } from 'next/cache';
import { ownerForSignedInUser } from '@/lib/owner';
import { loadPlannerWeek, type PlannerWeek } from '@/lib/plan/planner-week';
import { acceptDraft, draftWeek, editDraftSession, reviseDraft, undoDraft, type EditOp, type OpResult } from '@/lib/plan/planner-ops';
import { mondayOf } from '@/lib/plan/week.mjs';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function user() {
  const userId = await ownerForSignedInUser();
  if (!userId) throw new Error('Not signed in');
  return userId;
}

function done<T extends object>(r: T, ...paths: string[]): T {
  for (const p of paths) revalidatePath(p);
  return r;
}

/** The planning screen's data, for the screen to refresh while Coach drafts. */
export async function plannerWeekAction(weekStart: string): Promise<PlannerWeek | null> {
  const userId = await user();
  if (!DAY.test(String(weekStart))) return null;
  return loadPlannerWeek(userId, mondayOf(String(weekStart)));
}

/** Draft the week, or redraw it with new answers (planner-ops.ts draftWeek). */
export async function draftWeekAction(weekStart: string, input: Record<string, unknown>): Promise<OpResult> {
  return done(await draftWeek(await user(), weekStart, input), '/plan/week');
}

/** "Tell Coach what to change": a new version from Paolo's note. */
export async function reviseDraftAction(id: string, note: string): Promise<OpResult> {
  return done(await reviseDraft(await user(), id, note), '/plan/week');
}

/** Undo the last change: the version before is open again. */
export async function undoDraftAction(id: string): Promise<OpResult> {
  return done(await undoDraft(await user(), id), '/plan/week');
}

/** Move, shorten or remove one session of the draft (the calendar drag, the session panel). */
export async function editDraftAction(id: string, op: EditOp): Promise<OpResult> {
  return done(await editDraftSession(await user(), id, op), '/plan/week');
}

/** Accept: into Coach and onto the calendar now; Lift, Garmin and Zwift follow (planner-ops.ts acceptDraft). */
export async function acceptDraftAction(id: string): Promise<{ weekStart: string; note: string } | { error: string }> {
  return done(await acceptDraft(await user(), id), '/plan', '/plan/week');
}
