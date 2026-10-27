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
import { buildProfile } from '@/lib/planner/profile.mjs';
import { checkCard, type CardRef } from './cards.mjs';
import { resolveCards, type Attachment } from './cards';
import { checkProposalInput, isStale, planText, type Change, type Item } from './changes.mjs';
import { chatWithClaude, MODEL, type Turn } from './chat.mjs';
import { ApplyError, applyAll, planRows, undoAll, type Undo } from './writes';
import { CHAT_MONTHLY_CAP_USD, SUGGESTIONS, chatContext, chatSystemPrompt } from './prompt.mjs';

type Row = Record<string, unknown>;

/** A thread idle this long is closed; the next message starts a new one. */
const IDLE_HOURS = 24;
/** The last Claude request starts before this (the route stops at maxDuration 120 s). */
const BUDGET_MS = 75_000;
export const MAX_TEXT = 2000;

export type ProposalView = {
  id: string; title: string; why: string | null; items: Item[]; warnings: string[];
  status: 'open' | 'applied' | 'undone' | 'dismissed' | 'stale';
};
export type MessageView = {
  id: string; role: 'user' | 'assistant'; text: string; createdAt: string | null; proposal: ProposalView | null;
  attachments: Attachment[]; quickReplies: string[];
};

/** This month's chat spend, in USD. */
async function monthSpend(userId: string): Promise<number> {
  const [r] = (await sql`
    SELECT COALESCE(SUM(cost_usd), 0)::float AS usd FROM coach_messages
    WHERE user_id = ${userId} AND created_at >= date_trunc('month', NOW())`) as Row[];
  return Number(r?.usd ?? 0);
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
    SELECT m.id, m.role, m.text, m.created_at, m.attachments, m.quick_replies,
           p.id AS p_id, p.title, p.why, p.items, p.warnings, p.status
    FROM coach_messages m LEFT JOIN coach_proposals p ON p.id = m.proposal_id
    WHERE m.thread_id = ${threadId} ORDER BY m.created_at, m.id`) as Row[];
  return rows.map((r) => ({
    id: String(r.id), role: r.role as 'user' | 'assistant', text: String(r.text), createdAt: toIso(r.created_at),
    proposal: r.p_id ? proposalView({ ...r, id: r.p_id }) : null,
    attachments: (r.attachments as Attachment[] | null) ?? [],
    quickReplies: (r.quick_replies as string[] | null) ?? [],
  }));
}

/** GET /api/app/coach: the open thread (empty after a day idle), whether Coach can answer, and quick prompts. */
export async function loadCoach(userId: string) {
  const threadId = await openThread(userId);
  const ready = await chatReady(userId);
  return {
    threadId,
    messages: threadId ? await threadMessages(threadId) : [],
    ready: ready.ready,
    notice: ready.reason,
    suggestions: SUGGESTIONS,
  };
}

type Extra = {
  proposalId?: string | null; costUsd?: number; model?: string | null; context?: string | null; meta?: Record<string, unknown> | null;
  attachments?: Attachment[]; quickReplies?: string[];
};

async function addMessage(threadId: string, userId: string, role: 'user' | 'assistant', text: string, extra: Extra = {}) {
  const id = createId();
  const [r] = (await sql`
    INSERT INTO coach_messages (id, thread_id, user_id, role, text, proposal_id, model, cost_usd, context, meta, attachments, quick_replies)
    VALUES (${id}, ${threadId}, ${userId}, ${role}, ${text}, ${extra.proposalId ?? null}, ${extra.model ?? null},
            ${extra.costUsd ?? 0}, ${extra.context ?? null}, ${extra.meta ? JSON.stringify(extra.meta) : null}::jsonb,
            ${extra.attachments?.length ? JSON.stringify(extra.attachments) : null}::jsonb,
            ${extra.quickReplies?.length ? JSON.stringify(extra.quickReplies) : null}::jsonb)
    RETURNING created_at`) as Row[];
  await sql`UPDATE coach_threads SET updated_at = NOW() WHERE id = ${threadId}`;
  return { id, createdAt: toIso(r?.created_at) };
}

/** The thread so far as Claude reads it: each card as a line under its message. */
function historyOf(messages: MessageView[]): Turn[] {
  return messages.map((m) => {
    const lines = [m.text];
    for (const a of m.attachments) lines.push(`[Showed a ${a.kind} card]`);
    if (m.quickReplies.length) lines.push(`[Offered: ${m.quickReplies.join(' | ')}]`);
    if (m.proposal) lines.push(`[Card "${m.proposal.title}": ${m.proposal.status}]`);
    return { role: m.role, text: lines.join('\n') };
  });
}

function clockIn(timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', weekday: 'long' }).format(new Date());
}

/**
 * POST /api/app/coach/messages: stores Paolo's message, asks Claude, stores its answer and any card. Never throws for
 * a Claude failure: the answer says what went wrong, so the phone shows it in the thread.
 */
export async function sendMessage(userId: string, text: string, today: string, timeZone: string) {
  const started = Date.now();
  let threadId = await openThread(userId);
  if (!threadId) {
    threadId = createId();
    await sql`INSERT INTO coach_threads (id, user_id) VALUES (${threadId}, ${userId})`;
  }
  const before = await threadMessages(threadId);
  const mine = await addMessage(threadId, userId, 'user', text);
  const message: MessageView = { id: mine.id, role: 'user', text, createdAt: mine.createdAt, proposal: null, attachments: [], quickReplies: [] };
  // Every answer is kept with what led to it (the context, the tries, tokens, time), for analysis later.
  const answer = async (reply: string, proposal: ProposalView | null = null, extra: Extra = {}) => {
    const meta = { ...extra.meta, latencyMs: Date.now() - started, timeZone, today };
    const saved = await addMessage(threadId, userId, 'assistant', reply, { ...extra, proposalId: proposal?.id ?? null, meta });
    const view: MessageView = {
      id: saved.id, role: 'assistant', text: reply, createdAt: saved.createdAt, proposal,
      attachments: extra.attachments ?? [], quickReplies: extra.quickReplies ?? [],
    };
    return { message, reply: view };
  };

  const ready = await chatReady(userId);
  if (!ready.ready) return answer(ready.reason ?? 'Coach can\'t answer right now.', null, { meta: { stop: 'not_ready' } });

  let context: string | null = null;
  try {
    const rows = await planRows(userId, today);
    const profile = await buildProfile(sql, { userId, weeks: 2 });
    const system = chatSystemPrompt();
    context = chatContext({ today, time: clockIn(timeZone), timeZone, plan: planText(rows, today), profileMd: profile.md });
    const result = await chatWithClaude({
      client: new Anthropic({ timeout: 100_000, maxRetries: 1 }),
      system,
      history: historyOf(before),
      context,
      text,
      check: (input, attempt) => checkProposalInput(input, { rows, today }, attempt),
      checkCard: (input) => checkCard(input, { rows, today }),
      deadline: started + BUDGET_MS,
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
      (proposal ? 'Here is the change.' : attachments.length ? 'Here it is.' : result.stop === 'refusal' ? 'I can\'t help with that one.' : 'I couldn\'t finish that answer. Try again.');
    return answer(reply, proposal, {
      costUsd: result.usage.usd, model: result.model ?? MODEL, context, attachments, quickReplies: result.replies,
      meta: {
        stop: result.stop, turns: result.turns, usage: result.usage, attempts: result.attempts, cards: result.cards,
        replyFromModel: Boolean(result.reply), prompt: createHash('sha256').update(system).digest('hex').slice(0, 12),
      },
    });
  } catch (error) {
    const why = error instanceof Anthropic.APIError ? `Claude API error ${error.status ?? ''}`.trim() : error instanceof Error ? error.message : 'unknown error';
    console.error('Coach chat failed:', why);
    return answer(`Coach couldn't answer (${why}). Try again.`, null, { context, meta: { stop: 'error', error: why } });
  }
}

async function proposalRow(userId: string, id: string) {
  const [p] = (await sql`SELECT * FROM coach_proposals WHERE id = ${id} AND user_id = ${userId}`) as Row[];
  return p ?? null;
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
