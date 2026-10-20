// TSS recompute and the training-load rebuild on a real Postgres: the batched UPDATE ... FROM unnest and
// INSERT ... SELECT unnest statements, which the unit tests cannot run. Needs DATABASE_URL and DATABASE_DRIVER=pg.
// The files run one at a time (test:integration), after health.test.ts, so its owner is the first user.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { recomputeAllTss, storeActivityTss } from '@/lib/strava-sync/thresholds.mjs';
import { rebuildTrainingLoad } from '@/lib/strava-sync/sync.mjs';

const user = 'user_tss';

test('recomputeAllTss and rebuildTrainingLoad write in one statement each', async () => {
  await sql`DELETE FROM strava_activities WHERE user_id = ${user}`;
  await sql`DELETE FROM daily_training_load WHERE user_id = ${user}`;
  await sql`DELETE FROM users WHERE id = ${user}`;
  await sql`INSERT INTO users (id, email, settings) VALUES (${user}, 'tss@example.com', ${JSON.stringify({ thresholds: { runLthr: 170, restingHr: 45 } })}::jsonb)`;
  await sql`INSERT INTO strava_connections (id, user_id, athlete_id, access_token, refresh_token, expires_at, scope)
            VALUES ('conn_tss', ${user}, 999, 'a', 'r', 0, 's') ON CONFLICT DO NOTHING`;
  const days = [-20, -10, -3, -1];
  for (const [i, d] of days.entries()) {
    await sql`
      INSERT INTO strava_activities (id, user_id, connection_id, strava_activity_id, name, type, sport_type, moving_time, elapsed_time,
        average_heartrate, start_date, start_date_local, tss, tss_method)
      VALUES (${`act_tss_${i}`}, ${user}, 'conn_tss', ${`9${i}`}, 'Run', 'Run', 'Run', 3600, 3600, ${140 + i * 5},
        NOW() + ${`${d} days`}::interval, NOW() + ${`${d} days`}::interval, 1, 'hr')`;
  }
  // One activity with a heart-rate stream: its summary is made on the recompute.
  await sql`INSERT INTO strava_activity_streams (id, activity_id, stream_type, data) VALUES
    ('st_tss_t', 'act_tss_0', 'time', ${JSON.stringify([...Array(600).keys()])}::jsonb),
    ('st_tss_h', 'act_tss_0', 'heartrate', ${JSON.stringify(Array(600).fill(150))}::jsonb)`;

  const dry = await recomputeAllTss(sql, user, { dryRun: true });
  assert.equal(dry.changed, 4);
  const [still] = await sql`SELECT tss FROM strava_activities WHERE id = 'act_tss_1'`;
  assert.equal(Number(still.tss), 1, 'a dry run writes nothing');

  const r = await recomputeAllTss(sql, user);
  assert.equal(r.thresholds.runLthr.value, 170);
  assert.equal(r.thresholds.runLthr.source, 'settings');
  const rows = await sql`SELECT id, tss, tss_method, tss_inputs FROM strava_activities WHERE user_id = ${user} ORDER BY id`;
  assert.equal(rows[0].tss_method, 'hr_stream');
  assert.ok(rows[0].tss_inputs?.hr, 'the summary is stored');
  assert.ok(rows.slice(1).every((x) => x.tss_method === 'hr' && Number(x.tss) > 40), JSON.stringify(rows));

  await rebuildTrainingLoad(sql, user, () => {});
  const load = await sql`SELECT date, tss, ctl, atl FROM daily_training_load WHERE user_id = ${user} ORDER BY date`;
  assert.ok(load.length >= 20, String(load.length));
  assert.ok(Number(load.at(-1)?.ctl) > 0);
  // A second rebuild updates the same rows.
  await rebuildTrainingLoad(sql, user, () => {});
  const again = await sql`SELECT count(*)::int AS n FROM daily_training_load WHERE user_id = ${user}`;
  assert.equal(again[0].n, load.length);

  const one = await storeActivityTss(sql, 'act_tss_0', { runLthr: 160, restingHr: 45 });
  assert.equal(one?.method, 'hr_stream');

  // Leave the database as health.test.ts expects it: one user, one Strava connection.
  await sql`DELETE FROM strava_activities WHERE user_id = ${user}`;
  await sql`DELETE FROM daily_training_load WHERE user_id = ${user}`;
  await sql`DELETE FROM strava_connections WHERE id = 'conn_tss'`;
  await sql`DELETE FROM users WHERE id = ${user}`;
});
