/**
 * What the planning screen can do to a week's draft, for the web (plan/week/actions.ts) and the phone
 * (/api/app/plan/week). Each takes the owner's id; the caller checks who is asking. Coach drafts in the background of
 * the request (`after`), up to 5 minutes, so a route that calls draft or revise needs maxDuration 300.
 */

import { after } from 'next/server';
import { sql } from '@/db';
import { HOME_TZ, pushWeek } from '@/lib/calendar-sync/push.mjs';
import { cleanRequest } from '@/lib/plan/proposal.mjs';
import {
  acceptProposal, createRequest, dispatchWorkflow, editDraft, rejectProposal, reviseRequest, undoRevision, weekProposal, type PlanRequest,
} from '@/lib/plan/proposals';
import { plannerReady, runPlanner } from '@/lib/planner/run';
import { mondayOf, todayIn } from '@/lib/plan/week.mjs';

export type OpResult = { ok: true } | { error: string };
export type EditOp = { kind: 'move' | 'length' | 'remove'; index: number; date?: string; time?: string; minutes?: number };
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Words for the version list when Paolo redraws with new answers. */
function answersNote(a: PlanRequest): string {
  const parts = [
    a.feel && `feeling ${a.feel}`,
    a.hours != null && `${a.hours} h`,
    a.gym != null && `${a.gym} lifts`,
    a.hard != null && `${a.hard} hard`,
    a.longDay && `long day ${new Date(`${a.longDay}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}`,
    a.daysOff?.length && `${a.daysOff.length} rest day${a.daysOff.length > 1 ? 's' : ''}`,
    a.away?.length && `travelling ${a.away.length} day${a.away.length > 1 ? 's' : ''}`,
    a.busy?.length && `${a.busy.length} busy day${a.busy.length > 1 ? 's' : ''}`,
    a.sick?.length && `sick ${a.sick.length} day${a.sick.length > 1 ? 's' : ''}`,
    a.lock && a.lock,
  ].filter(Boolean);
  return `New answers: ${parts.join(', ') || 'Coach decides from the data'}.`;
}

/**
 * Draft the week (no draft yet, or the last one failed) or redraw it with new answers (a new version of the open
 * draft). A week that has started is a check-in.
 */
export async function draftWeek(userId: string, weekStart: string, input: Record<string, unknown>): Promise<OpResult> {
  if (!DAY.test(String(weekStart))) return { error: 'Pick a week.' };
  const monday = mondayOf(String(weekStart));
  const ready = await plannerReady(userId);
  if (!ready.ready) return { error: ready.reason };
  const open = await weekProposal(userId, monday);
  if (open && (open.status === 'requested' || open.status === 'running')) return { error: 'Coach is already drafting this week.' };
  const kind = open?.request.kind ?? (monday <= mondayOf(todayIn(HOME_TZ)) ? 'checkin' : 'weekly');
  const clean = cleanRequest({ ...(input ?? {}), weekStart: monday, kind }) as { value?: PlanRequest; error?: string };
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
  return { ok: true };
}

/** "Tell Coach what to change": a new version from Paolo's note. */
export async function reviseDraft(userId: string, id: string, note: string): Promise<OpResult> {
  const ready = await plannerReady(userId);
  if (!ready.ready) return { error: ready.reason };
  const r = await reviseRequest(userId, String(id), String(note ?? ''));
  if ('error' in r) return r;
  after(() => runPlanner(userId, r.id));
  return { ok: true };
}

/** Undo the last change: the version before is open again. */
export async function undoDraft(userId: string, id: string): Promise<OpResult> {
  const r = await undoRevision(userId, String(id));
  return 'error' in r ? r : { ok: true };
}

/** Move, shorten or remove one session of the draft. */
export async function editDraftSession(userId: string, id: string, op: EditOp): Promise<OpResult> {
  const r = await editDraft(userId, String(id), op);
  return 'error' in r ? r : { ok: true };
}

/**
 * Accept: the week goes into Coach and onto Google Calendar now; plan-apply.yml then plans the Lift sessions and
 * the Garmin and Zwift workouts. Every workout syncs, always.
 */
export async function acceptDraft(userId: string, id: string): Promise<{ weekStart: string; note: string } | { error: string }> {
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
  return {
    weekStart: r.weekStart,
    note: 'error' in apply
      ? `On your calendar now. Lift, Garmin and Zwift did not start: ${apply.error}`
      : 'On your calendar now. Lift, Garmin and Zwift follow in a few minutes.',
  };
}
