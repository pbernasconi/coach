// @ts-check
// What a planner call costs, and the monthly cap that keeps it cheap (Paolo, 2026-10-25: $100 a month of API
// credit). Prices per million tokens (claude-api skill, 2026-10). Pure.

/** @type {Record<string, { input: number, output: number, cacheRead: number, cacheWrite: number }>} */
export const PRICES = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

/** The planner stops using the API for the rest of the month at this spend (Settings shows it). */
export const PLANNER_MONTHLY_CAP_USD = 25;

/**
 * @param {{ input_tokens?: number | null, output_tokens?: number | null, cache_read_input_tokens?: number | null,
 *   cache_creation_input_tokens?: number | null }} usage
 * @param {string} model
 */
export function costOf(usage, model) {
  const p = PRICES[model] ?? PRICES['claude-opus-5-5'];
  const m = (/** @type {number | null | undefined} */ n, /** @type {number} */ price) => ((n ?? 0) / 1e6) * price;
  return m(usage.input_tokens, p.input) + m(usage.output_tokens, p.output) +
    m(usage.cache_read_input_tokens, p.cacheRead) + m(usage.cache_creation_input_tokens, p.cacheWrite);
}

/**
 * Adds one response's usage to a running total.
 * @param {{ input: number, output: number, cacheRead: number, cacheWrite: number, usd: number }} total
 * @param {any} usage @param {string} model
 */
export function addUsage(total, usage, model) {
  return {
    input: total.input + (usage?.input_tokens ?? 0),
    output: total.output + (usage?.output_tokens ?? 0),
    cacheRead: total.cacheRead + (usage?.cache_read_input_tokens ?? 0),
    cacheWrite: total.cacheWrite + (usage?.cache_creation_input_tokens ?? 0),
    usd: total.usd + costOf(usage ?? {}, model),
  };
}

export const NO_USAGE = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, usd: 0 };
