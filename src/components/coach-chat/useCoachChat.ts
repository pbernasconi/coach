'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createEventStreamParser } from '@kobo/web';
import { withAnswer } from './chatState.mjs';
import type { CoachBody, FileRef, Live, Message, Proposal, Step, ThreadSummary } from './types';

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const withTz = (path: string) => `${path}${path.includes('?') ? '&' : '?'}tz=${encodeURIComponent(tz())}`;
/** How often the panel reads the thread again while Coach finishes an answer it lost the stream of. */
const POLL_MS = 3000;

async function json<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(withTz(path), { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

const DECIDE_TITLE = { apply: 'Could not apply the change', dismiss: 'Could not dismiss the change', undo: 'Could not undo the change' } as const;

const emptyMessage = (text: string, files: FileRef[]): Message => ({
  id: `local-${Date.now()}`, role: 'user', text, createdAt: new Date().toISOString(), proposal: null,
  attachments: [], quickReplies: [], files, thought: null, questions: [], feedback: null,
});

export type UndoAsk = { proposalId: string; message: string; count: number };
/** Something that went wrong, under the thread: a title and the reason. */
export type Failure = { title: string; message: string };
/** How a send ended: `unsent` when the server never stored the message (the composer gets the words back). */
export type SendResult = 'sent' | 'unsent' | 'busy';

/**
 * The web Coach chat's state and actions over /api/coach (lift/APP-API.md, "Coach"): the thread, sending with the
 * streamed answer, Stop, past chats, thumbs, and Apply / Not now / Undo of a change card. `onPlanChanged` runs after
 * an Apply or Undo changed the plan (the page refreshes its data). Nothing loads until `enabled`.
 */
export function useCoachChat(enabled: boolean, onPlanChanged?: () => void) {
  const [data, setData] = useState<CoachBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [failed, setFailed] = useState<Failure | null>(null);
  const [pending, setPending] = useState<Record<string, 'apply' | 'dismiss' | 'undo'>>({});
  const [undoAsk, setUndoAsk] = useState<UndoAsk | null>(null);
  const abort = useRef<AbortController | null>(null);
  // A send in progress, and whether the server is still answering, read at once (a second click on a quick reply
  // comes before React renders the first one's state).
  const sending = useRef(false);
  const answering = useRef(false);
  answering.current = Boolean(data?.answering);

  const load = useCallback(async () => {
    try {
      const { status, body } = await json<CoachBody & { error?: string }>('/api/coach');
      if (status !== 200) throw new Error(body.error ?? `HTTP ${status}`);
      setData(body);
      setError(null);
      return body;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the chat');
      return null;
    }
  }, []);

  // Read on first open only: a page view that never opens Coach makes no request (and no cache warm-up).
  const started = useRef(false);
  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    void load();
  }, [enabled, load]);

  // An answer that lost its stream (Stop, a closed tab, a dropped connection) still finishes on the server.
  useEffect(() => {
    if (!data?.answering || live) return;
    const t = setTimeout(() => void load(), POLL_MS);
    return () => clearTimeout(t);
  }, [data, live, load]);

  const send = useCallback(async (text: string, files: FileRef[] = []): Promise<SendResult> => {
    // One message at a time: a new one while Coach still finishes the last (after Stop or a reload) would land before
    // that answer and be read by Claude as part of it.
    if (sending.current || answering.current) return 'busy';
    sending.current = true;
    let stored = false;
    const user = emptyMessage(text, files);
    setFailed(null);
    setLive({ user, step: 'reading', thought: '', text: '' });
    const controller = new AbortController();
    abort.current = controller;
    let done = false;
    try {
      const res = await fetch(withTz('/api/coach/messages'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ text, files: files.map((f) => f.id) }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parse = createEventStreamParser();
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        for (const e of parse(decoder.decode(value, { stream: true }))) {
          const d = JSON.parse(e.data) as Record<string, unknown>;
          if (e.event === 'message') {
            stored = true;
            setLive((l) => (l ? { ...l, user: d.message as Message } : l));
          }
          else if (e.event === 'status') setLive((l) => (l ? { ...l, step: d.step as Step } : l));
          else if (e.event === 'thinking') setLive((l) => (l ? { ...l, thought: l.thought + String(d.text ?? '') } : l));
          else if (e.event === 'text') setLive((l) => (l ? { ...l, text: l.text + String(d.delta ?? '') } : l));
          else if (e.event === 'done') {
            done = true;
            const body = d as { threadId: string; message: Message; reply: Message };
            setData((cur) => (cur ? withAnswer(cur, body) : cur));
            setLive(null);
          } else if (e.event === 'error') throw new Error(String(d.error ?? 'Coach could not answer. Try again.'));
        }
      }
      if (!done) throw new Error('The answer stopped early.');
      return 'sent';
    } catch (e) {
      const stopped = controller.signal.aborted;
      const reason = e instanceof Error ? e.message : 'Coach could not answer. Try again.';
      if (!stopped) {
        setFailed(stored
          ? { title: 'Coach could not answer', message: reason }
          : { title: 'Your message did not send', message: reason === 'text is empty' ? 'Write something first.' : reason });
      }
      setLive(null);
      // The server keeps going: read the thread, which shows the answer once it is stored.
      await load();
      return stored ? 'sent' : 'unsent';
    } finally {
      abort.current = null;
      sending.current = false;
    }
  }, [load]);

  const stop = useCallback(() => abort.current?.abort(), []);

  const replaceProposal = (p: Proposal) =>
    setData((cur) => (cur ? { ...cur, messages: cur.messages.map((m) => (m.proposal?.id === p.id ? { ...m, proposal: p } : m)) } : cur));

  const decide = useCallback(async (id: string, op: 'apply' | 'dismiss' | 'undo', partial = false) => {
    setPending((p) => ({ ...p, [id]: op }));
    try {
      const { status, body } = await json<{ proposal?: Proposal; error?: string; needsConfirm?: boolean; undoable?: number }>(
        `/api/coach/proposals/${id}/${op}`,
        { method: 'POST', body: op === 'undo' ? JSON.stringify({ partial }) : undefined },
      );
      if (body.needsConfirm) {
        setUndoAsk({ proposalId: id, message: body.error ?? 'Some of these changed since.', count: body.undoable ?? 0 });
        return;
      }
      setUndoAsk(null);
      if (body.proposal) replaceProposal(body.proposal);
      if (status === 200 && op !== 'dismiss') onPlanChanged?.();
      if (status !== 200 && !body.proposal) setFailed({ title: DECIDE_TITLE[op], message: body.error ?? 'Try again.' });
    } catch {
      setFailed({ title: DECIDE_TITLE[op], message: 'Check the connection and try again.' });
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    }
  }, [onPlanChanged]);

  const rate = useCallback(async (id: string, rating: 'up' | 'down' | null, previous: 'up' | 'down' | null = null) => {
    const setRating = (r: 'up' | 'down' | null) =>
      setData((cur) => (cur ? { ...cur, messages: cur.messages.map((m) => (m.id === id ? { ...m, feedback: r } : m)) } : cur));
    setRating(rating);
    // The thumb fills at once and goes back if the server does not take it (as on the iPhone).
    const res = await json(`/api/coach/messages/${id}/feedback`, { method: 'PUT', body: JSON.stringify({ rating }) }).catch(() => null);
    if (res?.status !== 200) setRating(previous);
  }, []);

  const newChat = useCallback(async () => {
    if (live) return;
    const { status, body } = await json<CoachBody>('/api/coach/threads', { method: 'POST' });
    if (status === 200) setData(body);
    setFailed(null);
    setUndoAsk(null);
  }, [live]);

  const openThread = useCallback(async (id: string) => {
    if (live) return;
    const { status, body } = await json<CoachBody>(`/api/coach/threads/${id}`, { method: 'POST' });
    if (status === 200) setData(body);
    setFailed(null);
    setUndoAsk(null);
  }, [live]);

  const listThreads = useCallback(async (): Promise<ThreadSummary[]> => {
    const { status, body } = await json<{ threads: ThreadSummary[] }>('/api/coach/threads');
    return status === 200 ? body.threads : [];
  }, []);

  return {
    data, error, live, failed, pending, undoAsk,
    load, send, stop, decide, rate, newChat, openThread, listThreads,
    cancelUndo: () => setUndoAsk(null),
    clearFailed: () => setFailed(null),
  };
}

export type CoachChatState = ReturnType<typeof useCoachChat>;
