/**
 * The Coach chat's goals, races and week planning on the server (goal-tools.mjs has the pure parts): get_goals, and
 * Apply and Undo of { op: "event" | "goal" | "plan_week" }. The same tables and writes as Settings → Events, Settings →
 * Goals and the planning screen. No Next.js here: server.ts starts the planner run after Apply.
 */

import { createId } from '@paralleldrive/cuid2';
import { sql } from '@/db';
import { cleanGoals, loadGoals, measureGoals, saveGoals } from '@/lib/goals/goals.mjs';
import { loadEvents } from '@/lib/performance/events';
import { createRequest, rejectProposal, reviseRequest, undoRevision, weekProposal, type PlanRequest } from '@/lib/plan/proposals';
import { mondayOf } from '@/lib/plan/week.mjs';
import { goalsText, type CoachEvent, type EventChange, type EventFields, type Goal, type GoalChange, type WeekPlanChange } from './goal-tools.mjs';

/** His events and milestone goals, for checking a change. */
export async function loadGoalContext(userId: string): Promise<{ events: CoachEvent[]; goals: Goal[] }> {
  const [events, goals] = await Promise.all([loadEvents(userId), loadGoals(sql, userId) as Promise<Goal[]>]);
  return { events, goals };
}

/** get_goals. */
export async function runGoalTool(userId: string, today: string): Promise<{ ok: boolean; text: string }> {
  const { events, goals } = await loadGoalContext(userId);
  const measured = await measureGoals(sql, userId, goals, today);
  return { ok: true, text: goalsText(events, measured, today) };
}

/** Undo steps for these changes (writes.ts adds them to its Undo union). */
export type GoalUndo =
  | { op: 'event'; id: string; before: (EventFields & { id: string }) | null }
  | { op: 'goal'; id: string; before: Goal | null }
  | { op: 'plan_week'; proposalId: string; revised: boolean };

async function putEvent(userId: string, id: string, e: EventFields, insert: boolean) {
  if (insert) {
    await sql`
      INSERT INTO events (id, user_id, name, date, priority, sport, notes, target)
      VALUES (${id}, ${userId}, ${e.name}, ${e.date}, ${e.priority}, ${e.sport}, ${e.notes}, ${e.target})`;
    return;
  }
  const rows = (await sql`
    UPDATE events SET name = ${e.name}, date = ${e.date}, priority = ${e.priority}, sport = ${e.sport},
           notes = ${e.notes}, target = ${e.target}, updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId} RETURNING id`) as unknown[];
  if (!rows.length) throw new Error('that event is gone');
}

export async function applyEventChange(userId: string, c: EventChange): Promise<GoalUndo> {
  if (c.action === 'add' && c.event) {
    const id = createId();
    await putEvent(userId, id, c.event, true);
    return { op: 'event', id, before: null };
  }
  const [row] = (await sql`
    SELECT id, name, to_char(date, 'YYYY-MM-DD') AS date, priority, sport, notes, target FROM events
    WHERE id = ${c.id} AND user_id = ${userId}`) as (EventFields & { id: string })[];
  if (!row) throw new Error(`${c.was?.name ?? 'that event'} is no longer in your events`);
  if (c.action === 'remove') await sql`DELETE FROM events WHERE id = ${row.id} AND user_id = ${userId}`;
  else if (c.event) await putEvent(userId, row.id, c.event, false);
  return { op: 'event', id: row.id, before: row };
}

/** Saves the goals with `edit` applied to the list as it is now (Paolo may have changed others since). */
async function editGoals(userId: string, edit: (goals: Goal[]) => Goal[]) {
  const goals = (await loadGoals(sql, userId)) as Goal[];
  await saveGoals(sql, userId, cleanGoals(edit(goals)));
}

export async function applyGoalChange(userId: string, c: GoalChange): Promise<GoalUndo> {
  let before: Goal | null = null;
  await editGoals(userId, (goals) => {
    before = goals.find((g) => g.id === c.id) ?? null;
    if (c.action !== 'add' && !before) throw new Error(`${c.was?.title ?? 'that goal'} is no longer in your goals`);
    if (c.action === 'remove') return goals.filter((g) => g.id !== c.id);
    if (c.action === 'add') return [...goals, c.goal as Goal];
    return goals.map((g) => (g.id === c.id ? (c.goal as Goal) : g));
  });
  return { op: 'goal', id: c.id, before };
}

/**
 * Asks the planner for the week (the planning screen's Draft): a new draft, or a new version of the open one with the
 * chat's answers. Returns the request to run (server.ts runs the planner after Apply) and its Undo.
 */
export async function startWeekDraft(userId: string, c: WeekPlanChange, today: string): Promise<GoalUndo> {
  const monday = mondayOf(String(c.request.weekStart));
  const open = await weekProposal(userId, monday);
  if (open && (open.status === 'requested' || open.status === 'running')) throw new Error('Coach is already drafting that week');
  const kind = monday <= mondayOf(today) ? 'checkin' : 'weekly';
  const request = { ...c.request, weekStart: monday, kind } as PlanRequest;
  if (open?.status === 'proposed') {
    const r = await reviseRequest(userId, open.id, String(c.request.lock ?? '') || 'New answers from the Coach chat.', request);
    if ('error' in r) throw new Error(r.error);
    return { op: 'plan_week', proposalId: r.id, revised: true };
  }
  if (open?.status === 'failed') await rejectProposal(userId, open.id);
  return { op: 'plan_week', proposalId: await createRequest(userId, request), revised: false };
}

export async function undoGoalStep(userId: string, u: GoalUndo): Promise<void> {
  if (u.op === 'event') {
    if (!u.before) await sql`DELETE FROM events WHERE id = ${u.id} AND user_id = ${userId}`;
    else {
      const [here] = (await sql`SELECT id FROM events WHERE id = ${u.id} AND user_id = ${userId}`) as unknown[];
      await putEvent(userId, u.id, u.before, !here);
    }
    return;
  }
  if (u.op === 'goal') {
    const before = u.before;
    await editGoals(userId, (goals) => {
      const rest = goals.filter((g) => g.id !== u.id);
      return before ? [...rest, before] : rest;
    });
    return;
  }
  // A week draft: the version before comes back, or the new draft is set aside. An accepted one stays.
  if (u.revised) {
    const r = await undoRevision(userId, u.proposalId);
    if ('error' in r) throw new Error(r.error);
  } else await rejectProposal(userId, u.proposalId);
}
