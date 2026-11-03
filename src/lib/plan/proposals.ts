/**
 * Plans waiting for Paolo: requests (the Plan page, the Sunday run), the planner's results (src/lib/planner/run.ts),
 * and his accept or reject. The table is plan_proposals (src/db/plan-schema.ts); the checks are in proposal.mjs and
 * rules.mjs; an accept starts plan-apply.yml (Lift sessions, Garmin).
 */

import { createId } from '@paralleldrive/cuid2';
import { sql } from '@/db';
import { toDay, toIso } from '@/lib/db-time.mjs';
import { pushWeek } from '@/lib/calendar-sync/push.mjs';
import { followWorkoutInLift, removeFromLift } from '@/lib/lift/edit-store';
import { importPlan } from '@/lib/plan/import.mjs';
import { checkPlan } from '@/lib/plan/proposal.mjs';
import { checkProposal, todayOf } from '@/lib/plan/rules.mjs';
import { editPlan } from '@/lib/plan/draft.mjs';
import { cleanReview } from '@/lib/plan/review.mjs';
import type { StructuredWorkout } from '@/lib/plan/queries';
import { mondayOf } from '@/lib/plan/week.mjs';

export type PlanRequest = {
  kind: 'weekly' | 'checkin'; weekStart: string; feel: string | null; focus: string | null; lock: string | null;
  hours?: number | null; gym?: number | null; hard?: number | null; longDay?: string | null; daysOff?: string[]; away?: string[];
  /** Days with time for one short session; sick days (no training); Paolo's note per day. */
  busy?: string[]; sick?: string[]; notes?: Record<string, string>;
  /** A change Paolo asked for on the plan `fromId` (a note, or new answers on the planning screen); `version` counts from 1. */
  revise?: { fromId: string; note: string; version: number } | null;
};
export type ProposalStatus = 'requested' | 'running' | 'proposed' | 'accepted' | 'rejected' | 'failed';
export type ProposalRow = {
  id: string; title: string; date: string; startTime: string | null; duration: number | null; tss: number | null;
  activityType: string; workoutType: string | null; why: string | null; intensity: string | null; description: string | null;
  steps: StructuredWorkout | null;
};
export type ProposalReview = {
  headline: string | null; reasoning: string[]; decisions: { title: string; why: string | null; tradeoff: string | null }[]; watch: string[];
};
export type RuleIssue = { id: string; level: 'fail' | 'warn'; day: string | null; message: string };
export type ProposalChecks = { version: number; issues: RuleIssue[]; fails: number; warns: number };
export type Proposal = {
  id: string; status: ProposalStatus; request: PlanRequest; weekStart: string; summary: string | null; error: string | null;
  createdAt: string | null; updatedAt: string | null; rows: ProposalRow[];
  /** The coach's structured review (plan.review), or null for a plan with only the markdown summary. */
  review: ProposalReview | null;
  /** Paolo's planning rules on the plan as the planner wrote it (rules.mjs), or null for a plan from before them. */
  checks: ProposalChecks | null;
  /** 1 for a first draft, then one more for each change Paolo asked for. */
  version: number;
};

type Row = Record<string, unknown>;

function toProposal(r: Row): Proposal {
  const weekStart = (toDay(r.week_start) ?? '');
  const rows = r.plan ? checkPlan(r.plan, weekStart).rows : [];
  return {
    id: String(r.id),
    status: r.status as ProposalStatus,
    request: r.request as PlanRequest,
    weekStart,
    summary: (r.summary as string) ?? null,
    error: (r.error as string) ?? null,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
    rows: rows.map((x: Record<string, unknown>) => ({
      id: String(x.sourceKey), title: String(x.title), date: String(x.date), startTime: (x.startTime as string) ?? null,
      duration: (x.duration as number) ?? null, tss: (x.tss as number) ?? null, activityType: String(x.activityType),
      workoutType: (x.workoutType as string) ?? null, why: (x.why as string) ?? null, intensity: (x.intensity as string) ?? null,
      description: (x.description as string) ?? null, steps: (x.steps as StructuredWorkout) ?? null,
    })),
    review: r.plan ? cleanReview((r.plan as { review?: unknown }).review) : null,
    checks: cleanChecks(r.checks),
    version: Number((r.request as PlanRequest | null)?.revise?.version ?? 1),
  };
}

function cleanChecks(v: unknown): ProposalChecks | null {
  const c = v as ProposalChecks | null;
  return c && Array.isArray(c.issues) ? c : null;
}

