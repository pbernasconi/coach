/**
 * The Coach tab on the server (lift/COACH-CHAT.md, lift/APP-API.md "Coach"): the thread, a message to Coach and its
 * answer, and Apply, Dismiss and Undo of a proposed change set. Claude never writes: Apply runs the plan's own writes
 * (the ones the Week tab and the Edit sheet use), then the calendar push.
 */

import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { createId } from '@paralleldrive/cuid2';
import { sql } from '@/db';
import { toIso } from '@/lib/db-time.mjs';
import { pushPlanWeeks } from '@/lib/plan/app-writes';
import { dispatchWorkflow } from '@/lib/plan/proposals';
import { buildProfile } from '@/lib/planner/profile.mjs';
import { monthSpend as spendOn, recordAiUsage } from '@/lib/ai-usage/store';
import { CHAT_FEATURES, usageOf } from '@/lib/ai-usage/usage.mjs';
import { checkCard, type CardRef, type Question } from './cards.mjs';
import { resolveCards, type Attachment } from './cards';
import { checkProposalInput, isStale, planText, type Change, type Item } from './changes.mjs';
import { chatMessages, chatRequest, chatWithClaude, EFFORT, MODEL, type ChatEvent, type Turn } from './chat.mjs';
import { recentChangesText } from '@/lib/plan/change-log';
import { ApplyError, applyAll, planRows, undoAll, type Undo } from './writes';
import { fileBlock, fileNote, filesPhrase, filesToSend, type FileData, type FileRef } from './files.mjs';
import { claimFiles, fileData, unclaimedFiles } from './files-store';
import { CHAT_MONTHLY_CAP_USD, PROMPTS, SUGGESTIONS, chatContext, chatSystemPrompt } from './prompt.mjs';

type Row = Record<string, unknown>;

/** A thread idle this long is closed; the next message starts a new one. */
const IDLE_HOURS = 24;
/** The last Claude request starts before this (the route stops at maxDuration 120 s). */
const BUDGET_MS = 75_000;
export const MAX_TEXT = 2000;
/** A message still without a reply this long after it was sent is being answered (the route stops at 120 s). */
const ANSWERING_MS = 150_000;

export type ProposalView = {
  id: string; title: string; why: string | null; items: Item[]; warnings: string[];
  status: 'open' | 'applied' | 'undone' | 'dismissed' | 'stale';
};
export type MessageView = {
  id: string; role: 'user' | 'assistant'; text: string; createdAt: string | null; proposal: ProposalView | null;
  attachments: Attachment[]; quickReplies: string[];
  /** The photos and files on Paolo's message (files.mjs); the phone reads each from GET /api/app/coach/files/{id}. */
  files: FileRef[];
  /** Coach's: the summary of its thinking (shown folded as "Thought"), its question cards, and Paolo's thumbs. */
  thought: string | null;
  questions: Question[];
  feedback: 'up' | 'down' | null;
};

/** This month's chat spend (answers and cache warm-ups), in USD. */
async function monthSpend(userId: string): Promise<number> {
  return spendOn(userId, CHAT_FEATURES);
}

/** Whether Coach can answer now, and why not. */
async function chatReady(userId: string): Promise<{ ready: boolean; reason: string | null }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ready: false, reason: 'Coach has no Claude API key yet.' };
  if ((await monthSpend(userId)) >= CHAT_MONTHLY_CAP_USD) {
    return { ready: false, reason: `This month's $${CHAT_MONTHLY_CAP_USD} chat budget is used. It resets on the 1st.` };
  }
  return { ready: true, reason: null };
}

async function openThread(userId: string): Promise<string | null> {
  const [t] = (await sql`
    SELECT id FROM coach_threads
    WHERE user_id = ${userId} AND updated_at > NOW() - make_interval(hours => ${IDLE_HOURS})
    ORDER BY updated_at DESC LIMIT 1`) as Row[];
  return t ? String(t.id) : null;
}

function proposalView(p: Row): ProposalView {
  return {
    id: String(p.id), title: String(p.title), why: (p.why as string) ?? null,
    items: (p.items as Item[]) ?? [], warnings: (p.warnings as string[]) ?? [],
    status: p.status as ProposalView['status'],
  };
}

