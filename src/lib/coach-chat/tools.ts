/**
 * Runs the Coach chat's read tools on the server (chat-tools.mjs lists them). One runner per read tool, by name: a new
 * read tool adds its runner here, and tools.test.mjs fails until it does.
 */

import { READ_TOOL_NAMES } from './chat-tools.mjs';
import { runDataTool } from './data';
import { runLiftTool } from './lift-tools';

export type ToolAnswer = { ok: boolean; text: string };
type Runner = (userId: string, today: string, name: string, input: unknown) => Promise<ToolAnswer>;

export const READ_RUNNERS: Record<string, Runner> = {
  get_activity: runDataTool,
  find_activities: runDataTool,
  get_bests: runDataTool,
  get_load: runDataTool,
  get_lift_templates: runLiftTool,
  get_exercise_history: runLiftTool,
};

/** Answers one read tool call. An unknown or failing tool answers with an error line, never a throw. */
export async function runReadTool(userId: string, today: string, name: string, input: unknown): Promise<ToolAnswer> {
  const run = READ_RUNNERS[name];
  if (!run || !(READ_TOOL_NAMES as string[]).includes(name)) return { ok: false, text: `${name} is not a read tool.` };
  try {
    return await run(userId, today, name, input);
  } catch (e) {
    console.error('[coach-chat] tool failed', name, e);
    return { ok: false, text: `The read failed (${String((e as Error)?.message ?? e).slice(0, 120)}).` };
  }
}