/** A request from the Plan page. Returns its id. */
export async function createRequest(userId: string, req: PlanRequest): Promise<string> {
  const id = createId();
  await sql`
    INSERT INTO plan_proposals (id, user_id, kind, week_start, status, request)
    VALUES (${id}, ${userId}, ${req.kind}, ${req.weekStart}, 'requested', ${JSON.stringify(req)}::jsonb)`;
  return id;
}

/**
 * The planner takes the request `id`: marks it running. Null when it is not waiting, so a request that is already
 * running (a second trigger, a retried call) never runs twice.
 */
export async function claimRequest(userId: string, id: string): Promise<{ id: string; request: PlanRequest } | null> {
  const [r] = (await sql`
    UPDATE plan_proposals SET status = 'running', updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId} AND status = 'requested'
    RETURNING id, request`) as Row[];
  return r ? { id: String(r.id), request: r.request as PlanRequest } : null;
}

/**
 * The planner's plan. A plan that fails the format checks marks the request failed, with the reason. Paolo's planning
 * rules (rules.mjs) only report here: the result is stored with the plan and shown in the review. `context` is the
 * profile the planner planned from (the Past plans page shows it).
 */
export async function submitPlan(
  userId: string, id: string, plan: unknown, summary: string | null, context: unknown = null,
): Promise<{ error: string } | { events: number; tss: number; fails: number; warns: number }> {
  const [p] = (await sql`SELECT week_start, request FROM plan_proposals WHERE id = ${id} AND user_id = ${userId} AND status = 'running'`) as Row[];
  if (!p) return { error: 'No running request with that id.' };
  const weekStart = toDay(p.week_start) ?? '';
  const { errors, rows } = checkPlan(plan, weekStart);
  if (errors.length) {
    await failRequest(userId, id, `The plan did not pass the checks: ${errors.slice(0, 3).join(' ')}`);
    return { error: errors.join(' ') };
  }
  const request = p.request as PlanRequest;
  const ctx = context && typeof context === 'object' ? context : null;
  const checks = checkProposal(plan, { weekStart, request, context: ctx, today: request?.kind === 'checkin' ? todayOf(ctx) : null });
  await sql`
    UPDATE plan_proposals SET status = 'proposed', plan = ${JSON.stringify(plan)}::jsonb, summary = ${summary}, error = NULL,
      checks = ${JSON.stringify(checks)}::jsonb, context = ${ctx ? JSON.stringify(ctx) : null}::jsonb, updated_at = NOW()
    WHERE id = ${id} AND status = 'running'`;
  return {
    events: rows.length,
    tss: Math.round(rows.reduce((n: number, r: { tss?: number | null }) => n + (r.tss ?? 0), 0)),
    fails: checks.fails,
    warns: checks.warns,
  };
}

export async function failRequest(userId: string, id: string, error: string) {
  await sql`
    UPDATE plan_proposals SET status = 'failed', error = ${error.slice(0, 500)}, updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId} AND status IN ('requested', 'running')`;
}

/**
 * The request of the last 14 days that most needs Paolo, or null: a plan ready for review first, then one in
 * progress, then a failure (the newest of each). A failed rerun never hides a plan that is ready.
 */
export async function openProposal(userId: string): Promise<Proposal | null> {
  await sweepServerRuns(userId);
  const [r] = (await sql`
    -- Every column but context (tens of KB, for the evals only): the Plan page polls this while a job runs.
    SELECT id, user_id, kind, week_start, status, request, plan, summary, error, checks, created_at, updated_at, decided_at FROM plan_proposals
    WHERE user_id = ${userId} AND status IN ('requested', 'running', 'proposed', 'failed') AND created_at > NOW() - INTERVAL '14 days'
    ORDER BY CASE status WHEN 'proposed' THEN 0 WHEN 'running' THEN 1 WHEN 'requested' THEN 1 ELSE 2 END, created_at DESC
    LIMIT 1`) as Row[];
  return r ? toProposal(r) : null;
}

/**
 * A server planner run is cut off at 5 minutes (maxDuration), and a cut-off run can't record it. After 6 minutes
 * its request shows as failed, and a request the planner never started after 10 minutes too, so the Plan page
 * offers to try again instead of waiting forever.
 */
