// @ts-check
// One Coach tab turn with Claude (lift/COACH-CHAT.md): the system prompt (cached), the thread so far, and Paolo's new
// message with the plan and profile. Claude answers in text and, to change the plan, calls propose_changes once. The
// server checks the changes (changes.mjs); broken ones go back to Claude to fix, up to MAX_PROPOSALS tries. The
// client is passed in, so the tests drive it with a fake. No database here (server.ts stores the result).

import { addUsage, NO_USAGE } from '../planner/cost.mjs';
import { ASK_TOOL, cleanQuestions, cleanReplies, MAX_CARDS, REPLIES_TOOL, SHOW_TOOL } from './cards.mjs';
import { CHAT_TOOLS, PROPOSE_TOOL } from './chat-tools.mjs';
import { sourcesLine, sourcesOf, webUses } from './web-tools.mjs';

export { PROPOSE_TOOL };

/**
 * The chat runs on Sonnet 5.5 (Paolo, 2026-10-27): it starts answering in about half the time of Opus 5.5 at half the
 * price per token. The planner stays on Opus (src/lib/planner/loop.mjs). lift/COACH-CHAT.md, "Speed".
 */
export const MODEL = 'claude-sonnet-5-5';
/**
 * How hard Claude thinks before it answers. A chat reply waits on the thinking, so the chat runs lower than the planner:
 * `low` starts answering in a few seconds where `medium` takes much longer (lift/COACH-CHAT.md, "Speed"). The server
 * still checks every change, so a slip comes back to be fixed rather than reaching the plan.
 */
export const EFFORT = 'low';
/** The request settings a warm-up must share with the real call, or it writes a cache the call never reads. */
export const THINKING = { type: 'adaptive', display: 'summarized' };
export const BETAS = ['server-side-fallback-2026-07-01'];
/** propose_changes calls in one turn: the first and two repairs. */
export const MAX_PROPOSALS = 3;
/**
 * Requests to Claude in one turn: room for two rounds of reads (data-tools.mjs) before the answer and a repair, and
 * for a web search that pauses (pause_turn) and goes on.
 */
export const MAX_TURNS = 8;
/** Read tool calls in one turn (the `read` tools of chat-tools.mjs). Searches and fetches have their own caps (web-tools.mjs). */
export const MAX_READS = 6;
/** The thread messages sent back to Claude: the recent ones are enough for a chat about this week. */
export const HISTORY = 20;
/** What a shown card answers: the words come next, as text. */
const WRITE_AFTER_CARD = 'Shown under your reply. Once your cards are called, write your reply to Paolo in text, with no more ' +
  'tool calls: answer his message itself first (a question gets its answer); the cards and one-tap answers are extras ' +
  'under it, so never point at them ("pick one below").';
/** Questions are shown as cards: the words still answer his message first. */
const WRITE_AFTER_QUESTIONS = 'Shown as cards; his answers come as his next message. Now write your reply in text, with no more ' +
  'tool calls: answer what he asked first, then say in one line why you need these details. Never point at the cards.';
/** Once, when a reply only points at its chips ("Pick one of the options below") instead of answering. */
export const ANSWER_NUDGE = 'Your reply only points at the options. Answer my message itself in words: what I asked, ' +
  'directly, with my numbers where they help. The options stay under it; don\'t mention them and call no tools.';

/**
 * A reply that is only a pointer at its chips or question cards ("Pick one of the options below, or tell me something
 * else"): it answers nothing, and the chips go away when the chat moves on (Paolo, 2026-11-04).
 * @param {string} words
 */
export function pointsAtChips(words) {
  const t = words.trim();
  if (!t) return false;
  const pointer = /\b(pick|choose|select|tap)\b[^.?!]{0,40}\b(below|option|options|replies|reply|one)\b|\b(options|replies|choices) below\b|tell me something else/i;
  return t.length < 220 && pointer.test(t);
}


/**
 * @typedef {{ role: 'user' | 'assistant', text: string, blocks?: any[] }} Turn  `blocks`: a message's photos and files
 * @typedef {{ ok: true, value: any } | { ok: false, problems: string[] }} ProposalCheck
 * @typedef {{ input: any, problems: string[] | null }} Attempt  one propose_changes call and what the check said
 * @typedef {{ reply: string, proposal: any | null, problems: string[] | null, turns: number, usage: typeof NO_USAGE,
 *   model: string, stop: string, attempts: Attempt[], cards: any[], replies: string[], questions: any[], thought: string,
 *   timing: Timing, reads: { name: string, input: any, ok: boolean, chars: number }[],
 *   web: { searches: number, fetches: number, sources: { title: string, url: string }[] } }} ChatResult  `thought`: the summary of Claude's thinking, shown folded above the reply
 * @typedef {{ firstThinkingMs: number | null, firstTextMs: number | null, turnMs: number[] }} Timing  from the turn's start
 * @typedef {{ type: 'status', step: import('./tool-registry.mjs').Step }
 *   | { type: 'thinking', text: string } | { type: 'text', delta: string }} ChatEvent  what the phone shows while it waits
 */

