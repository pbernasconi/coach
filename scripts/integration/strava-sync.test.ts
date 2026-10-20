// syncStrava and deleteStravaActivity on a real Postgres, with Strava's API replaced by a stub: a new activity gets
// its detail (laps with grade-adjusted pace) and its streams, a TSS from the streams, and the training load; a
// delete removes it and rebuilds the load. Runs after health.test.ts (the files run one at a time).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { deleteStravaActivity, syncStrava } from '@/lib/strava-sync/sync.mjs';

const user = 'user_strava';
const n = 1800;
const seconds = Array.from({ length: n }, (_, i) => i);

function stravaStub(url: string): unknown {
  if (url.endsWith('/athlete')) return { id: 4242, sex: 'M', weight: 70, ftp: 280 };
  if (url.endsWith('/athlete/zones')) return { heart_rate: { zones: [{ min: 0, max: 122 }, { min: 122, max: 153 }, { min: 153, max: 168 }, { min: 168, max: 182 }, { min: 182, max: -1 }] } };
  if (url.includes('/athlete/activities')) {
    return url.includes('page=1')
      ? [{ id: 777, name: 'Tempo', type: 'Run', sport_type: 'Run', distance: 6000, moving_time: n, elapsed_time: n,
           start_date: '2026-10-18T15:00:00Z', start_date_local: '2026-10-18T08:00:00Z', average_heartrate: 158, average_speed: 3.3 }]
      : [];
  }
  if (url.includes('/activities/777/streams')) {
    return { time: { data: seconds }, heartrate: { data: seconds.map((i) => (i < 600 ? 140 : 166)) },
             velocity_smooth: { data: seconds.map(() => 3.3) }, grade_smooth: { data: seconds.map(() => 0) } };
  }
  if (url.includes('/activities/777')) {
    return { id: 777, description: 'tempo', start_date: '2026-10-18T15:00:00Z', start_date_local: '2026-10-18T08:00:00Z',
             laps: [{ name: 'Lap 1', distance: 6000, moving_time: n, elapsed_time: n, average_speed: 3.3 }],
             splits_metric: [{ distance: 1000, moving_time: 300, elapsed_time: 300, average_speed: 3.3, average_grade_adjusted_speed: 3.4 }] };
  }
  throw new Error(`unexpected Strava call ${url}`);
}

test('a new activity gets detail, streams, a TSS from the streams and the training load; a delete rebuilds the load', async () => {
  const realFetch = globalThis.fetch;
  let deleted = false;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/activities/777') && !url.includes('streams') && deleted) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify(stravaStub(url)), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    // The sync reads the first connection: this test's must be the only one.
    const others = await sql`SELECT id FROM strava_connections`;
    assert.equal(others.length <= 1, true);
    await sql`DELETE FROM strava_connections`;
    await sql`DELETE FROM users WHERE id = ${user}`;
    await sql`INSERT INTO users (id, email, settings) VALUES (${user}, 'strava@example.com', '{"thresholds": {"restingHr": 42, "runPaceS": 288}}'::jsonb)`;
    await sql`INSERT INTO strava_connections (id, user_id, athlete_id, access_token, refresh_token, expires_at, scope, is_active)
              VALUES ('conn_strava', ${user}, 4242, 'token', 'refresh', ${Math.floor(Date.now() / 1000) + 3600}, 'read', true)`;

    const r = await syncStrava(sql, { days: 30, detailed: true, streams: 'new', waitOnRateLimit: false, log: () => {}, warn: (...a: unknown[]) => { throw new Error(a.join(' ')); } });
    assert.deepEqual({ upserted: r.upserted, detailed: r.detailed, streams: r.streams }, { upserted: 1, detailed: 1, streams: 1 });

    const [a] = await sql`SELECT id, tss, tss_method, tss_inputs, zone_times FROM strava_activities WHERE strava_activity_id = '777'`;
    assert.equal(a.tss_method, 'pace', 'a run with streams and a threshold pace uses pace');
    assert.ok(a.tss_inputs?.hr && a.tss_inputs?.ngs, 'the stream summary is stored');
    assert.ok(a.zone_times, 'zone times come from the stream');
    const [split] = await sql`SELECT average_grade_adjusted_speed FROM strava_activity_splits WHERE activity_id = ${a.id}`;
    assert.equal(Number(split.average_grade_adjusted_speed), 3.4, 'splits keep grade-adjusted pace');
    const [{ fetched }] = await sql`SELECT streams_fetched_at IS NOT NULL AS fetched FROM strava_activity_details WHERE activity_id = ${a.id}`;
    assert.equal(fetched, true);
    const [load] = await sql`SELECT tss FROM daily_training_load WHERE user_id = ${user} AND date = '2026-10-18'`;
    assert.equal(Number(load.tss), Number(a.tss));

    // A second sync does not fetch the streams again.
    const again = await syncStrava(sql, { days: 30, detailed: false, streams: 'new', waitOnRateLimit: false, log: () => {} });
    assert.equal(again.streams, 0);
    const [same] = await sql`SELECT tss_method FROM strava_activities WHERE id = ${a.id}`;
    assert.equal(same.tss_method, 'pace', 'the stored summary keeps the stream TSS');

    deleted = true;
    assert.equal(await deleteStravaActivity(sql, 777), true);
    const [after] = await sql`SELECT coalesce(sum(tss), 0) AS tss FROM daily_training_load WHERE user_id = ${user} AND date = '2026-10-18'`;
    assert.equal(Number(after.tss), 0, 'the deleted TSS leaves the load at once');
  } finally {
    globalThis.fetch = realFetch;
    await sql`DELETE FROM strava_activities WHERE user_id = ${user}`;
    await sql`DELETE FROM daily_training_load WHERE user_id = ${user}`;
    await sql`DELETE FROM strava_athlete_profile WHERE user_id = ${user}`;
    await sql`DELETE FROM strava_connections WHERE id = 'conn_strava'`;
    await sql`DELETE FROM users WHERE id = ${user}`;
  }
});
