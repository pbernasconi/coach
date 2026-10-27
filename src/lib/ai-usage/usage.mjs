// @ts-check
// One row of the ai_usage ledger (src/db/usage-schema.ts): what one Claude API call cost, in tokens and dollars.
// Pure; store.ts writes it.

import { addUsage, NO_USAGE } from '../planner/cost.mjs';

/** What Coach calls Claude for. The chat cap counts chat and its warm-ups; the planner cap counts planner runs. */
export const FEATURES = /** @type {const} */ (['chat', 'chat_warmup', 'planner', 'planner_eval']);
export const CHAT_FEATURES = ['chat', 'chat_warmup'];
export const PLANNER_FEATURES = ['planner'];

/**
 * @typedef {{ feature: typeof FEATURES[number], model: string, effort: string | null, inputTokens: number,
 *   outputTokens: number, cacheReadTokens: number, cacheWriteTokens: number, costUsd: number,
 *   durationMs: number | null, ok: boolean, refId: string | null }} UsageRow
 */

/**
 * @param {{ feature: string, model: string, effort?: string | null, usage?: Partial<typeof NO_USAGE> | null,
 *   durationMs?: number | null, ok?: boolean, refId?: string | null }} p
 * @returns {UsageRow}
 */
export function usageRow({ feature, model, effort = null, usage = null, durationMs = null, ok = true, refId = null }) {
  if (!FEATURES.includes(/** @type {any} */ (feature))) throw new Error(`unknown AI usage feature: ${feature}`);
  const u = { ...NO_USAGE, ...(usage ?? {}) };
  const whole = (/** @type {unknown} */ n) => Math.max(0, Math.round(Number(n) || 0));
  return {
    feature: /** @type {UsageRow['feature']} */ (feature),
    model,
    effort,
    inputTokens: whole(u.input),
    outputTokens: whole(u.output),
    cacheReadTokens: whole(u.cacheRead),
    cacheWriteTokens: whole(u.cacheWrite),
    costUsd: Math.max(0, Number(u.usd) || 0),
    durationMs: durationMs == null ? null : whole(durationMs),
    ok,
    refId,
  };
}

/**
 * The totals of one raw API response's `usage` (as the SDK returns it), priced for its model.
 * @param {any} raw @param {string} model
 */
export function usageOf(raw, model) {
  return addUsage(NO_USAGE, raw ?? {}, model);
}
