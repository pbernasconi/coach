// Who changes the plan, for its change log (plan_changes, drizzle/0024_plan_changes.sql). A database trigger logs
// every insert, update and delete of a planned workout; the write names its source in the row's `change_source`
// column (an insert or update) or, for a delete, in the `coach.change_source` setting of its own statement.
//
// The entry points say who they are once (`withPlanSource('app', …)` in the app API's write wrapper, 'chat' around
// a Coach proposal's Apply), and the shared plan writes (month.ts, queries.ts) read it with `planSource()`. A write
// outside any of them falls back to the default its caller gives: 'web' for the Plan page's writes.

import { AsyncLocalStorage } from 'node:async_hooks';

/** chat: Coach chat. app: the iPhone app. web: the Plan page. planner: an accepted plan. calendar: a Google Calendar
 * move. lift: a Lift session moved on the phone. script: a CLI job (lift-plan.mjs, plan-edit.mjs). */
export const PLAN_SOURCES = /** @type {const} */ (['chat', 'app', 'web', 'planner', 'calendar', 'lift', 'script', 'unknown']);

const store = new AsyncLocalStorage();

/**
 * Runs `fn` with `source` as the plan change source of every plan write inside it.
 * @template T
 * @param {string} source
 * @param {() => T} fn
 * @returns {T}
 */
export function withPlanSource(source, fn) {
  return store.run(source, fn);
}

/**
 * The source of the plan write being made: the nearest withPlanSource, else `fallback`.
 * @param {string} [fallback]
 * @returns {string}
 */
export function planSource(fallback = 'web') {
  const s = store.getStore();
  return typeof s === 'string' && s ? s : fallback;
}