async function sweepServerRuns(userId: string) {
  await sql`
    UPDATE plan_proposals p SET status = 'failed', error = 'The planner ran out of time. Try again.', updated_at = NOW()
    WHERE p.user_id = ${userId} AND p.status = 'running' AND EXISTS (
      SELECT 1 FROM plan_runs r WHERE r.proposal_id = p.id AND r.status = 'running' AND r.created_at < NOW() - INTERVAL '6 minutes')`;
  await sql`
    UPDATE plan_proposals SET status = 'failed', error = 'The planner did not start. Try again.', updated_at = NOW()
    WHERE user_id = ${userId} AND status = 'requested' AND created_at < NOW() - INTERVAL '10 minutes'`;
  await sql`
    UPDATE plan_runs SET status = 'failed', error = 'Cut off at the time limit.'
    WHERE user_id = ${userId} AND status = 'running' AND created_at < NOW() - INTERVAL '6 minutes'`;
}

export async function proposalById(userId: string, id: string): Promise<Proposal | null> {
  const [r] = (await sql`SELECT id, user_id, kind, week_start, status, request, plan, summary, error, checks, created_at, updated_at, decided_at FROM plan_proposals WHERE id = ${id} AND user_id = ${userId}`) as Row[];
  return r ? toProposal(r) : null;
}

/**
 * Accept: the plan goes into Coach (the import keeps workouts changed on the web, and a check-in keeps the days before
 * it), then onto Google Calendar; plan-apply.yml then plans the Lift sessions and the Garmin runs.
 */
export async function acceptProposal(
  userId: string,
  id: string,
): Promise<{ error: string } | { weekStart: string; counts: { inserted: number; updated: number; kept: number; deleted: number } }> {
  const [r] = (await sql`SELECT kind, week_start, plan, summary, context FROM plan_proposals WHERE id = ${id} AND user_id = ${userId} AND status = 'proposed'`) as Row[];
  if (!r) return { error: 'This plan is no longer waiting for you.' };
  const weekStart = (toDay(r.week_start) ?? '');
  const keepBefore = r.kind === 'checkin' ? todayOf(r.context) : null;
  const { moved, liftGone, ...counts } = await importPlan(sql, userId, r.plan as object, (r.summary as string) ?? undefined, { keepBefore });
  // Lift follows the plan now, so the phone never shows a session on a day its workout left.
  for (const sessionId of liftGone) await removeFromLift(sessionId);
  for (const workoutId of moved) await followWorkoutInLift(workoutId);
  await sql`UPDATE plan_proposals SET status = 'accepted', decided_at = NOW(), updated_at = NOW() WHERE id = ${id}`;
  // Older open requests are now out of date.
  await sql`
    UPDATE plan_proposals SET status = 'rejected', decided_at = NOW(), updated_at = NOW(), error = 'Replaced by a newer plan.'
    WHERE user_id = ${userId} AND id <> ${id} AND status IN ('proposed', 'failed') AND week_start = ${weekStart}`;
  return { weekStart, counts };
}

/**
 * A change Paolo asked for on a draft: a new request for the same week with his note (and any new answers from the
 * planning screen), pointing at the draft it changes, so the planner keeps what he didn't mention (run.ts). The old
 * draft is set aside ("Changed on request.") and comes back on Undo. Returns the new request's id.
 */
export async function reviseRequest(
  userId: string, id: string, note: string, answers: Partial<PlanRequest> = {},
): Promise<{ id: string } | { error: string }> {
  const text = note.trim().slice(0, 1000);
  if (!text) return { error: 'Write what to change.' };
  const [r] = (await sql`SELECT request FROM plan_proposals WHERE id = ${id} AND user_id = ${userId} AND status = 'proposed'`) as Row[];
  if (!r) return { error: 'This draft is no longer open.' };
  const old = r.request as PlanRequest;
  const newId = await createRequest(userId, {
    ...old, ...answers, kind: old.kind, weekStart: old.weekStart, revise: { fromId: id, note: text, version: (old.revise?.version ?? 1) + 1 },
  });
  await sql`
    UPDATE plan_proposals SET status = 'rejected', decided_at = NOW(), updated_at = NOW(), error = 'Changed on request.'
    WHERE id = ${id} AND user_id = ${userId} AND status = 'proposed'`;
  return { id: newId };
}

/** The plan JSON of a proposal (the one a change starts from), or null. */
export async function planOf(userId: string, id: string): Promise<unknown> {
  const [r] = (await sql`SELECT plan FROM plan_proposals WHERE id = ${id} AND user_id = ${userId}`) as Row[];
  return r?.plan ?? null;
}

/**
 * Undo a change: the draft it was made from is open again and the change is set aside. Works on a changed draft
 * that is ready, still being planned, or failed.
 */
