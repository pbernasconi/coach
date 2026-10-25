// The server planner's prompt: the coach's own rules (plan.md, PLAN-STRUCTURE.md and the review, weather and safety
// parts of the cloud prompt, copied by scripts/planner-prompt.mjs) as one frozen system prompt, and the week to plan
// as the user message. The system prompt never changes between calls, so it is cached. Pure.

import { PROMPT_VERSION, SOURCES } from './prompt-sources.generated.mjs';

export { PROMPT_VERSION };

/** The part of the cloud prompt from "## Weather" on: the weather, the review Paolo reads, and the safety rules. */
function cloudSections() {
  const p = SOURCES['scripts/plan-cloud/PROMPT.md'];
  const at = p.indexOf('## Weather');
  return at >= 0 ? p.slice(at) : p;
}

const PREAMBLE = `# Coach: plan a week on the server

You are Paolo's coach. Coach runs you with no person in the loop, so you cannot ask questions. Paolo reviews your
plan in Coach and accepts or rejects it; nothing reaches his calendar, Lift or Garmin before he accepts.

The user message holds the request (what to plan and Paolo's answers) and the athlete profile for the week. The
coach's planning rules follow below: \`.claude/commands/plan.md\` and \`plans/PLAN-STRUCTURE.md\`.

## What to do

1. Draft the week by plan.md: Step 4 ("Draft the plan"), the JSON format of Step 6, the "Structured workouts"
   paragraph of Step 7, the "Full weeks, floor weeks and the month" section and the "Coaching principles". Skip every
   step that runs a script, asks a question or asks for a confirm.
2. Call \`submit_plan\` once with the plan (the Step 6 JSON plus a \`review\` object, described below) and a summary
   of at most 8 lines. Coach checks it against the format and Paolo's rules (one session or one block a day, no run
   after a lift, no heavy lift on a quality day, 2 lifts with 1 as the floor, never miss twice, no back-to-back hard
   days, a long run, days off and meetings, the hours he has). If something fails, the result lists it: fix it and
   call \`submit_plan\` again. A rule you bend on purpose (he asked for 1 lift, a floor week) gets a line in
   \`review.decisions\` or \`review.watch\`.
3. When \`submit_plan\` says the plan is saved, stop. Don't write the plan as text.

\`request.hours\` is a ceiling, not a target; \`request.gym\` is the strength sessions he wants; \`request.daysOff\` are
days with no training (put them in \`rest[]\`). A null answer means: decide from the data. Paolo's answers win over
your defaults; when the data argues against one, follow him and name the risk in \`review.watch\`.
`;

/** The system prompt: the same bytes on every call. */
export function systemPrompt() {
  return [
    PREAMBLE,
    cloudSections(),
    '# .claude/commands/plan.md\n\n' + SOURCES['.claude/commands/plan.md'],
    '# plans/PLAN-STRUCTURE.md\n\n' + SOURCES['plans/PLAN-STRUCTURE.md'],
  ].join('\n\n---\n\n');
}

/**
 * The user message: the request, Paolo's note for a revision, and the profile.
 * @param {{ request: any, profileMd: string, revise?: { note: string, plan: any } | null }} p
 */
export function userMessage({ request, profileMd, revise = null }) {
  const parts = [
    `<request>\n${JSON.stringify(request, null, 2)}\n</request>`,
    `Plan the week of ${request.weekStart} (weekStart must be that Monday).`,
  ];
  if (revise) {
    parts.push(
      `Paolo asked for changes to this plan. Keep what he didn't mention.\n<paolo_note>\n${revise.note}\n</paolo_note>\n` +
      `<previous_plan>\n${JSON.stringify(revise.plan)}\n</previous_plan>`,
    );
  }
  parts.push(`<profile>\n${profileMd}\n</profile>`);
  return parts.join('\n\n');
}

/** The submit_plan tool. The plan is checked in code (proposal.mjs, rules.mjs), so its schema stays loose. */
export const SUBMIT_TOOL = {
  name: 'submit_plan',
  description:
    'Submit the week plan for Paolo to review. plan is the Step 6 JSON (weekStart, title, context, constraints, philosophy, ' +
    'completed, rest, events) plus a review object { headline, reasoning, decisions, watch }. summary is at most 8 lines. ' +
    'Returns "saved" or the list of problems to fix.',
  eager_input_streaming: true,
  input_schema: {
    type: 'object',
    properties: {
      plan: { type: 'object', description: 'The plan JSON (plan.md Step 6) with a review object.' },
      summary: { type: 'string', description: 'At most 8 lines: the review in plain text.' },
    },
    required: ['plan', 'summary'],
  },
};
