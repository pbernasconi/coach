// The planner's prompt. The system prompt is the four prompt files in src/lib/planner/prompts/ (bundled by
// scripts/planner-prompt.mjs): the same bytes on every call, so it is cached. The user message is the week to plan.
// Pure.

import { PROMPT_VERSION, SOURCES } from './prompt-sources.generated.mjs';

export { PROMPT_VERSION };

/** The system prompt: planner.md, coaching.md, check-in.md, plan-structure.md, in that order. */
export function systemPrompt() {
  return Object.values(SOURCES).join('\n\n---\n\n');
}

/**
 * The user message: the request, Paolo's note for a revision, the current week for a check-in, and the profile.
 * @param {{ request: any, profileMd: string, today?: string | null, currentWeek?: string | null,
 *   revise?: { note: string, plan: any } | null }} p
 */
export function userMessage({ request, profileMd, today = null, currentWeek = null, revise = null }) {
  const checkin = request.kind === 'checkin';
  const parts = [
    `<request>\n${JSON.stringify(request, null, 2)}\n</request>`,
    checkin
      ? `Check in on the week of ${request.weekStart} (weekStart must be that Monday). Today is ${today}: leave the days before it as they were.`
      : `Plan the week of ${request.weekStart} (weekStart must be that Monday).`,
  ];
  if (revise) {
    parts.push(
      `Paolo asked for changes to this plan. Keep what he didn't mention.\n<paolo_note>\n${revise.note}\n</paolo_note>\n` +
      `<previous_plan>\n${JSON.stringify(revise.plan)}\n</previous_plan>`,
    );
  }
  if (checkin) parts.push(`<current_week>\n${currentWeek ?? 'No plan for this week yet.'}\n</current_week>`);
  parts.push(`<profile>\n${profileMd}\n</profile>`);
  return parts.join('\n\n');
}

/** The submit_plan tool. The plan is checked in code (proposal.mjs, rules.mjs), so its schema stays loose. */
export const SUBMIT_TOOL = {
  name: 'submit_plan',
  description:
    'Hand in the week plan for Paolo to review. plan is the plan JSON from the system prompt (weekStart, weekEnd, title, ' +
    'context, constraints, philosophy, completed, rest, events, review). summary is at most 8 lines. ' +
    'Returns "Saved" or the list of problems to fix.',
  eager_input_streaming: true,
  input_schema: {
    type: 'object',
    properties: {
      plan: { type: 'object', description: 'The plan JSON, with its review object.' },
      summary: { type: 'string', description: 'At most 8 lines: the review in plain text.' },
    },
    required: ['plan', 'summary'],
  },
};
