// @ts-check
// One Coach tab turn with Claude (lift/COACH-CHAT.md): the system prompt (cached), the thread so far, and Paolo's new
// message with the plan and profile. Claude answers in text and, to change the plan, calls propose_changes once. The
// server checks the changes (changes.mjs); broken ones go back to Claude to fix, up to MAX_PROPOSALS tries. The
// client is passed in, so the tests drive it with a fake. No database here (server.ts stores the result).

import { addUsage, NO_USAGE } from '../planner/cost.mjs';
import { cleanReplies, MAX_CARDS, REPLIES_TOOL, SHOW_TOOL } from './cards.mjs';

export const MODEL = 'claude-opus-5-5';
/**
 * How hard Claude thinks before it answers. A chat reply waits on the thinking, so the chat runs lower than the planner:
 * on Opus 5.5, `low` starts answering in a few seconds where `medium` takes 15–20 (lift/COACH-CHAT.md, "Speed"). The
 * server still checks every change, so a slip comes back to be fixed rather than reaching the plan.
 */
export const EFFORT = 'low';
/** The request settings a warm-up must share with the real call, or it writes a cache the call never reads. */
export const THINKING = { type: 'adaptive', display: 'summarized' };
export const BETAS = ['server-side-fallback-2026-07-01'];
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
          '{ op: "add", date, sport, startTime?, title, duration, effort?, description?, liftTemplate?, workoutType? } | ' +
          '{ op: "remember", text } (a ' +
          'lasting preference for his Coaching preferences, one line). Dates YYYY-MM-DD, times HH:MM, ' +
          'duration in minutes, effort recovery | easy | moderate | hard | very-hard, sport run | ride | swim | strength | ' +
          'walk | hike | yoga | rest | other. A skip reason is a short word: tired, sick, sore, busy, travel, other. An ' +
          'added gym lift names its Lift template in liftTemplate (exact name from the profile) and its description is a ' +
          'short coach\'s note only: Lift plans the exercises, sets, loads and warm-up sets. A home or physio session ' +
          'has workoutType strength-home | mobility and its numbered "1) Name 3x8: cue" lines as the description.',
        items: { type: 'object' },
      },
    },
    required: ['title', 'why', 'changes'],
  },
};

/**
 * @typedef {{ role: 'user' | 'assistant', text: string, blocks?: any[] }} Turn  `blocks`: a message's photos and files
 * @typedef {{ ok: true, value: any } | { ok: false, problems: string[] }} ProposalCheck
 * @typedef {{ input: any, problems: string[] | null }} Attempt  one propose_changes call and what the check said
 * @typedef {{ reply: string, proposal: any | null, problems: string[] | null, turns: number, usage: typeof NO_USAGE,
 *   model: string, stop: string, attempts: Attempt[], cards: any[], replies: string[], timing: Timing }} ChatResult
 * @typedef {{ firstThinkingMs: number | null, firstTextMs: number | null, turnMs: number[] }} Timing  from the turn's start
 * @typedef {{ type: 'status', step: 'thinking' | 'writing' | 'proposing' | 'card' | 'fixing' }
 *   | { type: 'thinking', text: string } | { type: 'text', delta: string }} ChatEvent  what the phone shows while it waits
 */

/**
 * Turns the SDK's stream events into ChatEvents.
 * @param {any} event @param {(e: ChatEvent) => void} emit @param {{ text: boolean }} seen  text was sent before
 */
export function streamEventToChat(event, emit, seen) {
  if (event?.type === 'content_block_start') {
    const block = event.content_block ?? {};
    if (block.type === 'thinking') emit({ type: 'status', step: 'thinking' });
    else if (block.type === 'text') {
      emit({ type: 'status', step: 'writing' });
      if (seen.text) emit({ type: 'text', delta: '\n\n' });
    } else if (block.type === 'tool_use') {
      if (block.name === PROPOSE_TOOL.name) emit({ type: 'status', step: 'proposing' });
      else if (block.name === SHOW_TOOL.name) emit({ type: 'status', step: 'card' });
    }
  } else if (event?.type === 'content_block_delta') {
    const d = event.delta ?? {};
    if (d.type === 'text_delta' && d.text) {
      seen.text = true;
      emit({ type: 'text', delta: d.text });
    } else if (d.type === 'thinking_delta' && d.thinking) emit({ type: 'thinking', text: d.thinking });
  }
}

/** A message's content as blocks. @param {string | any[]} content */
const asBlocks = (content) => (typeof content === 'string' ? (content ? [{ type: 'text', text: content }] : []) : content);

/**
 * The messages for Claude: the thread (roles alternate, starting with Paolo), then his new message with the context.
 * A turn's `blocks` (the photos and files on it, server.ts) go before its text; a turn without them stays a string.
 * @param {Turn[]} history  the thread before this message, oldest first
 * @param {string} context  the plan, calendar and profile, as text
 * @param {string} text  Paolo's new message
 * @param {any[]} [files]  the blocks of the photos and files on the new message (files.mjs `fileBlock`)
 */
