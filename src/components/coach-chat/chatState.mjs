// @ts-check
// How the web Coach chat's thread changes when an answer lands. Pure, so node --test can check it.

/**
 * The thread with a finished answer (the stream's `done`): Paolo's message and Coach's reply at the end.
 * - A reply in another thread than the one on screen (the tab sat open past a day idle, so the server started a new
 *   chat) starts the list over, as the server's thread does, instead of joining yesterday's chat.
 * - A reply with a change card turns the cards still open into `stale`, as the server did when it stored the new one.
 * @template {{ threadId: string | null, answering: boolean, messages: any[] }} T
 * @param {T} cur
 * @param {{ threadId: string, message: any, reply: any }} done
 * @returns {T}
 */
export function withAnswer(cur, done) {
  const same = cur.threadId === done.threadId;
  const before = same ? cur.messages : [];
  const settled = done.reply?.proposal
    ? before.map((m) => (m.proposal?.status === 'open' ? { ...m, proposal: { ...m.proposal, status: 'stale' } } : m))
    : before;
  return { ...cur, threadId: done.threadId, answering: false, messages: [...settled, done.message, done.reply] };
}
