// The week as it is in Coach now, as text for a check-in's prompt: each workout with its id, day, time, status
// (skipped and why, changed on the web, adapted) and how the done ones felt.

import { toDay as day } from '../db-time.mjs';
import { feedbackLine } from '../plan/feedback.mjs';

/**
 * @param {any} sql  @param {string} userId  @param {string} weekStart  the Monday
 * @returns {Promise<string>}
 */
export async function currentWeekText(sql, userId, weekStart) {
  const [plan] = await sql`
    SELECT id, context_data, feel_log FROM training_plans WHERE user_id = ${userId} AND week_start_date = ${weekStart}`;
  if (!plan) return `No plan for the week of ${weekStart} yet: plan the days left from today.`;
  const rows = await sql`
    SELECT id, scheduled_date, start_time, title, intensity, duration, tss, status, skip_reason, edited_at, adapted_from
    FROM training_plan_activities WHERE plan_id = ${plan.id}
    ORDER BY scheduled_date, sort_order, start_time NULLS LAST`;
  const felt = await sql`
    SELECT date, title, item, feel, rpe, comment FROM workout_feedback
    WHERE user_id = ${userId} AND date >= ${weekStart}::date AND date < ${weekStart}::date + 7 ORDER BY date`;
  return formatWeek({ weekStart, title: plan.context_data?.title ?? '', feelLog: plan.feel_log, rows, felt });
}

/** Pure: the text from the rows. */
export function formatWeek({ weekStart, title = '', feelLog = null, rows = [], felt = [] }) {
  const lines = [`Week of ${weekStart}${title ? `: ${title}` : ''}`];
  if (feelLog && Object.keys(feelLog).length) lines.push(`How I feel (logged on the web): ${JSON.stringify(feelLog)}`);
  for (const r of rows) {
    const flags = [
      r.status === 'skipped' && `SKIPPED${r.skip_reason ? ` (${r.skip_reason})` : ''}`,
      r.edited_at && 'changed on the web',
      r.adapted_from && `adapted, before: ${JSON.stringify(r.adapted_from)}`,
    ].filter(Boolean).join('; ');
    lines.push(`${r.id}  ${day(r.scheduled_date)} ${r.start_time ?? '--:--'}  ${r.title} (${r.intensity ?? '-'}, ${r.duration ?? '?'} min, ${r.tss ?? '?'} TSS)${flags ? `  [${flags}]` : ''}`);
  }
  if (felt.length) {
    lines.push('How it went:');
    for (const f of felt) lines.push(`  ${day(f.date)}  ${f.title ?? f.item}: ${feedbackLine(f)}`);
  }
  return lines.join('\n');
}
