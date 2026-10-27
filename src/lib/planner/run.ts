/**
 * The planner: Coach plans a week (and a check-in on a week that has started) with the Claude API. It builds the
 * athlete profile (profile.mjs), asks Claude for the plan (loop.mjs), checks it against the format and Paolo's rules,
 * and saves it as a proposal for him to review. This is the only planner: there is no local or GitHub one.
 *
 * It needs ANTHROPIC_API_KEY in Vercel, and stops for the month at the cap (cost.mjs). A run that can't plan marks
 * the request failed with the reason, and the Plan page offers to try again.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createId } from '@paralleldrive/cuid2';
import { sql } from '@/db';
import { toIso } from '@/lib/db-time.mjs';
import { checkPlan } from '@/lib/plan/proposal.mjs';
import { checkProposal, todayOf } from '@/lib/plan/rules.mjs';
import { claimRequest, failRequest, submitPlan, type PlanRequest } from '@/lib/plan/proposals';
import { monthSpend as spendOn, recordAiUsage } from '@/lib/ai-usage/store';
import { PLANNER_FEATURES } from '@/lib/ai-usage/usage.mjs';
import { PLANNER_MONTHLY_CAP_USD } from './cost.mjs';
import { currentWeekText } from './current-week.mjs';
import { MODEL, planWithClaude, type CheckResult } from './loop.mjs';
import { buildProfile } from './profile.mjs';
import { PROMPT_VERSION, systemPrompt, userMessage } from './prompt.mjs';

/** The last Claude request starts before this; the function stops at 300 s (maxDuration). */
const BUDGET_MS = 170_000;
/** How hard the planner thinks: a week plan is worth the wait. */
const EFFORT = 'medium';

type Row = Record<string, unknown>;

/** What this month's planner runs cost so far, in USD. */
export async function monthSpend(userId: string): Promise<number> {
  return spendOn(userId, PLANNER_FEATURES);
}

export type Readiness = { ready: boolean; reason: string; spent: number };

/** Whether the planner can run now, and why not when it can't. */
export async function plannerReady(userId: string): Promise<Readiness> {
  if (!process.env.ANTHROPIC_API_KEY) return { ready: false, reason: 'Coach has no Claude API key (ANTHROPIC_API_KEY in Vercel).', spent: 0 };
  const spent = await monthSpend(userId);
  if (spent >= PLANNER_MONTHLY_CAP_USD) {
    return { ready: false, reason: `This month's $${PLANNER_MONTHLY_CAP_USD} planner budget is used. It resets on the 1st.`, spent };
  }
  return { ready: true, reason: 'Ready', spent };
}

export type PlannerStatus = Readiness & { cap: number; lastRun: { at: string | null; status: string; costUsd: number } | null };

/** The Settings panel: whether the planner is ready, this month's spend, and the last run. */
export async function loadPlannerStatus(userId: string): Promise<PlannerStatus> {
  const readiness = await plannerReady(userId);
  const [last] = (await sql`
    SELECT created_at, status, cost_usd FROM plan_runs WHERE user_id = ${userId} AND kind = 'plan'
    ORDER BY created_at DESC LIMIT 1`) as Row[];
  return {
    ...readiness,
    cap: PLANNER_MONTHLY_CAP_USD,
    lastRun: last ? { at: toIso(last.created_at), status: String(last.status), costUsd: Number(last.cost_usd) } : null,
  };
}

/**
 * Checks a draft: the format first (a plan that fails it can't be saved), then Paolo's rules. `today` is the
 * check-in's day (R17: past days stay as they were).
 */
export function checkDraft(plan: unknown, opts: { weekStart: string; request: PlanRequest; context: unknown; today: string | null }): CheckResult {
  const format = checkPlan(plan, opts.weekStart).errors;
  if (format.length) return { ok: false, problems: format, saveable: false };
  const { issues } = checkProposal(plan, opts);
  const fails = issues.filter((i: { level: string }) => i.level === 'fail').map((i: { id: string; message: string }) => `${i.id}: ${i.message}`);
  return fails.length ? { ok: false, problems: fails, saveable: true } : { ok: true };
}

