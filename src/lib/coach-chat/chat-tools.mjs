// @ts-check
// Every tool the Coach chat gives Claude, in one toolbox (tool-registry.mjs; lift/COACH-CHAT.md, "Tools"). To add a
// tool: define it next to its feature (data-tools.mjs, lift-tools.mjs, web-tools.mjs…), add it to the list below, and
// for a read tool add its runner to tools.ts. Pure.

import { ASK_TOOL, REPLIES_TOOL, SHOW_TOOL } from './cards.mjs';
import { DATA_TOOLS } from './data-tools.mjs';
import { LIFT_READ_TOOLS } from './lift-tools.mjs';
import { cardTool, readTool, serverTool, toolbox } from './tool-registry.mjs';
import { WEB_FETCH_TOOL, WEB_SEARCH_TOOL } from './web-tools.mjs';

export const PROPOSE_TOOL = {
  name: 'propose_changes',
  description:
    'Show Paolo a card with plan changes and an Apply button. Nothing changes until he taps Apply. Call it at most ' +
    'once per answer, before your reply (write the reply after it answers ok). Workouts are named by the id from <plan>. The server checks the changes and ' +
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
          '{ op: "template", template, exercise, action?, sets?, reps?, rest?, weight?, note? } (a Lift template ' +
          'slot: action update (default) | add | remove; reps 8 or "8-12", rest in seconds, weight in the slot\'s unit; ' +
          'every lift on the template that has not started is planned again) | ' +
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

/** The chat's tools, in the order they go to Claude: cards, reads, then the web. */
export const CHAT_TOOLS = toolbox([
  cardTool(PROPOSE_TOOL, 'proposing'),
  cardTool(SHOW_TOOL, 'card'),
  cardTool(REPLIES_TOOL),
  cardTool(ASK_TOOL),
  ...DATA_TOOLS.map((t) => readTool(t)),
  ...LIFT_READ_TOOLS.map((t) => readTool(t)),
  serverTool(WEB_SEARCH_TOOL, 'searching'),
  serverTool(WEB_FETCH_TOOL, 'searching'),
]);

/** The read tools' names: tools.ts must run each one. */
export const READ_TOOL_NAMES = CHAT_TOOLS.names('read');
