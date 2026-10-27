// @ts-check
// The Coach tab's prompt (lift/COACH-CHAT.md): the system prompt is coach-chat.md, then the planner's coaching.md,
// check-in.md (how a skip changes the week) and plan-structure.md (src/lib/planner/prompts/, bundled by
// scripts/planner-prompt.mjs), the same bytes on every call so it is cached. The context goes with each message from Paolo. Pure.

import { CHAT_PROMPT, SOURCES } from '../planner/prompt-sources.generated.mjs';

/** The chat stops using the API for the rest of the month at this spend, apart from the planner's cap. */
export const CHAT_MONTHLY_CAP_USD = 10;

/** coach-chat.md, coaching.md, check-in.md, plan-structure.md, in that order. */
export function chatSystemPrompt() {
  const s = /** @type {Record<string, string>} */ (SOURCES);
  return [CHAT_PROMPT, s['coaching.md'], s['check-in.md'], s['plan-structure.md']].join('\n\n---\n\n');
}

/**
 * The context sent with Paolo's message: the time, the plan with ids, and the profile.
 * @param {{ today: string, time: string, timeZone: string, plan: string, profileMd: string }} p
 */
export function chatContext({ today, time, timeZone, plan, profileMd }) {
  return [
    `<now>\nToday is ${today}, ${time} (${timeZone}).\n</now>`,
    `<plan>\n${plan}\n</plan>`,
    `<profile>\n${profileMd}\n</profile>`,
  ].join('\n\n');
}

/** Quick prompts above the field for the common cases (the iPhone shows them on an empty thread). */
export const SUGGESTIONS = ["I'm sore", 'Short on time today', 'Move today to tomorrow', 'Something came up'];