async function threadMessages(threadId: string): Promise<MessageView[]> {
  const rows = (await sql`
    SELECT m.id, m.role, m.text, m.created_at, m.attachments, m.quick_replies, m.files,
           m.meta->>'thought' AS thought, m.meta->'questions' AS questions, m.meta->>'feedback' AS feedback,
           p.id AS p_id, p.title, p.why, p.items, p.warnings, p.status
    FROM coach_messages m LEFT JOIN coach_proposals p ON p.id = m.proposal_id
    WHERE m.thread_id = ${threadId} ORDER BY m.created_at, m.id`) as Row[];
  return rows.map((r) => ({
    id: String(r.id), role: r.role as 'user' | 'assistant', text: String(r.text), createdAt: toIso(r.created_at),
    proposal: r.p_id ? proposalView({ ...r, id: r.p_id }) : null,
    attachments: (r.attachments as Attachment[] | null) ?? [],
    quickReplies: (r.quick_replies as string[] | null) ?? [],
    files: (r.files as FileRef[] | null) ?? [],
    thought: (r.thought as string | null) || null,
    questions: Array.isArray(r.questions) ? (r.questions as Question[]) : [],
    feedback: r.feedback === 'up' || r.feedback === 'down' ? r.feedback : null,
  }));
}

/** True while Paolo's last message has no reply yet and Coach can still be working on it. */
export function isAnswering(messages: Pick<MessageView, 'role' | 'createdAt'>[], nowMs: number): boolean {
  const last = messages.at(-1);
  if (!last || last.role !== 'user' || !last.createdAt) return false;
  return nowMs - Date.parse(last.createdAt) < ANSWERING_MS;
}

/**
 * GET /api/app/coach: the open thread (empty after a day idle), whether Coach can answer, quick prompts, and
 * `answering`: Coach is still working on the last message (the app left while it waited), so the phone polls.
 */
export async function loadCoach(userId: string) {
  const threadId = await openThread(userId);
  const ready = await chatReady(userId);
  const messages = threadId ? await threadMessages(threadId) : [];
  return {
    threadId,
    messages,
    answering: isAnswering(messages, Date.now()),
    ready: ready.ready,
    notice: ready.reason,
    suggestions: SUGGESTIONS,
    prompts: PROMPTS,
    firstName: await firstName(userId),
  };
}

/** Paolo's first name for the greeting ("Hi Paolo,"), or null. */
async function firstName(userId: string): Promise<string | null> {
  const [u] = (await sql`SELECT first_name, full_name FROM users WHERE id = ${userId} LIMIT 1`) as Row[];
  const name = String(u?.first_name ?? '').trim() || String(u?.full_name ?? '').trim().split(/\s+/)[0] || '';
  return name || null;
}

/**
 * GET /api/app/coach/threads: past chats, newest first, for the history sheet. Each is titled by its first message.
 * Empty chats (a New chat nobody wrote in) are left out.
 */
export async function listThreads(userId: string) {
  const rows = (await sql`
    SELECT t.id, t.updated_at, COUNT(m.id)::int AS n,
           (SELECT text FROM coach_messages f WHERE f.thread_id = t.id AND f.role = 'user' ORDER BY f.created_at, f.id LIMIT 1) AS first
    FROM coach_threads t JOIN coach_messages m ON m.thread_id = t.id
    WHERE t.user_id = ${userId}
    GROUP BY t.id, t.updated_at
    ORDER BY t.updated_at DESC
    LIMIT 50`) as Row[];
  return {
    threads: rows.map((r) => ({
      id: String(r.id),
      title: threadTitle(r.first as string | null),
      updatedAt: toIso(r.updated_at),
      messageCount: Number(r.n),
    })),
  };
}

/** A chat's title: its first message on one line, cut at about 60 characters. */
export function threadTitle(first: string | null): string {
  const line = String(first ?? '').replace(/\s+/g, ' ').trim();
  if (!line) return 'Photos';
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line;
}

/** POST /api/app/coach/threads: a new, empty chat becomes the open one. Returns the Coach tab's body. */
export async function startThread(userId: string) {
  const current = await openThread(userId);
  // The open chat is already empty: keep it rather than pile up empty ones.
  const [has] = current ? ((await sql`SELECT 1 FROM coach_messages WHERE thread_id = ${current} LIMIT 1`) as Row[]) : [];
  if (!current || has) await sql`INSERT INTO coach_threads (id, user_id) VALUES (${createId()}, ${userId})`;
  return loadCoach(userId);
}

/** POST /api/app/coach/threads/{id}: a past chat becomes the open one again. Null when it isn't Paolo's. */
export async function reopenThread(userId: string, id: string) {
  const rows = (await sql`UPDATE coach_threads SET updated_at = NOW() WHERE id = ${id} AND user_id = ${userId} RETURNING id`) as Row[];
  return rows.length ? loadCoach(userId) : null;
}