export function chatMessages(history, context, text, files = []) {
  /** @type {{ role: 'user' | 'assistant', content: any }[]} */
  const out = [];
  for (const t of history.slice(-HISTORY)) {
    const blocks = t.blocks ?? [];
    if (!t.text.trim() && !blocks.length) continue;
    const content = blocks.length ? [...blocks, ...asBlocks(t.text.trim())] : t.text;
    const prev = out[out.length - 1];
    if (prev && prev.role === t.role) {
      prev.content = typeof prev.content === 'string' && typeof content === 'string'
        ? `${prev.content}\n\n${content}`
        : [...asBlocks(prev.content), ...asBlocks(content)];
    } else out.push({ role: t.role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  // The cache mark on the new message lets a repair request (same turn) read the context back instead of paying for it.
  // Photos go before the words about them.
  /** @type {any[]} */
  const now = [
    { type: 'text', text: context },
    ...files,
    { type: 'text', text: `<paolo>\n${text}\n</paolo>`, cache_control: { type: 'ephemeral' } },
  ];
  if (out.length && out[out.length - 1].role === 'user') {
    // An unanswered message (the last turn failed): this one goes with it.
    const last = out.pop();
    now.unshift(...asBlocks(last?.content ?? ''));
  }
  out.push({ role: 'user', content: now });
  return out;
}

/**
 * @param {{
 *   client: { beta: { messages: { stream: (params: any, opts?: any) => { finalMessage: () => Promise<any> } } } },
 *   system: string, history: Turn[], context: string, text: string, files?: any[], check: (input: any, attempt: number) => ProposalCheck,
 *   checkCard?: (input: any) => ({ ok: true, value: any } | { ok: false, problems: string[] }),
 *   effort?: 'low' | 'medium' | 'high', deadline?: number, now?: () => number, model?: string,
 *   onEvent?: (e: ChatEvent) => void,
 * }} p
 * @returns {Promise<ChatResult>}
 */
export async function chatWithClaude({ client, system, history, context, text, files = [], check, checkCard = (input) => ({ ok: true, value: input }), effort = EFFORT, deadline = Infinity, now = Date.now, model = MODEL, onEvent }) {
  const start = now();
  /** @type {Timing} */
  const timing = { firstThinkingMs: null, firstTextMs: null, turnMs: [] };
  const seen = { text: false };
  // A listener that throws (the phone hung up) never stops the answer.
  /** @param {ChatEvent} e */
  const emit = (e) => {
    if (e.type === 'thinking' && timing.firstThinkingMs === null) timing.firstThinkingMs = now() - start;
    if (e.type === 'text' && timing.firstTextMs === null) timing.firstTextMs = now() - start;
    try { onEvent?.(e); } catch { /* the listener's problem */ }
  };
  const messages = chatMessages(history, context, text, files);
  let usage = NO_USAGE;
  /** @type {string[]} */
  const said = [];
  /** @type {any} */
  let proposal = null;
  /** @type {string[] | null} */
  let problems = null;
  let tries = 0;
  let turns = 0;
  /** @type {Attempt[]} */
  const attempts = [];
  /** @type {any[]} */
  const cards = [];
  /** @type {string[]} */
  let replies = [];

  while (turns < MAX_TURNS) {
    if (now() > deadline) return result('deadline');
    turns++;
    const turnStart = now();
    const stream = client.beta.messages.stream(chatRequest({ model, effort, system, messages }));
    if (typeof (/** @type {any} */ (stream).on) === 'function') {
      /** @type {any} */ (stream).on('streamEvent', (/** @type {any} */ event) => streamEventToChat(event, emit, seen));
    }
    const message = await stream.finalMessage();
    timing.turnMs.push(now() - turnStart);
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
    let retry = false;
    for (const call of calls) {
      if (call.name === SHOW_TOOL.name) {
        /** @type {{ ok: true, value: any } | { ok: false, problems: string[] }} */
        const c = cards.length >= MAX_CARDS ? { ok: false, problems: [`at most ${MAX_CARDS} cards per answer`] } : checkCard(call.input ?? {});
        if (c.ok) {
          cards.push(c.value);
          results.push({ type: 'tool_result', tool_use_id: call.id, content: 'Shown under your text.' });
        } else {
          results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: `Not shown: ${c.problems.join('; ')}` });
          retry = cards.length < MAX_CARDS;
        }
        continue;
      }
      if (call.name === REPLIES_TOOL.name) {
        replies = cleanReplies(call.input);
        results.push({ type: 'tool_result', tool_use_id: call.id, content: 'Shown under your question.' });
        continue;
      }
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
      attempts.push({ input: call.input ?? {}, problems: c.ok ? null : c.problems });
      if (c.ok) {
        proposal = c.value;
        problems = null;
        results.push({ type: 'tool_result', tool_use_id: call.id, content: 'Shown to Paolo with Apply and Dismiss. Stop here: no more text.' });
      } else {
        problems = c.problems;
        const last = tries >= MAX_PROPOSALS;
        emit({ type: 'status', step: 'fixing' });
        retry = retry || !last;
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
    // Cards and quick replies are shown as they come; another request only to fix a broken card or proposal (or to
    // let Claude say in words what it couldn't change, after its last try).
    if (!retry && !problems) return result(cards.length || replies.length ? 'shown' : 'answered');
  }
  return result('turns_used');

  /** @param {string} stop @returns {ChatResult} */
  function result(stop) {
    return { reply: said.join('\n\n'), proposal, problems, turns, usage, model, stop, attempts, cards, replies, timing };
  }
}

/**
 * One request's settings. The warm-up (`max_tokens: 0`) sends the same model, thinking, effort, system and tools, so
 * the cache it writes is the one the next message reads.
 * @param {{ model?: string, effort?: string, system: string, messages: any[], maxTokens?: number }} p
 */
export function chatRequest({ model = MODEL, effort = EFFORT, system, messages, maxTokens = 16000 }) {
  return {
    model,
    max_tokens: maxTokens,
    betas: BETAS,
    fallbacks: 'default',
    thinking: THINKING,
    output_config: { effort },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral', ttl: '1h' } }],
    tools: [PROPOSE_TOOL, SHOW_TOOL, REPLIES_TOOL],
    tool_choice: { type: 'auto' },
    messages,
  };
}
