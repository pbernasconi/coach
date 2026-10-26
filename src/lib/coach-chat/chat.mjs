// @ts-check
// One Coach tab turn with Claude (lift/COACH-CHAT.md): the system prompt (cached), the thread so far, and Paolo's new
// message with the plan and profile. Claude answers in text and, to change the plan, calls propose_changes once. The
// server checks the changes (changes.mjs); broken ones go back to Claude to fix, up to MAX_PROPOSALS tries. The
// client is passed in, so the tests drive it with a fake. No database here (server.ts stores the result).

import { addUsage, NO_USAGE } from '../planner/cost.mjs';

export const MODEL = 'claude-opus-5-5';
/** propose_changes calls in one turn: the first and two repairs. */
export const MAX_PROPOSALS = 3;
/** Requests to Claude in one turn. */
export const MAX_TURNS = 4;
/** The thread messages sent back to Claude: the recent ones are enough for a chat about this week. */
export const HISTORY = 20;

export const PROPOSE_TOOL = {
  name: 'propose_changes',
  description:
    'Show Paolo a card with plan changes and an Apply button. Nothing changes until he taps Apply. Call it at most ' +
    'once per answer, after your text. Workouts are named by the id from <plan>. The server checks the changes and ' +
    'answers ok or the problems to fix; the card also shows any of his rules the changes break.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The card title, under 50 characters: "Move the heavy lift to Tuesday".' },
      why: { type: 'string', description: 'One line, starting with what it is based on: "Based on your calendar for Tuesday: …".' },
      changes: {
        type: 'array',
        description:
          'Each change is one of: { op: "move", id, date, startTime? } | { op: "skip", id, reason } | { op: "unskip", id } | ' +
          '{ op: "remove", id } | { op: "update", id, title?, duration?, effort?, description?, startTime? } | ' +
          '{ op: "add", date, sport, startTime?, title, duration, effort?, description? }. Dates YYYY-MM-DD, times HH:MM, ' +
          'duration in minutes, effort recovery | easy | moderate | hard | very-hard, sport run | ride | swim | strength | ' +
          'walk | hike | yoga | rest | other. A skip reason is a short word: tired, sick, sore, busy, travel, other.',
        items: { type: 'object' },
      },
    },
    required: ['title', 'why', 'changes'],
  },
};

/**
 * @typedef {{ role: 'user' | 'assistant', text: string }} Turn
 * @typedef {{ ok: true, value: any } | { ok: false, problems: string[] }} ProposalCheck
 * @typedef {{ reply: string, proposal: any | null, problems: string[] | null, turns: number, usage: typeof NO_USAGE,
 *   model: string, stop: string }} ChatResult
 */

/**
 * The messages for Claude: the thread (roles alternate, starting with Paolo), then his new message with the context.
 * @param {Turn[]} history  the thread before this message, oldest first
 * @param {string} context  the plan, calendar and profile, as text
 * @param {string} text  Paolo's new message
 */
export function chatMessages(history, context, text) {
  /** @type {{ role: 'user' | 'assistant', content: any }[]} */
  const out = [];
  for (const t of history.slice(-HISTORY)) {
    if (!t.text.trim()) continue;
    const prev = out[out.length - 1];
    if (prev && prev.role === t.role) prev.content = `${prev.content}\n\n${t.text}`;
    else out.push({ role: t.role, content: t.text });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  const now = [
    { type: 'text', text: context },
    { type: 'text', text: `<paolo>\n${text}\n</paolo>` },
  ];
  if (out.length && out[out.length - 1].role === 'user') {
    // An unanswered message (the last turn failed): this one goes with it.
    const last = out.pop();
    now.unshift({ type: 'text', text: String(last?.content ?? '') });
  }
  out.push({ role: 'user', content: now });
  return out;
}

/**
 * @param {{
 *   client: { beta: { messages: { stream: (params: any, opts?: any) => { finalMessage: () => Promise<any> } } } },
 *   system: string, history: Turn[], context: string, text: string, check: (input: any, attempt: number) => ProposalCheck,
 *   effort?: 'low' | 'medium' | 'high', deadline?: number, now?: () => number, model?: string,
 * }} p
 * @returns {Promise<ChatResult>}
 */
export async function chatWithClaude({ client, system, history, context, text, check, effort = 'medium', deadline = Infinity, now = Date.now, model = MODEL }) {
  const messages = chatMessages(history, context, text);
  let usage = NO_USAGE;
  /** @type {string[]} */
  const said = [];
  /** @type {any} */
  let proposal = null;
  /** @type {string[] | null} */
  let problems = null;
  let tries = 0;
  let turns = 0;

  while (turns < MAX_TURNS) {
    if (now() > deadline) return result('deadline');
    turns++;
    const message = await client.beta.messages
      .stream({
        model,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort },
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral', ttl: '1h' } }],
        tools: [PROPOSE_TOOL],
        tool_choice: { type: 'auto' },
        messages,
      })
      .finalMessage();
    usage = addUsage(usage, message.usage, message.model ?? model);
    if (message.stop_reason === 'refusal') return result('refusal');
    const content = message.content ?? [];
    for (const b of content) if (b.type === 'text' && b.text.trim()) said.push(b.text.trim());
    const calls = content.filter((/** @type {any} */ b) => b.type === 'tool_use');
    if (message.stop_reason === 'max_tokens') return result('max_tokens');
    if (!calls.length) return result('answered');
    messages.push({ role: 'assistant', content });

    /** @type {any[]} */
    const results = [];
    for (const call of calls) {
      if (call.name !== PROPOSE_TOOL.name) {
        results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: 'Unknown tool.' });
        continue;
      }
      if (proposal) {
        results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: 'One card per answer: it is already shown.' });
        continue;
      }
      tries++;
      const c = check(call.input ?? {}, tries);
      if (c.ok) {
        proposal = c.value;
        problems = null;
        results.push({ type: 'tool_result', tool_use_id: call.id, content: 'Shown to Paolo with Apply and Dismiss. Stop here: no more text.' });
      } else {
        problems = c.problems;
        const last = tries >= MAX_PROPOSALS;
        results.push({
          type: 'tool_result', tool_use_id: call.id, is_error: true,
          content: last
            ? `Not shown. These are still wrong:\n- ${c.problems.join('\n- ')}\nTell Paolo in one line what you couldn't change and why. Don't call the tool again.`
            : `Not shown. Fix these and call propose_changes again (no text before it):\n- ${c.problems.join('\n- ')}`,
        });
      }
    }
    messages.push({ role: 'user', content: results });
    if (proposal) return result('proposed');
  }
  return result('turns_used');

  /** @param {string} stop @returns {ChatResult} */
  function result(stop) {
    return { reply: said.join('\n\n'), proposal, problems, turns, usage, model, stop };
  }
}