/** PUT /api/app/coach/messages/{id}/feedback: Paolo's thumbs on a reply (null clears it). False when not found. */
export async function setFeedback(userId: string, id: string, rating: 'up' | 'down' | null): Promise<boolean> {
  const rows = (await sql`
    UPDATE coach_messages
    SET meta = CASE WHEN ${rating}::text IS NULL THEN COALESCE(meta, '{}'::jsonb) - 'feedback' - 'feedbackAt'
                    ELSE COALESCE(meta, '{}'::jsonb) || jsonb_build_object('feedback', ${rating}::text, 'feedbackAt', NOW()) END
    WHERE id = ${id} AND user_id = ${userId} AND role = 'assistant'
    RETURNING id`) as Row[];
  return rows.length > 0;
}

/** What the reply shows besides its text, kept in its meta. */
type Shown = { thought?: string; questions?: Question[] };

type Extra = {
  proposalId?: string | null; costUsd?: number; model?: string | null; context?: string | null; meta?: Record<string, unknown> | null;
  attachments?: Attachment[]; quickReplies?: string[]; files?: FileRef[];
};

async function addMessage(threadId: string, userId: string, role: 'user' | 'assistant', text: string, extra: Extra = {}) {
  const id = createId();
  const [r] = (await sql`
    INSERT INTO coach_messages (id, thread_id, user_id, role, text, proposal_id, model, cost_usd, context, meta, attachments, quick_replies, files)
    VALUES (${id}, ${threadId}, ${userId}, ${role}, ${text}, ${extra.proposalId ?? null}, ${extra.model ?? null},
            ${extra.costUsd ?? 0}, ${extra.context ?? null}, ${extra.meta ? JSON.stringify(extra.meta) : null}::jsonb,
            ${extra.attachments?.length ? JSON.stringify(extra.attachments) : null}::jsonb,
            ${extra.quickReplies?.length ? JSON.stringify(extra.quickReplies) : null}::jsonb,
            ${extra.files?.length ? JSON.stringify(extra.files) : null}::jsonb)
    RETURNING created_at`) as Row[];
  await sql`UPDATE coach_threads SET updated_at = NOW() WHERE id = ${threadId}`;
  return { id, createdAt: toIso(r?.created_at) };
}

/**
 * The thread so far as Claude reads it: each card as a line under its message. The newest photos and files come again
 * in full (`data` has their bytes); older ones are a line each.
 */
function historyOf(messages: MessageView[], data: Map<string, FileData> = new Map()): Turn[] {
  return messages.map((m) => {
    const blocks = m.files.flatMap((f) => (data.has(f.id) ? [fileBlock(data.get(f.id)!)] : []));
    const lines = [...m.files.filter((f) => !data.has(f.id)).map(fileNote), m.text].filter(Boolean);
    for (const a of m.attachments) lines.push(`[Showed a ${a.kind} card]`);
    if (m.quickReplies.length) lines.push(`[Offered: ${m.quickReplies.join(' | ')}]`);
    for (const q of m.questions) lines.push(`[Asked: ${q.title}${q.options.length ? ` (${q.options.join(' | ')})` : ''}]`);
    if (m.proposal) lines.push(`[Card "${m.proposal.title}": ${m.proposal.status}]`);
    return { role: m.role, text: lines.join('\n'), ...(blocks.length ? { blocks } : {}) };
  });
}

function clockIn(timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', weekday: 'long' }).format(new Date());
}

/** What the phone hears while Coach answers (the SSE stream of POST /api/app/coach/messages). */
export type CoachEvent =
  | ChatEvent
  | { type: 'status'; step: 'reading' }
  | { type: 'message'; message: MessageView };

/** Swallows a rejection until the promise is awaited, so a failed read never crashes the function first. */
function early<T>(p: Promise<T>): Promise<T> {
  p.catch(() => {});
  return p;
}

/** How long each read took, in ms, for the reply's meta. */
function timed<T>(p: Promise<T>, into: Record<string, number>, key: string, started: number): Promise<T> {
  return early(p.then((v) => { into[key] = Date.now() - started; return v; }));
}

/**
 * POST /api/app/coach/messages: stores Paolo's message, asks Claude, stores its answer and any card. Never throws for
 * a Claude failure: the answer says what went wrong, so the phone shows it in the thread. `onEvent` hears each step
 * as it happens (the stored message, reading, thinking, the reply's words), for the streaming answer.
 */
