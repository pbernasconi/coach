'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { sql } from '@/db';
import { pushWeek } from '@/lib/calendar-sync/push.mjs';
import { ownerForSignedInUser } from '@/lib/owner';
import { cleanRequest } from '@/lib/plan/proposal.mjs';
import {
  acceptProposal, createRequest, dispatchWorkflow, openProposal, proposalById, rejectProposal, type PlanRequest, type Proposal,
} from '@/lib/plan/proposals';
import { loadOutlook, loadPlanningContext, type PlanningContext, type WeekOutlook } from '@/lib/plan/planning-context';
import { plannerRunner, runServerPlan } from '@/lib/planner/run';
import { mondayOf } from '@/lib/plan/week.mjs';

async function user() {
  const userId = await ownerForSignedInUser();
  if (!userId) throw new Error('Not signed in');
  return userId;
}

/**
 * "Plan with Coach": stores the request and plans it: on the server with the Claude API when that is on (a weekly
 * plan; src/lib/planner/run.ts, in the background of this request, up to 5 minutes), else the cloud job (plan.yml).
 */
export async function requestPlanAction(input: Record<string, unknown>): Promise<{ id: string } | { error: string }> {
  const userId = await user();
  const clean = cleanRequest(input) as { value?: PlanRequest; error?: string };
  if (!clean.value) return { error: clean.error ?? 'The request is not valid.' };
  const id = await createRequest(userId, clean.value);
  if (clean.value.kind === 'weekly' && (await plannerRunner(userId)).server) {
    after(() => runServerPlan(userId, id));
    revalidatePath('/plan');
    return { id };
  }
  const started = await dispatchWorkflow('plan.yml', { proposal_id: id });
  if ('error' in started) {
    await sql`UPDATE plan_proposals SET status = 'failed', error = ${started.error}, updated_at = NOW() WHERE id = ${id}`;
    revalidatePath('/plan');
    return { error: started.error };
  }
  revalidatePath('/plan');
  return { id };
}

/** What Coach knows before planning the week of `weekStart`, for the "Plan with Coach" form. */
export async function planningContextAction(weekStart: string): Promise<PlanningContext | null> {
  const userId = await user();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(weekStart))) return null;
  return loadPlanningContext(userId, mondayOf(String(weekStart)));
}

/** The proposal's load outlook (fitness and form in and out, TSS against the last 4 weeks), for the review. */
export async function proposalOutlookAction(id: string): Promise<WeekOutlook | null> {
  const userId = await user();
  const p = await proposalById(userId, String(id));
  return p ? loadOutlook(userId, p) : null;
}

/** The open request or proposal, for the Plan page to watch while the job runs. */
export async function openProposalAction(): Promise<Proposal | null> {
  return openProposal(await user());
}

/**
 * Accept: the plan goes into Coach and onto Google Calendar now; plan-apply.yml then plans the Lift sessions and
 * the Garmin runs (a few minutes).
 */
export async function acceptProposalAction(id: string): Promise<{ weekStart: string; note: string } | { error: string }> {
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
  const c = r.counts;
  return {
    weekStart: r.weekStart,
    note: `${c.inserted} added, ${c.updated} changed, ${c.deleted} removed, ${c.kept} kept from your web changes.` +
      ('error' in apply ? ` Lift and Garmin were not started: ${apply.error}` : ' Lift sessions and Garmin follow in a few minutes.'),
  };
}

export async function rejectProposalAction(id: string) {
  const userId = await user();
  await rejectProposal(userId, String(id));
  revalidatePath('/plan');
}
