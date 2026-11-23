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
/** How often a streaming draft is handed on (onDraft). */
export const DRAFT_EVERY_MS = 2000;
/** Requests sent again when the plan came back as broken JSON (eager input streaming does not check it). */
export const MAX_BAD_JSON = 2;

/** Whether `text` is one complete, valid JSON value. @param {string} text */
function strictJson(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * The SDK's error for a tool call whose input is not valid JSON. With `eager_input_streaming` the API streams the plan
 * as Claude writes it and does not check it, so a stray character or a cut-off plan throws from `finalMessage()`.
 * Only that error: the typed API errors (rate limit, auth, 5xx) are not bad JSON.
 * @param {unknown} e
 */
export function isBadToolJson(e) {
  return e instanceof Error && !('status' in e) && /Unable to parse tool parameter JSON/i.test(e.message);
}

/**
 * @typedef {{ ok: true } | { ok: false, problems: string[], saveable: boolean }} CheckResult
 *   saveable: the plan imports (only rules failed), so it can still go to Paolo when the repairs run out
 * @typedef {{ plan: any, summary: string | null, turns: number, submits: number, firstDraftProblems: string[] | null,
 *   usage: typeof NO_USAGE, model: string, stop: string }} PlanResult
 */

/**
 * @param {{
 *   client: { beta: { messages: { stream: (params: any, opts?: any) => { finalMessage: () => Promise<any>, on?: Function } } } },
 *   system: string, user: string, check: (plan: any) => CheckResult,
 *   effort?: 'low' | 'medium' | 'high', deadline?: number, now?: () => number, model?: string,
 *   onDraft?: (partial: any) => void, stopAt?: number,
 * }} p  deadline: epoch ms by which the last request must start; stopAt: epoch ms by which every request must have ended
 *   (the server function stops soon after); onDraft: the sessions written so far, while Claude writes
 * @returns {Promise<PlanResult>}
 */
export async function planWithClaude({ client, system, user, check, effort = 'high', deadline = Infinity, stopAt = Infinity, now = Date.now, model = MODEL, onDraft }) {
  /** @type {any[]} */
  const messages = [{ role: 'user', content: user }];
  let usage = NO_USAGE;
  let submits = 0;
  /** @type {string[] | null} */
  let firstDraftProblems = null;
  /** @type {{ plan: any, summary: string | null, problems?: number } | null} */
  let best = null;
  let nudged = false;
  let badJson = 0;

  for (let turn = 1; turn <= MAX_TURNS + MAX_BAD_JSON; turn++) {
    if (now() > deadline) return result('deadline');
    const stream = client.beta.messages
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
      }, Number.isFinite(stopAt) ? { timeout: Math.max(20_000, stopAt - now()) } : undefined);
    // The raw JSON of each tool call as it streams: the SDK reads it with a tolerant parser, so an unescaped quote can
    // cut a title short with no error. It is parsed strictly once the call is complete (below).
    /** @type {Map<number, string>} */
    const raw = new Map();
    if (typeof stream.on === 'function') {
      stream.on('streamEvent', (/** @type {any} */ ev) => {
        if (ev?.type === 'content_block_delta' && ev.delta?.type === 'input_json_delta') {
          raw.set(ev.index, (raw.get(ev.index) ?? '') + String(ev.delta.partial_json ?? ''));
        }
      });
    }
    if (onDraft && typeof stream.on === 'function') {
      // The plan streams in as Claude writes the tool call: hand on the sessions written so far (the last one may be
      // half written) every DRAFT_EVERY_MS, so the calendar fills while Claude works.
      let last = 0;
      let sent = 0;
      stream.on('inputJson', (/** @type {string} */ _delta, /** @type {any} */ snapshot) => {
        const events = snapshot?.plan?.events;
        if (!Array.isArray(events) || events.length - 1 <= sent || now() - last < DRAFT_EVERY_MS) return;
        last = now();
        sent = events.length - 1;
        onDraft({ ...snapshot.plan, events: events.slice(0, -1) });
      });
    }
    /** @type {any} */
    let message;
    try {
      message = await stream.finalMessage();
    } catch (e) {
      // The plan came back as broken JSON: there is no tool call to answer, so ask again (the same messages).
      if (!isBadToolJson(e)) throw e;
      badJson++;
      if (badJson > MAX_BAD_JSON) return result('bad_json');
      continue;
    }
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
      const json = raw.get((message.content ?? []).indexOf(call));
      if (json != null && !strictJson(json)) {
        badJson++;
        submits++;
        results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: 'The plan was not valid JSON (an unescaped quote, a trailing comma or a stray character). Call submit_plan again with valid JSON.' });
        continue;
      }
      const input = call.input ?? {};
      if (call.name !== 'submit_plan' || !input.plan || typeof input.plan !== 'object') {
        results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: 'submit_plan needs { plan: {...} }.' });
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