export async function sendMessage(
  userId: string, text: string, today: string, timeZone: string, onEvent?: (e: CoachEvent) => void, fileIds: string[] = [],
) {
  const started = Date.now();
  const emit = (e: CoachEvent) => { try { onEvent?.(e); } catch { /* the phone hung up */ } };
  emit({ type: 'status', step: 'reading' });
  // The reads Claude needs start at once, side by side with storing the message (they are most of the wait before
  // Claude starts).
  const reads: Record<string, number> = {};
  const readyP = timed(chatReady(userId), reads, 'readyMs', started);
  const rowsP = timed(planRows(userId, today), reads, 'planMs', started);
  const profileP = timed(buildProfile(sql, { userId, weeks: 2 }), reads, 'profileMs', started);
  // The change log is a nice-to-have: a failed read leaves it out instead of failing the answer.
  const changesP = timed(recentChangesText(userId, timeZone).catch(() => null), reads, 'changesMs', started);
  let threadId = await openThread(userId);
  if (!threadId) {
    threadId = createId();
    await sql`INSERT INTO coach_threads (id, user_id) VALUES (${threadId}, ${userId})`;
  }
  const [before, files] = await Promise.all([threadMessages(threadId), unclaimedFiles(userId, fileIds)]);
  const mine = await addMessage(threadId, userId, 'user', text, { files });
  await claimFiles(userId, mine.id, files.map((f) => f.id));
  const message: MessageView = {
    id: mine.id, role: 'user', text, createdAt: mine.createdAt, proposal: null, attachments: [], quickReplies: [], files,
    thought: null, questions: [], feedback: null,
  };
  // The photos Claude sees in full: this message's, then the newest earlier ones.
  const shown = filesToSend([...before, message]);
  const dataP = early(fileData(userId, [...before, message].flatMap((m) => m.files).filter((f) => shown.has(f.id))));
  emit({ type: 'message', message });
  let prepMs: number | null = null;
  // Every answer is kept with what led to it (the context, the tries, tokens, time), for analysis later.
  const answer = async (reply: string, proposal: ProposalView | null = null, extra: Extra = {}, shown: Shown = {}) => {
    const meta = { ...extra.meta, ...(shown.thought ? { thought: shown.thought } : {}), ...(shown.questions?.length ? { questions: shown.questions } : {}), latencyMs: Date.now() - started, prepMs, reads, streamed: Boolean(onEvent), timeZone, today };
    const saved = await addMessage(threadId, userId, 'assistant', reply, { ...extra, proposalId: proposal?.id ?? null, meta });
    const view: MessageView = {
      id: saved.id, role: 'assistant', text: reply, createdAt: saved.createdAt, proposal,
      attachments: extra.attachments ?? [], quickReplies: extra.quickReplies ?? [], files: [],
      thought: shown.thought || null, questions: shown.questions ?? [], feedback: null,
    };
    return { threadId, message, reply: view };
  };

  const ready = await readyP;
  if (!ready.ready) return answer(ready.reason ?? 'Coach can\'t answer right now.', null, { meta: { stop: 'not_ready' } });

  let context: string | null = null;
  try {
    const [rows, profile, data, changes] = await Promise.all([rowsP, profileP, dataP, changesP]);
    const system = chatSystemPrompt();
    context = chatContext({ today, time: clockIn(timeZone), timeZone, plan: planText(rows, today), profileMd: profile.md, changes });
    prepMs = Date.now() - started;
    const result = await chatWithClaude({
      client: new Anthropic({ timeout: 100_000, maxRetries: 1 }),
      system,
      history: historyOf(before, data),
      context,
      text: text || `(Paolo sent ${filesPhrase(files)} with no words.)`,
      files: files.map((f): object => (data.has(f.id) ? fileBlock(data.get(f.id)!) : { type: 'text', text: fileNote(f) })),
      check: (input, attempt) => checkProposalInput(input, { rows, today, templates: templateNames(profile) }, attempt),
      checkCard: (input) => checkCard(input, { rows, today }),
      deadline: started + BUDGET_MS,
      onEvent: emit,
    });
    let proposal: ProposalView | null = null;
    if (result.proposal) {
      const p = result.proposal as { title: string; why: string; changes: Change[]; items: Item[]; warnings: string[]; basis: Record<string, string> };
      const id = createId();
      // A new card replaces the thread's older open ones: their changes were planned on the old week.
      await sql`UPDATE coach_proposals SET status = 'stale', decided_at = NOW() WHERE thread_id = ${threadId} AND status = 'open'`;
      await sql`
        INSERT INTO coach_proposals (id, thread_id, user_id, title, why, changes, items, warnings, status)
        VALUES (${id}, ${threadId}, ${userId}, ${p.title}, ${p.why || null},
                ${JSON.stringify({ ops: p.changes, basis: p.basis })}::jsonb, ${JSON.stringify(p.items)}::jsonb,
                ${JSON.stringify(p.warnings)}::jsonb, 'open')`;
      proposal = { id, title: p.title, why: p.why || null, items: p.items, warnings: p.warnings, status: 'open' };
    }
    const attachments = await resolveCards(userId, result.cards as CardRef[], rows, today, timeZone);
    const reply = result.reply ||
      (proposal ? 'Here is the change.' : attachments.length ? 'Here it is.' : result.questions.length ? 'A few quick questions first.' : result.stop === 'refusal' ? 'I can\'t help with that one.' : 'I couldn\'t finish that answer. Try again.');
    const out = await answer(reply, proposal, {
      costUsd: result.usage.usd, model: result.model ?? MODEL, context, attachments, quickReplies: result.replies,
      meta: {
        stop: result.stop, turns: result.turns, usage: result.usage, attempts: result.attempts, cards: result.cards,
        replyFromModel: Boolean(result.reply), prompt: createHash('sha256').update(system).digest('hex').slice(0, 12),
        timing: result.timing, effort: EFFORT,
      },
    }, { thought: result.thought, questions: result.questions as Question[] });
    await recordAiUsage(userId, {
      feature: 'chat', model: result.model ?? MODEL, effort: EFFORT, usage: result.usage,
      durationMs: Date.now() - started, ok: result.stop !== 'error', refId: out.reply.id,
    });
    return out;
  } catch (error) {
    const why = error instanceof Anthropic.APIError ? `Claude API error ${error.status ?? ''}`.trim() : error instanceof Error ? error.message : 'unknown error';
    console.error('Coach chat failed:', why);
    const out = await answer(`Coach couldn't answer (${why}). Try again.`, null, { context, meta: { stop: 'error', error: why } });
    // What a failed call spent before it threw isn't known; the row still counts the failure.
    await recordAiUsage(userId, { feature: 'chat', model: MODEL, effort: EFFORT, durationMs: Date.now() - started, ok: false, refId: out.reply.id });
    return out;
  }
}

