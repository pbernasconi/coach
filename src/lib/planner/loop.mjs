// The server planner's conversation with Claude: one request with the frozen system prompt (cached) and the week,
// then submit_plan calls until a plan passes Coach's checks or the caps run out. The client is passed in, so the
// tests drive it with a fake. No database here (run.ts saves the result).

import { addUsage, NO_USAGE } from './cost.mjs';
import { SUBMIT_TOOL } from './prompt.mjs';

export const MODEL = 'claude-opus-5-5';
/** At most this many submit_plan calls: the first draft and two repairs. */
export const MAX_SUBMITS = 3;
/** Requests to Claude in one run (submits plus a nudge when it answers without submitting). */
export const MAX_TURNS = 5;

/**
 * @typedef {{ ok: true } | { ok: false, problems: string[], saveable: boolean }} CheckResult
 *   saveable: the plan imports (only rules failed), so it can still go to Paolo when the repairs run out
 * @typedef {{ plan: any, summary: string | null, turns: number, submits: number, firstDraftProblems: string[] | null,
 *   usage: typeof NO_USAGE, model: string, stop: string }} PlanResult
 */

/**
 * @param {{
 *   client: { beta: { messages: { stream: (params: any, opts?: any) => { finalMessage: () => Promise<any> } } } },
 *   system: string, user: string, check: (plan: any) => CheckResult,
 *   effort?: 'low' | 'medium' | 'high', deadline?: number, now?: () => number, model?: string,
 * }} p  deadline: epoch ms by which the last request must start
 * @returns {Promise<PlanResult>}
 */
export async function planWithClaude({ client, system, user, check, effort = 'high', deadline = Infinity, now = Date.now, model = MODEL }) {
  /** @type {any[]} */
  const messages = [{ role: 'user', content: user }];
  let usage = NO_USAGE;
  let submits = 0;
  /** @type {string[] | null} */
  let firstDraftProblems = null;
  /** @type {{ plan: any, summary: string | null, problems?: number } | null} */
  let best = null;
  let nudged = false;

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    if (now() > deadline) return result('deadline');
    const message = await client.beta.messages
      .stream({
        model,
        max_tokens: 64000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort },
        // The system prompt is the same bytes every call: cache it (and the tool before it).
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral', ttl: '1h' } }],
        tools: [SUBMIT_TOOL],
        tool_choice: { type: 'auto' },
        messages,
      })
      .finalMessage();
    usage = addUsage(usage, message.usage, message.model ?? model);

    if (message.stop_reason === 'refusal') return result('refusal');
    if (message.stop_reason === 'max_tokens') return result('max_tokens');
    const calls = (message.content ?? []).filter((/** @type {any} */ b) => b.type === 'tool_use');
    messages.push({ role: 'assistant', content: message.content });

    if (!calls.length) {
      // It answered in text. Ask once for the tool call, then give up.
      if (nudged) return result('no_submit');
      nudged = true;
      messages.push({ role: 'user', content: 'Call submit_plan with the plan; don\'t write it as text.' });
      continue;
    }

    /** @type {any[]} */
    const results = [];
    let saved = false;
    for (const call of calls) {
      const input = call.input ?? {};
      if (call.name !== 'submit_plan' || !input.plan || typeof input.plan !== 'object') {
        results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: 'submit_plan needs { plan: {...}, summary: "..." }.' });
        continue;
      }
      submits++;
      const summary = typeof input.summary === 'string' ? input.summary.slice(0, 6000) : null;
      const c = check(input.plan);
      if (firstDraftProblems === null) firstDraftProblems = c.ok ? [] : c.problems;
      if (c.ok) {
        best = { plan: input.plan, summary };
        saved = true;
        results.push({ type: 'tool_result', tool_use_id: call.id, content: 'Saved. Paolo will review it. Stop here.' });
      } else {
        // A plan that only breaks a rule still goes to Paolo (with the rule shown) if the repairs run out.
        if (c.saveable && (!best || c.problems.length < (best.problems ?? Infinity))) best = { plan: input.plan, summary, problems: c.problems.length };
        const last = submits >= MAX_SUBMITS;
        results.push({
          type: 'tool_result', tool_use_id: call.id, is_error: true,
          content: `${last ? 'Last try used. ' : ''}Fix these and call submit_plan again:\n- ${c.problems.join('\n- ')}`,
        });
      }
    }
    if (saved) return result('saved');
    if (submits >= MAX_SUBMITS) return result('repairs_used');
    messages.push({ role: 'user', content: results });
  }
  return result('turns_used');

  /** @param {string} stop @returns {PlanResult} */
  function result(stop) {
    return { plan: best?.plan ?? null, summary: best?.summary ?? null, turns: messages.filter((m) => m.role === 'assistant').length, submits, firstDraftProblems, usage, model, stop };
  }
}
