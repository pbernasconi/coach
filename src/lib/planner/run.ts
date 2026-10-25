/**
 * The server planner: plans a week in Coach with the Claude API instead of the GitHub job (plan.yml). It builds the
 * same profile as /plan (profile.mjs), asks Claude for the plan (loop.mjs), checks it against the format and Paolo's
 * rules, and saves it as a proposal for him to review, exactly as the GitHub job's submit does.
 *
 * It runs when ANTHROPIC_API_KEY is set, the switch in Settings is on, and the month's spend is under the cap
 * (cost.mjs). Otherwise, and whenever a run fails, the GitHub job plans the request instead. Check-ins stay on the
 * GitHub job for now.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createId } from '@paralleldrive/cuid2';
import { sql } from '@/db';
import { toIso } from '@/lib/db-time.mjs';
import { checkPlan } from '@/lib/plan/proposal.mjs';
import { checkProposal } from '@/lib/plan/rules.mjs';
import { claimRequest, dispatchWorkflow, failRequest, submitPlan, type PlanRequest } from '@/lib/plan/proposals';
import { PLANNER_MONTHLY_CAP_USD } from './cost.mjs';
import { MODEL, planWithClaude, type CheckResult } from './loop.mjs';
import { buildProfile } from './profile.mjs';
import { PROMPT_VERSION, systemPrompt, userMessage } from './prompt.mjs';

/** The last Claude request starts before this; the function stops at 300 s (maxDuration). */
const BUDGET_MS = 170_000;

type Row = Record<string, unknown>;

/** What a month of planner runs cost so far, in USD. */
export async function monthSpend(userId: string, kind: 'plan' = 'plan'): Promise<number> {
  const [r] = (await sql`
    SELECT COALESCE(SUM(cost_usd), 0)::float AS usd FROM plan_runs
    WHERE user_id = ${userId} AND kind = ${kind} AND created_at >= date_trunc('month', NOW())`) as Row[];
  return Number(r?.usd ?? 0);
}

export type Runner = { server: boolean; reason: string; spent: number };

/** Whether the server plans this user's weeks now, and why not when it doesn't. */
export async function plannerRunner(userId: string): Promise<Runner> {
  if (!process.env.ANTHROPIC_API_KEY) return { server: false, reason: 'No Claude API key in Coach yet.', spent: 0 };
  const [u] = (await sql`SELECT settings->'planner'->>'runner' AS runner FROM users WHERE id = ${userId}`) as Row[];
  const spent = await monthSpend(userId, 'plan');
  if (u?.runner === 'github') return { server: false, reason: 'Switched to the GitHub job in Settings.', spent };
  if (spent >= PLANNER_MONTHLY_CAP_USD) return { server: false, reason: `This month's $${PLANNER_MONTHLY_CAP_USD} planner budget is used.`, spent };
  return { server: true, reason: 'Claude API', spent };
}

export type PlannerStatus = Runner & { switchedOn: boolean; hasKey: boolean; cap: number; lastRun: { at: string | null; status: string; costUsd: number } | null };

/** The Settings panel: who plans, why, this month's spend, and the last server run. */
export async function loadPlannerStatus(userId: string): Promise<PlannerStatus> {
  const runner = await plannerRunner(userId);
  const [u] = (await sql`SELECT settings->'planner'->>'runner' AS runner FROM users WHERE id = ${userId}`) as Row[];
  const [last] = (await sql`
    SELECT created_at, status, cost_usd FROM plan_runs WHERE user_id = ${userId} AND kind = 'plan'
    ORDER BY created_at DESC LIMIT 1`) as Row[];
  return {
    ...runner,
    switchedOn: u?.runner !== 'github',
    hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
    cap: PLANNER_MONTHLY_CAP_USD,
    lastRun: last ? { at: toIso(last.created_at), status: String(last.status), costUsd: Number(last.cost_usd) } : null,
  };
}

/** Settings: plan on the server (Claude API) or on the GitHub job. */
export async function setPlannerRunner(userId: string, runner: 'server' | 'github') {
  await sql`
    UPDATE users SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{planner}',
      COALESCE(settings->'planner', '{}'::jsonb) || ${JSON.stringify({ runner })}::jsonb), updated_at = NOW()
    WHERE id = ${userId}`;
}

/** True once the server has tried this proposal: a GitHub fallback for it must not come back here. */
export async function serverTried(proposalId: string): Promise<boolean> {
  const r = (await sql`SELECT 1 FROM plan_runs WHERE proposal_id = ${proposalId} AND kind = 'plan' LIMIT 1`) as Row[];
  return r.length > 0;
}

/** Checks a draft: the format first (a plan that fails it can't be saved), then Paolo's rules. */
export function checkDraft(plan: unknown, opts: { weekStart: string; request: PlanRequest; context: unknown }): CheckResult {
  const format = checkPlan(plan, opts.weekStart).errors;
  if (format.length) return { ok: false, problems: format, saveable: false };
  const { issues } = checkProposal(plan, { weekStart: opts.weekStart, request: opts.request, context: opts.context });
  const fails = issues.filter((i: { level: string }) => i.level === 'fail').map((i: { id: string; message: string }) => `${i.id}: ${i.message}`);
  return fails.length ? { ok: false, problems: fails, saveable: true } : { ok: true };
}

/**
 * Plans the request `proposalId` on the server. Never throws: a failure hands the request to the GitHub job, or
 * marks it failed when that can't start either.
 */
export async function runServerPlan(userId: string, proposalId: string): Promise<{ ok: boolean; stop: string }> {
  const started = Date.now();
  const runId = createId();
  const claimed = await claimRequest(userId, proposalId);
  if (!claimed) return { ok: false, stop: 'not_open' };
  const request = claimed.request;
  await sql`
    INSERT INTO plan_runs (id, user_id, proposal_id, kind, model, prompt_version, status)
    VALUES (${runId}, ${userId}, ${proposalId}, 'plan', ${MODEL}, ${PROMPT_VERSION}, 'running')`;
  try {
    const profile = await buildProfile(sql, { userId, weekOf: request.weekStart });
    const context: Record<string, unknown> = { ...profile.json };
    delete context.user;
    const result = await planWithClaude({
      client: new Anthropic({ timeout: 280_000, maxRetries: 1 }),
      system: systemPrompt(),
      user: userMessage({ request, profileMd: profile.md }),
      check: (plan) => checkDraft(plan, { weekStart: request.weekStart, request, context }),
      effort: 'medium',
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
    if (!ok) await handOff(userId, proposalId, `The server planner stopped (${result.stop}).`);
    return { ok, stop: result.stop };
  } catch (error) {
    const message = error instanceof Anthropic.APIError ? `Claude API ${error.status ?? ''}`.trim() : error instanceof Error ? error.message : 'unknown error';
    console.error('Server planner failed:', message);
    await sql`
      UPDATE plan_runs SET status = 'failed', error = ${message.slice(0, 500)}, duration_ms = ${Date.now() - started}
      WHERE id = ${runId}`;
    await handOff(userId, proposalId, `The server planner failed (${message}).`);
    return { ok: false, stop: 'error' };
  }
}

/** The GitHub job plans the request instead (it claims requests that are running). */
async function handOff(userId: string, proposalId: string, why: string) {
  const r = await dispatchWorkflow('plan.yml', { proposal_id: proposalId });
  if ('error' in r) await failRequest(userId, proposalId, `${why} ${r.error}`);
}
