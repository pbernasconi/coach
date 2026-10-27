// The coach domain of NOTIFICATION_EVENTS: Coach answered in the Coach tab. Sent for every reply, so an answer that
// lands while the app is in the background still reaches Paolo; the app shows no banner while the Coach tab is open.

import { z } from 'zod';
import { HOUR_SECONDS, defineEvent } from './define.mjs';

export const coachReplyPayload = z.object({
  messageId: z.string().regex(/^[0-9A-Za-z_-]{1,64}$/),
  threadId: z.string().regex(/^[0-9A-Za-z_-]{1,64}$/),
  /** The reply's text, or what it shows when the text is empty. */
  text: z.string().min(1).max(4000),
});

/** The reply as one line: Markdown marks and line breaks taken out. */
export function plainReply(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#>]+/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const COACH_NOTIFICATION_EVENTS = {
  'coach.replied': defineEvent({
    category: 'coach',
    payload: coachReplyPayload,
    idempotencyKey: (p) => `coach.replied:${p.messageId}`,
    title: () => 'Coach',
    body: (p) => plainReply(p.text) || 'Coach answered.',
    destination: () => ({ kind: 'coach' }),
    // One notice per thread: a newer reply replaces the older one on the lock screen.
    collapseKey: (p) => `coach:${p.threadId}`,
    threadKey: () => 'coach',
    interruptionLevel: 'active',
    ttlSeconds: 6 * HOUR_SECONDS,
  }),
};