/** When this instance last warmed the cache; a warm-up within this long is skipped. */
let warmedAt = 0;
const WARM_EVERY_MS = 10 * 60_000;

/**
 * Warms Claude's cache of the chat's system prompt and tools (a `max_tokens: 0` request: no answer, no output
 * tokens), so the first message after the tab opens doesn't wait for a cold prompt. Runs after GET /api/app/coach
 * answers. Costs a cache read when it is already warm, a cache write (about $0.07) when it isn't.
 */
export async function warmCoach(userId: string): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY || Date.now() - warmedAt < WARM_EVERY_MS) return;
  warmedAt = Date.now();
  try {
    if ((await monthSpend(userId)) >= CHAT_MONTHLY_CAP_USD) return;
    const client = new Anthropic({ timeout: 20_000, maxRetries: 0 });
    const params = chatRequest({ system: chatSystemPrompt(), messages: chatMessages([], '<now>warm-up</now>', 'warm-up'), maxTokens: 0 });
    // The warm-up's message isn't shared with a real one: only the system prompt and tools are kept.
    params.messages = params.messages.map((m: { role: string; content: unknown }) => ({
      ...m, content: Array.isArray(m.content) ? m.content.map((b: Record<string, unknown>) => ({ type: b.type, text: b.text })) : m.content,
    }));
    const t0 = Date.now();
    const res = await client.beta.messages.create(params as never);
    const r = res as { model?: string; usage?: { cache_read_input_tokens?: number; cache_creation_input_tokens?: number } };
    const u = r.usage;
    console.log(`[coach] warm-up: cache read ${u?.cache_read_input_tokens ?? 0}, written ${u?.cache_creation_input_tokens ?? 0}`);
    const model = r.model ?? MODEL;
    await recordAiUsage(userId, { feature: 'chat_warmup', model, effort: EFFORT, usage: usageOf(u, model), durationMs: Date.now() - t0 });
  } catch (error) {
    warmedAt = 0;
    console.error('Coach warm-up failed:', error instanceof Error ? error.message : 'unknown error');
  }
}

