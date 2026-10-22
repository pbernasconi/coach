// ingestActivity (the Strava webhook) and fillMissingParts (the cron) on a real Postgres, with Strava, Open-Meteo
// and Nominatim replaced by a stub: one webhook event stores the whole activity (row, detail, laps, streams,
// weather, TSS, training load) with two Strava calls; an edit costs one call; the fill job completes an older
// activity that has only its summary row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { ingestActivity } from '@/lib/strava-sync/ingest.mjs';
import { fillMissingParts, missingParts } from '@/lib/activity/fetch.mjs';

const user = 'user_ingest';
const n = 1800;
const seconds = Array.from({ length: n }, (_, i) => i);

const detail = (id: number, name: string) => ({
  id, name, type: 'Run', sport_type: 'Run', distance: 6000, moving_time: n, elapsed_time: n + 30, total_elevation_gain: 40,
  start_date: '2026-10-22T18:45:00Z', start_date_local: '2026-10-22T11:45:00Z', timezone: '(GMT-08:00) America/Los_Angeles',
  average_speed: 3.3, max_speed: 4.1, average_heartrate: 152, max_heartrate: 173, start_latlng: [37.77, -122.43],
  description: 'easy', calories: 766, suffer_score: 20, device_name: 'Garmin fēnix 7 Pro',
  laps: [{ name: 'Lap 1', distance: 6000, moving_time: n, elapsed_time: n, average_speed: 3.3 }],
  splits_metric: [{ distance: 1000, moving_time: 300, elapsed_time: 300, average_speed: 3.3, average_grade_adjusted_speed: 3.4 }],
});

test('a webhook event stores the whole activity; an edit makes one call; the fill job completes an older activity', async () => {
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  let name = 'Lunch Run';
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.includes('open-meteo')) return json({ hourly: { time: ['2026-10-22T18:00', '2026-10-22T19:00'], temperature_2m: [16, 17], weather_code: [1, 1] } });
    if (url.includes('nominatim')) return json({ address: { city: 'San Francisco', state: 'California', country: 'United States' } });
    const m = url.match(/activities\/(\d+)(\/streams)?/);
    if (!m) throw new Error(`unexpected call ${url}`);
    if (m[2]) {
      return json({ time: { data: seconds }, heartrate: { data: seconds.map((i) => (i < 600 ? 140 : 160)) },
                    velocity_smooth: { data: seconds.map(() => 3.3) }, grade_smooth: { data: seconds.map(() => 0) },
                    distance: { data: seconds.map((i) => i * 3.3) } });
    }
    return json(detail(Number(m[1]), m[1] === '901' ? name : 'Morning Run'));
  }) as typeof fetch;
  globalThis.fetch = fetchImpl;
  try {
    const others = await sql`SELECT id FROM strava_connections`;
    assert.equal(others.length <= 1, true);
    await sql`DELETE FROM strava_connections`;
    await sql`DELETE FROM users WHERE id = ${user}`;
    await sql`INSERT INTO users (id, email, settings) VALUES (${user}, 'ingest@example.com', '{"thresholds": {"restingHr": 42, "runPaceS": 288}}'::jsonb)`;
    await sql`INSERT INTO strava_connections (id, user_id, athlete_id, access_token, refresh_token, expires_at, scope, is_active)
              VALUES ('conn_ingest', ${user}, 4343, 'token', 'refresh', ${Math.floor(Date.now() / 1000) + 3600}, 'read', true)`;

    // A new activity: two Strava calls, everything stored.
    const r = await ingestActivity(sql, 901, { streams: 'always', fetchImpl, log: () => {} });
    assert.equal(r.created, true);
    assert.deepEqual([...r.parts].sort(), ['detail', 'streams', 'weather']);
    assert.equal(calls.filter((u) => u.includes('strava.com')).length, 2, 'detail and streams only');
    const [a] = await sql`SELECT id, name, tss, tss_method, zone_times FROM strava_activities WHERE strava_activity_id = '901'`;
    assert.equal(a.name, 'Lunch Run');
    assert.equal(a.tss_method, 'pace', 'TSS from the streams');
    assert.ok(Number(a.tss) > 0);
    assert.deepEqual(await missingParts(sql, a.id), { detail: false, streams: false, weather: false, retryLater: false });
    const [d] = await sql`SELECT calories, place, weather FROM strava_activity_details WHERE activity_id = ${a.id}`;
    assert.equal(Number(d.calories), 766);
    assert.equal(d.place, 'San Francisco, United States');
    assert.ok(d.weather, 'weather stored');
    const [load] = await sql`SELECT tss FROM daily_training_load WHERE user_id = ${user} AND date = '2026-10-22'`;
    assert.equal(Number(load.tss), Number(a.tss), 'the training load has it');

    // An edit (a rename): one Strava call, no second row, no new streams or weather.
    calls.length = 0;
    name = 'Lunch Run (easy)';
    const edit = await ingestActivity(sql, 901, { streams: 'missing', fetchImpl, log: () => {} });
    assert.equal(edit.created, false);
    assert.deepEqual(calls.filter((u) => u.includes('strava.com')).length, 1);
    assert.equal(calls.some((u) => u.includes('open-meteo')), false);
    const rows = await sql`SELECT name FROM strava_activities WHERE strava_activity_id = '901'`;
    assert.deepEqual(rows.map((x) => x.name), ['Lunch Run (easy)']);

    // An older activity with only its summary row: the fill job completes it.
    await sql`INSERT INTO strava_activities (id, user_id, connection_id, strava_activity_id, name, type, sport_type, moving_time, start_date, start_date_local, start_latlng)
              VALUES ('row_old', ${user}, 'conn_ingest', '902', 'Morning Run', 'Run', 'Run', ${n}, '2026-10-01 15:00:00', '2026-10-01 08:00:00', '[37.77, -122.43]'::jsonb)`;
    assert.equal((await missingParts(sql, 'row_old')).detail, true);
    const filled = await fillMissingParts(sql, { limit: 5, allowTokenRefresh: false, fetchImpl });
    assert.equal(filled.filled, 1);
    assert.deepEqual(await missingParts(sql, 'row_old'), { detail: false, streams: false, weather: false, retryLater: false });
    const again = await fillMissingParts(sql, { limit: 5, allowTokenRefresh: false, fetchImpl });
    assert.deepEqual({ filled: again.filled, left: again.left }, { filled: 0, left: 0 }, 'nothing left to fill');
  } finally {
    globalThis.fetch = realFetch;
    await sql`DELETE FROM strava_activities WHERE user_id = ${user}`;
    await sql`DELETE FROM daily_training_load WHERE user_id = ${user}`;
    await sql`DELETE FROM activity_peaks WHERE user_id = ${user}`;
    await sql`DELETE FROM activity_peak_scans WHERE user_id = ${user}`;
    await sql`DELETE FROM strava_connections WHERE id = 'conn_ingest'`;
    await sql`DELETE FROM users WHERE id = ${user}`;
  }
});
