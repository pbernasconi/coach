// The Coach chat's read tools (src/lib/coach-chat/data.ts) on a real Postgres: an activity with its km splits, best
// efforts and peaks reads back with the splits, the halves and its rank against older peaks; find_activities lists
// it; get_bests and get_load answer from activity_peaks and daily_training_load.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { runDataTool } from '@/lib/coach-chat/data';

const user = 'user_coach_data';
const today = '2026-10-31';
const paces = [322, 314, 311, 301, 285, 276, 273, 266, 268];

test('read tools answer from the stored activity, peaks and load', async () => {
  await sql`DELETE FROM strava_activities WHERE user_id = ${user}`;
  await sql`DELETE FROM activity_peaks WHERE user_id = ${user}`;
  await sql`DELETE FROM daily_training_load WHERE user_id = ${user} OR id LIKE 'dtl_%'`;
  await sql`DELETE FROM strava_connections WHERE user_id = ${user}`;
  await sql`DELETE FROM users WHERE id = ${user}`;
  await sql`INSERT INTO users (id, email) VALUES (${user}, 'coach-data@example.com')`;
  await sql`INSERT INTO strava_connections (id, user_id, athlete_id, access_token, refresh_token, expires_at, scope, is_active)
            VALUES ('conn_coach_data', ${user}, 5151, 't', 'r', ${Math.floor(Date.now() / 1000) + 3600}, 'read', true)`;
  await sql`INSERT INTO strava_activities (id, user_id, connection_id, strava_activity_id, name, type, sport_type, distance, moving_time,
              elapsed_time, total_elevation_gain, start_date, start_date_local, average_speed, average_heartrate, max_heartrate, tss, tss_method)
            VALUES ('act_now', ${user}, 'conn_coach_data', '777', 'Afternoon Run', 'Run', 'Run', 9844, 2920, 3061, 65,
                    '2026-10-31T23:22:26Z', '2026-10-31T16:22:26Z', 3.37, 158, 175, 61, 'hr'),
                   ('act_old', ${user}, 'conn_coach_data', '666', 'Fast 5k', 'Run', 'Run', 5000, 1300, 1300, 10,
                    '2026-10-01T15:00:00Z', '2026-10-01T08:00:00Z', 3.85, 170, 180, 50, 'hr'),
                   ('act_ride', ${user}, 'conn_coach_data', '555', 'Zwift', 'VirtualRide', 'VirtualRide', 30000, 3600, 3600, 0,
                    '2026-10-30T15:00:00Z', '2026-10-30T08:00:00Z', 8.3, 140, 160, 70, 'power')`;
  for (const [i, s] of paces.entries()) {
    await sql`INSERT INTO strava_activity_splits (id, activity_id, split_index, distance, moving_time, elapsed_time, average_speed, average_heartrate)
              VALUES (${`split_${i}`}, 'act_now', ${i + 1}, 1000, ${s}, ${s}, ${1000 / s}, ${150 + i * 2})`;
  }
  await sql`INSERT INTO strava_activity_details (activity_id, best_efforts, detail_fetched_at)
            VALUES ('act_now', ${JSON.stringify([{ name: '5K', distance: 5000, elapsedTime: 1421, movingTime: 1368, prRank: null }])}::jsonb, NOW())`;
  await sql`INSERT INTO activity_peaks (user_id, strava_activity_id, metric, span, value)
            VALUES (${user}, '777', 'run', 5000, 1368), (${user}, '666', 'run', 5000, 1300), (${user}, '777', 'run', 1000, 266)`;
  for (let i = 0; i < 21; i++) {
    const d = new Date(Date.parse('2026-10-11T12:00:00Z') + i * 86_400_000).toISOString().slice(0, 10);
    await sql`INSERT INTO daily_training_load (id, user_id, date, tss, ctl, atl, tsb) VALUES (${`dtl_${i}`}, ${user}, ${d}, 60, ${45 + i * 0.4}, 50, ${-3 + i * 0.5})`;
  }

  const a = await runDataTool(user, today, 'get_activity', { ref: '777' });
  assert.equal(a.ok, true, a.text);
  if (process.env.SHOW) console.log(a.text);
  assert.match(a.text, /Activity 777: "Afternoon Run"/);
  assert.match(a.text, /^9: 4:28\/km/m);
  assert.match(a.text, /negative split/);
  assert.match(a.text, /5K 23:41/);
  assert.match(a.text, /5 km 22:48 \(4:34\/km\): #2 of 2 in the year before it \(best 21:40 \(4:20\/km\) on 2026-10-01 \(666\)\)/);

  const byDay = await runDataTool(user, today, 'get_activity', { ref: today, sport: 'run' });
  assert.match(byDay.text, /Activity 777/);
  assert.match((await runDataTool(user, today, 'get_activity', { ref: 'nope1' })).text, /No activity nope1/);

  const list = await runDataTool(user, today, 'find_activities', { from: '2026-10-25', sport: 'run' });
  assert.match(list.text, /^777 {2}Sat 2026-10-31 16:22 {2}Run "Afternoon Run"/);
  assert.doesNotMatch(list.text, /Zwift/);

  const bests = await runDataTool(user, today, 'get_bests', {});
  assert.match(bests.text, /5 km: all time 21:40 \(4:20\/km\) 2026-10-01 \(666\)/);

  const load = await runDataTool(user, today, 'get_load', { weeks: 2 });
  assert.match(load.text, /Week of 2026-10-26 \(this week, so far\): TSS 360, 1\.8 h \(ride 1\.0, run 0\.8\)/);
  assert.match(load.text, /Today: CTL 53\.0/);

  // The Strava tests expect at most one connection.
  await sql`DELETE FROM strava_activities WHERE user_id = ${user}`;
  await sql`DELETE FROM activity_peaks WHERE user_id = ${user}`;
  await sql`DELETE FROM daily_training_load WHERE user_id = ${user}`;
  await sql`DELETE FROM strava_connections WHERE user_id = ${user}`;
  await sql`DELETE FROM users WHERE id = ${user}`;
});
