'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { sql } from '@/db';
import { pushWeek } from '@/lib/calendar-sync/push.mjs';
import { ownerForSignedInUser } from '@/lib/owner';
import { cleanRequest } from '@/lib/plan/proposal.mjs';
import {
  acceptProposal, createRequest, dispatchWorkflow, editDraft, rejectProposal, reviseRequest, undoRevision, weekProposal, type PlanRequest,
} from '@/lib/plan/proposals';
import { loadPlannerWeek, type PlannerWeek } from '@/lib/plan/planner-week';
import { plannerReady, runPlanner } from '@/lib/planner/run';
import { HOME_TZ } from '@/lib/calendar-sync/push.mjs';
import { mondayOf, todayIn } from '@/lib/plan/week.mjs';

type Result = { ok: true } | { error: string };
const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function user() {
  const userId = await ownerForSignedInUser();
  if (!userId) throw new Error('Not signed in');
  return userId;
}

/** The planning screen's data, for the screen to refresh while Coach drafts. */
export async function plannerWeekAction(weekStart: string): Promise<PlannerWeek | null> {
  const userId = await user();
  if (!DAY.test(String(weekStart))) return null;
  return loadPlannerWeek(userId, mondayOf(String(weekStart)));
}

/** The answers on the Shape panel, as the planner reads them (cleanRequest), or { error }. */
function answersOf(weekStart: string, kind: 'weekly' | 'checkin', input: Record<string, unknown>) {
  return cleanRequest({ ...input, weekStart, kind }) as { value?: PlanRequest; error?: string };
}

/** Words for the version list when Paolo redraws with new answers. */
function answersNote(a: PlanRequest): string {
  const parts = [
    a.feel && `feeling ${a.feel}`,
    a.hours != null && `${a.hours} h`,
    a.gym != null && `${a.gym} lifts`,
    a.hard != null && `${a.hard} hard`,
    a.longDay && `long day ${new Date(`${a.longDay}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}`,
    a.daysOff?.length && `${a.daysOff.length} day${a.daysOff.length > 1 ? 's' : ''} off`,
    a.lock && a.lock,
  ].filter(Boolean);
  return `New answers: ${parts.join(', ') || 'Coach decides from the data'}.`;
}

/**
 * Draft the week (no draft yet, or the last one failed) or redraw it with new answers (a new version of the open
 * draft). Coach plans in the background of this request, up to 5 minutes; the screen watches it.
 */
export async function draftWeekAction(weekStart: string, input: Record<string, unknown>): Promise<Result> {
  const userId = await user();
  if (!DAY.test(String(weekStart))) return { error: 'Pick a week.' };
  const monday = mondayOf(String(weekStart));
  const ready = await plannerReady(userId);
  if (!ready.ready) return { error: ready.reason };
  const open = await weekProposal(userId, monday);
  if (open && (open.status === 'requested' || open.status === 'running')) return { error: 'Coach is already drafting this week.' };
  const kind = open?.request.kind ?? (monday <= mondayOf(todayIn(HOME_TZ)) ? 'checkin' : 'weekly');
  const clean = answersOf(monday, kind, input);
  if (!clean.value) return { error: clean.error ?? 'Those answers are not valid.' };
  let id: string;
  if (open?.status === 'proposed') {
    const r = await reviseRequest(userId, open.id, answersNote(clean.value), clean.value);
    if ('error' in r) return r;
    id = r.id;
  } else {
    if (open?.status === 'failed') await rejectProposal(userId, open.id);
    id = await createRequest(userId, clean.value);
  }
  after(() => runPlanner(userId, id));
  revalidatePath('/plan/week');
  return { ok: true };
}

/** "Tell Coach what to change": a new version from Paolo's note. */
export async function reviseDraftAction(id: string, note: string): Promise<Result> {
  const userId = await user();
  const ready = await plannerReady(userId);
  if (!ready.ready) return { error: ready.reason };
  const r = await reviseRequest(userId, String(id), String(note ?? ''));
  if ('error' in r) return r;
  after(() => runPlanner(userId, r.id));
  revalidatePath('/plan/week');
  return { ok: true };
}

/** Undo the last change: the version before is open again. */
export async function undoDraftAction(id: string): Promise<Result> {
  const userId = await user();
  const r = await undoRevision(userId, String(id));
  if ('error' in r) return r;
  revalidatePath('/plan/week');
  return { ok: true };
}

/** Move, shorten or remove one session of the draft (the calendar drag, the session panel). */
export async function editDraftAction(
  id: string, op: { kind: 'move' | 'length' | 'remove'; index: number; date?: string; time?: string; minutes?: number },
): Promise<Result> {
  const userId = await user();
  const r = await editDraft(userId, String(id), op);
  if ('error' in r) return r;
  revalidatePath('/plan/week');
  return { ok: true };
}

/**
 * Accept: the week goes into Coach and onto Google Calendar now; plan-apply.yml then plans the Lift sessions and
 * the Garmin and Zwift workouts. Every workout syncs, always.
 */
export async function acceptDraftAction(id: string): Promise<{ weekStart: string; note: string } | { error: string }> {
  const userId = await user();
  const r = await acceptProposal(userId, String(id));
  if ('error' in r) return { error: r.error };
  after(async () => {
    try {
      await pushWeek(sql, userId, r.weekStart);
    } catch (error) {
      console.error('Calendar push after accept failed:', error);
    }
  });
  const apply = await dispatchWorkflow('plan-apply.yml');
  revalidatePath('/plan');
  revalidatePath('/plan/week');
  return {
    weekStart: r.weekStart,
    note: 'error' in apply
      ? `On your calendar now. Lift, Garmin and Zwift did not start: ${apply.error}`
      : 'On your calendar now. Lift, Garmin and Zwift follow in a few minutes.',
  };
}