async function proposalRow(userId: string, id: string) {
  const [p] = (await sql`SELECT * FROM coach_proposals WHERE id = ${id} AND user_id = ${userId}`) as Row[];
  return p ?? null;
}

/** The Lift templates' names from the profile (its "Lift templates"), for a chat-added gym lift. */
function templateNames(profile: unknown): string[] {
  const list = (profile as { json?: { liftTemplates?: { name?: unknown }[] } } | null)?.json?.liftTemplates ?? [];
  return list.map((t) => String(t?.name ?? '').trim()).filter(Boolean);
}

export type DecideResult = { status: number; body: object };

/**
 * POST /api/app/coach/proposals/{id}/apply: runs the changes in order, then pushes the weeks to Google Calendar.
 * 409 when the proposal isn't open, or when a workout it touches changed since Coach proposed (it is then stale). A
 * write that fails puts back the ones before it.
 */
export async function applyProposal(userId: string, id: string, today: string): Promise<DecideResult> {
  const p = await proposalRow(userId, id);
  if (!p) return { status: 404, body: { error: 'not found' } };
  if (p.status !== 'open') return { status: 409, body: { error: `this change is ${p.status}`, proposal: proposalView(p) } };
  const { ops, basis } = p.changes as { ops: Change[]; basis: Record<string, string> };
  const rows = await planRows(userId, today);
  if (isStale(basis, rows)) {
    await sql`UPDATE coach_proposals SET status = 'stale', decided_at = NOW() WHERE id = ${id}`;
    return { status: 409, body: { error: 'the plan changed since Coach proposed this; ask again', proposal: proposalView({ ...p, status: 'stale' }) } };
  }
  let undo: Undo[];
  let dates: string[];
  try {
    ({ undo, dates } = await applyAll(userId, ops, rows, today));
  } catch (error) {
    if (!(error instanceof ApplyError)) throw error;
    pushPlanWeeks(userId, error.dates);
    return { status: 409, body: { error: `Coach couldn't apply it (${error.message}); nothing changed`, proposal: proposalView(p) } };
  }
  await sql`UPDATE coach_proposals SET status = 'applied', undo = ${JSON.stringify(undo)}::jsonb, decided_at = NOW() WHERE id = ${id}`;
  pushPlanWeeks(userId, dates);
  // A new gym lift gets its Lift session (exercises, sets, loads) now, as after an accepted plan; the hourly backstop
  // (/api/cron/lift-pending) catches it if the dispatch fails.
  if (ops.some((c) => c.op === 'add' && c.liftTemplate)) {
    const started = await dispatchWorkflow('plan-apply.yml').catch((e: unknown) => ({ error: String(e) }));
    if ('error' in started) console.error('Coach chat: Lift planning:', started.error);
  }
  return { status: 200, body: { proposal: proposalView({ ...p, status: 'applied' }), dates: [...new Set(dates)].sort() } };
}

/** POST /api/app/coach/proposals/{id}/undo: puts back what Apply changed, last change first. */
export async function undoProposal(userId: string, id: string, today: string): Promise<DecideResult> {
  const p = await proposalRow(userId, id);
  if (!p) return { status: 404, body: { error: 'not found' } };
  if (p.status !== 'applied') return { status: 409, body: { error: `this change is ${p.status}`, proposal: proposalView(p) } };
  const dates = await undoAll(userId, (p.undo as Undo[]) ?? [], today);
  await sql`UPDATE coach_proposals SET status = 'undone', decided_at = NOW() WHERE id = ${id}`;
  pushPlanWeeks(userId, dates);
  return { status: 200, body: { proposal: proposalView({ ...p, status: 'undone' }), dates: [...new Set(dates)].sort() } };
}

/** POST /api/app/coach/proposals/{id}/dismiss. */
export async function dismissProposal(userId: string, id: string): Promise<DecideResult> {
  const p = await proposalRow(userId, id);
  if (!p) return { status: 404, body: { error: 'not found' } };
  if (p.status !== 'open') return { status: 409, body: { error: `this change is ${p.status}`, proposal: proposalView(p) } };
  await sql`UPDATE coach_proposals SET status = 'dismissed', decided_at = NOW() WHERE id = ${id}`;
  return { status: 200, body: { proposal: proposalView({ ...p, status: 'dismissed' }) } };
}