const STOPS: Record<string, string> = {
  deadline: 'it ran out of time',
  refusal: 'Claude declined to plan it',
  max_tokens: 'the answer was too long',
  no_submit: 'Claude answered without a plan',
  repairs_used: 'the plan still broke a format rule after 3 tries',
  turns_used: 'it used all its turns',
};

/** Plans the request `proposalId`. Never throws: a run that can't plan marks the request failed, with the reason. */
export async function runPlanner(userId: string, proposalId: string): Promise<{ ok: boolean; stop: string }> {
  const started = Date.now();
  const readiness = await plannerReady(userId);
  if (!readiness.ready) {
    await failRequest(userId, proposalId, readiness.reason);
    return { ok: false, stop: 'not_ready' };
  }
  const claimed = await claimRequest(userId, proposalId);
  if (!claimed) return { ok: false, stop: 'not_open' };
  const request = claimed.request;
  const runId = createId();
  await sql`
    INSERT INTO plan_runs (id, user_id, proposal_id, kind, model, prompt_version, status)
    VALUES (${runId}, ${userId}, ${proposalId}, 'plan', ${MODEL}, ${PROMPT_VERSION}, 'running')`;
  try {
    const profile = await buildProfile(sql, { userId, weekOf: request.weekStart });
    const context: Record<string, unknown> = { ...profile.json };
    delete context.user;
    const checkin = request.kind === 'checkin';
    const today = checkin ? todayOf(context) : null;
    const result = await planWithClaude({
      client: new Anthropic({ timeout: 280_000, maxRetries: 2 }),
      system: systemPrompt(),
      user: userMessage({
        request, profileMd: profile.md, today,
        currentWeek: checkin ? await currentWeekText(sql, userId, request.weekStart) : null,
      }),
      check: (plan) => checkDraft(plan, { weekStart: request.weekStart, request, context, today }),
      effort: EFFORT,
      deadline: started + BUDGET_MS,
    });
    const saved = result.plan ? await submitPlan(userId, proposalId, result.plan, result.summary, context) : null;
    const ok = Boolean(saved && !('error' in saved));
    await sql`
      UPDATE plan_runs SET status = ${ok ? 'ok' : 'failed'}, stop = ${result.stop}, turns = ${result.turns}, submits = ${result.submits},
        first_draft_problems = ${JSON.stringify(result.firstDraftProblems ?? [])}::jsonb,
        input_tokens = ${result.usage.input}, output_tokens = ${result.usage.output},
        cache_read_tokens = ${result.usage.cacheRead}, cache_write_tokens = ${result.usage.cacheWrite},
        cost_usd = ${result.usage.usd}, duration_ms = ${Date.now() - started},
        error = ${saved && 'error' in saved ? String(saved.error).slice(0, 500) : null}
      WHERE id = ${runId}`;
    await recordAiUsage(userId, {
      feature: 'planner', model: result.model ?? MODEL, effort: EFFORT, usage: result.usage, durationMs: Date.now() - started, ok, refId: runId,
    });
    // submitPlan already marked a plan that failed the format; this covers a run that produced no plan.
    if (!saved) await failRequest(userId, proposalId, `The planner stopped: ${STOPS[result.stop] ?? result.stop}. Try again.`);
    return { ok, stop: result.stop };
  } catch (error) {
    const message = error instanceof Anthropic.APIError ? `Claude API error ${error.status ?? ''}`.trim() : error instanceof Error ? error.message : 'unknown error';
    console.error('Planner failed:', message);
    await sql`
      UPDATE plan_runs SET status = 'failed', error = ${message.slice(0, 500)}, duration_ms = ${Date.now() - started}
      WHERE id = ${runId}`;
    await recordAiUsage(userId, { feature: 'planner', model: MODEL, effort: EFFORT, durationMs: Date.now() - started, ok: false, refId: runId });
    await failRequest(userId, proposalId, `The planner failed (${message}). Try again.`);
    return { ok: false, stop: 'error' };
  }
}