/**
 * Turns the SDK's stream events into ChatEvents. Text blocks right after each other are one paragraph (a cited
 * answer comes split at its citations); text after anything else starts a new one.
 * @param {any} event @param {(e: ChatEvent) => void} emit
 * @param {{ text: boolean, lastText?: boolean }} seen  text was sent before; the last block was text
 */
export function streamEventToChat(event, emit, seen) {
  if (event?.type === 'message_start') seen.lastText = false;
  if (event?.type === 'content_block_start') {
    const block = event.content_block ?? {};
    const wasText = seen.lastText;
    seen.lastText = block.type === 'text';
    if (block.type === 'thinking') emit({ type: 'status', step: 'thinking' });
    else if (block.type === 'text') {
      if (!wasText) {
        emit({ type: 'status', step: 'writing' });
        if (seen.text) emit({ type: 'text', delta: '\n\n' });
      }
    } else if (block.type === 'tool_use' || block.type === 'server_tool_use') {
      const step = CHAT_TOOLS.stepOf(block.name);
      if (step) emit({ type: 'status', step });
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
 *   readData?: (name: string, input: any) => Promise<{ ok: boolean, text: string }>,
 * }} p  `readData` answers the read tools (data.ts); without it they answer that the data is not available
 * @returns {Promise<ChatResult>}
 */
export async function chatWithClaude({ client, system, history, context, text, files = [], check, checkCard = (input) => ({ ok: true, value: input }), effort = EFFORT, deadline = Infinity, now = Date.now, model = MODEL, onEvent, readData }) {
  const start = now();
  /** @type {Timing} */
  const timing = { firstThinkingMs: null, firstTextMs: null, turnMs: [] };
  const seen = { text: false, lastText: false };
  // A listener that throws (the phone hung up) never stops the answer.
  /** @param {ChatEvent} e */
  const emit = (e) => {
    if (e.type === 'thinking' && timing.firstThinkingMs === null) timing.firstThinkingMs = now() - start;
    if (e.type === 'text' && timing.firstTextMs === null) timing.firstTextMs = now() - start;
    if (e.type === 'thinking') streamedThought += e.text;
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
  /** @type {any[]} */
  let questions = [];
  /** @type {string[]} */
  const thoughts = [];
  let streamedThought = '';
  /** @type {{ name: string, input: any, ok: boolean, chars: number }[]} */
  const reads = [];
  /** @type {string[]} */
  const notes = [];
  let wordsAsked = false;
  let nudged = false;
  const shown = () => Boolean(proposal || cards.length || replies.length || questions.length);
  const web = { searches: 0, fetches: 0 };
  /** @type {any[]} */
  const answered = [];

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
    const uses = webUses(message.usage);
    web.searches += uses.searches;
    web.fetches += uses.fetches;
    if (message.stop_reason === 'refusal') return result('refusal');
    const content = message.content ?? [];
    answered.push(...content);
    // Text blocks in a row are one paragraph: a cited answer comes split at each citation. Only text after the
    // response's last tool call is the reply; a note before a tool call ("one more search") is working text, kept
    // with the thought. (Sonnet 5.5 sends a longer note before a tool call as a thinking block anyway.)
    let lastTool = -1;
    content.forEach((/** @type {any} */ b, /** @type {number} */ i) => { if (b.type === 'tool_use' || b.type === 'server_tool_use') lastTool = i; });
    let run = '';
    const flush = (/** @type {boolean} */ final) => {
      if (run.trim()) (final ? said : notes).push(run.trim());
      run = '';
    };
    content.forEach((/** @type {any} */ b, /** @type {number} */ i) => {
      if (b.type === 'text') { run += b.text; return; }
      flush(i > lastTool);
      if (b.type === 'thinking' && typeof b.thinking === 'string' && b.thinking.trim()) thoughts.push(b.thinking.trim());
    });
    flush(true);
    if (message.stop_reason === 'max_tokens') return result('max_tokens');
    // A long web search pauses; the same request with Claude's message so far goes on from there.
    if (message.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content });
      continue;
    }
    const calls = content.filter((/** @type {any} */ b) => b.type === 'tool_use');
    // A reply that only points at its chips answers nothing: ask once for the answer itself.
    if (!calls.length && !nudged && said.length && pointsAtChips(said.join(' ')) && now() < deadline) {
      nudged = true;
      said.length = 0;
      messages.push({ role: 'assistant', content }, { role: 'user', content: ANSWER_NUDGE });
      emit({ type: 'status', step: 'writing' });
      continue;
    }
    if (!calls.length) return result(proposal ? 'proposed' : shown() ? 'shown' : 'answered');
    messages.push({ role: 'assistant', content });

    /** @type {any[]} */
    const results = [];
    let retry = false;
    // The reads run together; Claude needs their answers for another request.
    const readCalls = calls.filter((/** @type {any} */ c) => CHAT_TOOLS.isRead(c.name));
    /** @type {Map<string, { ok: boolean, text: string }>} */
    const readAnswers = new Map(await Promise.all(readCalls.map(async (/** @type {any} */ c) => {
      /** @type {{ ok: boolean, text: string }} */
      let a;
      if (reads.length >= MAX_READS) a = { ok: false, text: `At most ${MAX_READS} reads per answer: answer with what you have.` };
      else if (!readData) a = { ok: false, text: 'This data is not available here.' };
      else {
        try { a = await readData(c.name, c.input ?? {}); } catch (e) { a = { ok: false, text: `The read failed: ${String(e).slice(0, 120)}` }; }
      }
      reads.push({ name: c.name, input: c.input ?? {}, ok: a.ok, chars: a.text.length });
      return /** @type {[string, { ok: boolean, text: string }]} */ ([c.id, a]);
    })));
    for (const call of calls) {
      const read = readAnswers.get(call.id);
      if (read) {
        results.push({ type: 'tool_result', tool_use_id: call.id, ...(read.ok ? {} : { is_error: true }), content: read.text });
        retry = true;
        continue;
      }
      if (call.name === SHOW_TOOL.name) {
        /** @type {{ ok: true, value: any } | { ok: false, problems: string[] }} */
        const c = cards.length >= MAX_CARDS ? { ok: false, problems: [`at most ${MAX_CARDS} cards per answer`] } : checkCard(call.input ?? {});
        if (c.ok) {
          cards.push(c.value);
          results.push({ type: 'tool_result', tool_use_id: call.id, content: WRITE_AFTER_CARD });
        } else {
          results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: `Not shown: ${c.problems.join('; ')}` });
          retry = cards.length < MAX_CARDS;
        }
        continue;
      }
      if (call.name === ASK_TOOL.name) {
        questions = cleanQuestions(call.input);
        results.push({
          type: 'tool_result', tool_use_id: call.id,
          ...(questions.length ? { content: WRITE_AFTER_QUESTIONS } : { is_error: true, content: 'No valid question: ask in your text instead.' }),
        });
        continue;
      }
      if (call.name === REPLIES_TOOL.name) {
        replies = cleanReplies(call.input);
        results.push({ type: 'tool_result', tool_use_id: call.id, content: WRITE_AFTER_CARD });
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
        results.push({ type: 'tool_result', tool_use_id: call.id, content: 'Shown to Paolo with Apply and Not now. Now write your reply to him in text, with no more tool calls: it goes above the card.' });
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
    // Cards are shown; the words come in one more short request, after them, so they arrive as text (Sonnet 5.5
    // turns text written before a tool call into a thinking block, and Paolo saw only the card, 2026-11-03).
    if (shown() && !retry && !problems && !said.length && !wordsAsked && now() < deadline) {
      wordsAsked = true;
      continue;
    }
    if (proposal) return result('proposed');
    // Cards and quick replies are shown as they come; another request only to fix a broken card or proposal (or to
    // let Claude say in words what it couldn't change, after its last try).
    if (!retry && !problems) return result(cards.length || replies.length || questions.length ? 'shown' : 'answered');
  }
  return result('turns_used');

  /** @param {string} stop @returns {ChatResult} */
  function result(stop) {
    const thought = (thoughts.length ? thoughts.join('\n\n') : streamedThought.trim()).slice(0, 4000);
    // A reply that used the web ends with the pages it leaned on.
    // No words after the tools (a deadline, a refusal): the last working note is better than nothing.
    const words = said.length ? said.join('\n\n') : (notes.at(-1) ?? '');
    const sources = (web.searches || web.fetches) && words ? sourcesOf(answered) : [];
    const reply = [words, sourcesLine(sources)].filter(Boolean).join('\n\n');
    return { reply, proposal, problems, turns, usage, model, stop, attempts, cards, replies, questions, thought, timing, reads, web: { ...web, sources } };
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
    tools: CHAT_TOOLS.definitions(),
    tool_choice: { type: 'auto' },
    messages,
  };
}