export async function undoRevision(userId: string, id: string): Promise<{ id: string } | { error: string }> {
  const [r] = (await sql`
    SELECT request FROM plan_proposals
    WHERE id = ${id} AND user_id = ${userId} AND status IN ('proposed', 'failed', 'requested', 'running')`) as Row[];
  const fromId = (r?.request as PlanRequest | undefined)?.revise?.fromId;
  if (!fromId) return { error: 'There is nothing to undo.' };
  const back = (await sql`
    UPDATE plan_proposals SET status = 'proposed', decided_at = NULL, updated_at = NOW(), error = NULL
    WHERE id = ${fromId} AND user_id = ${userId} AND status = 'rejected' AND error = 'Changed on request.'
    RETURNING id`) as Row[];
  if (!back.length) return { error: 'The draft before this change is gone.' };
  await sql`
    UPDATE plan_proposals SET status = 'rejected', decided_at = NOW(), updated_at = NOW(), error = 'Undone.'
    WHERE id = ${id} AND user_id = ${userId}`;
  return { id: fromId };
}

/**
 * Paolo moves, shortens or removes a session in a draft (draft.mjs). The plan checks run again on the changed week.
 */
export async function editDraft(
  userId: string, id: string, op: { kind: string; index: number; date?: string; time?: string; minutes?: number },
): Promise<{ ok: true } | { error: string }> {
  const [r] = (await sql`
    SELECT week_start, request, plan, context FROM plan_proposals WHERE id = ${id} AND user_id = ${userId} AND status = 'proposed'`) as Row[];
  if (!r) return { error: 'This draft is no longer open.' };
  const edited = editPlan(r.plan, op) as { plan?: unknown; error?: string };
  if (!edited.plan) return { error: edited.error ?? 'That change did not work.' };
  const weekStart = toDay(r.week_start) ?? '';
  const { errors } = checkPlan(edited.plan, weekStart);
  if (errors.length) return { error: errors[0] };
  const request = r.request as PlanRequest;
  const ctx = r.context && typeof r.context === 'object' ? r.context : null;
  const checks = checkProposal(edited.plan, { weekStart, request, context: ctx, today: request?.kind === 'checkin' ? todayOf(ctx) : null });
  await sql`
    UPDATE plan_proposals SET plan = ${JSON.stringify(edited.plan)}::jsonb, checks = ${JSON.stringify(checks)}::jsonb, updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId} AND status = 'proposed'`;
  return { ok: true };
}

/** The newest open request or draft for the week of `weekStart` (requested, running, proposed or failed), or null. */
export async function weekProposal(userId: string, weekStart: string): Promise<Proposal | null> {
  await sweepServerRuns(userId);
  const [r] = (await sql`
    SELECT id, user_id, kind, week_start, status, request, plan, summary, error, checks, created_at, updated_at, decided_at FROM plan_proposals
    WHERE user_id = ${userId} AND week_start = ${weekStart} AND status IN ('requested', 'running', 'proposed', 'failed')
    ORDER BY created_at DESC LIMIT 1`) as Row[];
  return r ? toProposal(r) : null;
}

export async function rejectProposal(userId: string, id: string) {
  await sql`
    UPDATE plan_proposals SET status = 'rejected', decided_at = NOW(), updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId} AND status IN ('proposed', 'failed', 'requested')`;
}

/** Pushes plan weeks to Google Calendar (the plan apply job, after Lift added the planned sets to the descriptions). */
export async function pushWeeks(userId: string, weeks: string[]) {
  const out = [];
  for (const w of weeks) out.push({ week: w, ...(await pushWeek(sql, userId, mondayOf(w))) });
  return out;
}

/**
 * Starts a workflow (plan-apply.yml after an accept) through the GitHub API. Needs GITHUB_DISPATCH_TOKEN in Vercel: a
 * fine-grained token for this repository with Actions: read and write.
 */
export async function dispatchWorkflow(file: string, inputs: Record<string, string> = {}): Promise<{ ok: true } | { error: string }> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return { error: 'GITHUB_DISPATCH_TOKEN is not set in Vercel, so Coach cannot start the job.' };
  const repo = process.env.GITHUB_REPO ?? 'pbernasconi/coach';
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${file}/dispatches`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
    body: JSON.stringify({ ref: 'main', inputs }),
    signal: AbortSignal.timeout(15_000),
  });
  return res.ok ? { ok: true } : { error: `GitHub refused to start ${file} (HTTP ${res.status}).` };
}
