// The Coach chat's context read tools (src/lib/coach-chat/context-tools.ts) on a real Postgres: get_health reads
// health_samples into a day table with averages; get_plan, get_calendar, get_labs and get_dexa answer on a user with
// no rows instead of failing; a bad range goes back as a problem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { runReadTool } from '@/lib/coach-chat/tools';

const user = 'user_coach_context';
const today = '2026-11-03';

test('context reads answer from the database', async () => {
  await sql`DELETE FROM health_samples WHERE user_id = ${user}`;
  await sql`DELETE FROM users WHERE id = ${user}`;
  await sql`INSERT INTO users (id, email) VALUES (${user}, 'coach-context@example.com')`;
  for (const [date, sleep, hrv] of [['2026-11-01', 450, 62], ['2026-11-02', 390, 54]] as const) {
    await sql`INSERT INTO health_samples (user_id, date, metric, value, unit, source)
              VALUES (${user}, ${date}, 'sleep_total_min', ${sleep}, 'min', 'garmin'), (${user}, ${date}, 'hrv_night_avg_ms', ${hrv}, 'ms', 'garmin')`;
  }

  const health = await runReadTool(user, today, 'get_health', { from: '2026-10-28' }, { timeZone: 'America/Los_Angeles' });
  assert.equal(health.ok, true, health.text);
  if (process.env.SHOW) console.log(health.text);
  assert.match(health.text, /^2026-11-02 {2}sleep 6h30, HRV 54ms$/m);
  assert.match(health.text, /Average: sleep 7h00, HRV 58ms/);

  const plan = await runReadTool(user, today, 'get_plan', { from: '2026-10-01', to: '2026-10-31' });
  assert.equal(plan.ok, true, plan.text);
  assert.match(plan.text, /^Plan 2026-10-01 to 2026-10-31:\nNo workouts planned\.$/);

  const cal = await runReadTool(user, today, 'get_calendar', { from: '2026-11-10', to: '2026-11-20' }, { timeZone: 'America/Los_Angeles' });
  assert.equal(cal.ok, true, cal.text);
  assert.match(cal.text, /No events/);

  assert.equal((await runReadTool(user, today, 'get_labs', {})).text, 'No lab results.');
  assert.equal((await runReadTool(user, today, 'get_dexa', {})).text, 'No DEXA scans.');

  const bad = await runReadTool(user, today, 'get_plan', { from: '2026-01-01', to: '2026-10-31' });
  assert.equal(bad.ok, false);
  assert.match(bad.text, /at most 63 days/);
});
