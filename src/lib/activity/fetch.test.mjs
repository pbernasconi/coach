import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchActivityParts, refreshAllowed } from './fetch.mjs';

/** A fake tagged-template sql: answers by the first pattern that matches the query text, and logs every query. */
function fakeSql(answers) {
  const log = [];
  const sql = (strings, ...values) => {
    const text = strings.join('?');
    log.push({ text, values });
    for (const [re, rows] of answers) if (re.test(text)) return Promise.resolve(typeof rows === 'function' ? rows(values) : rows);
    return Promise.resolve([]);
  };
  return { sql, log };
}

const activity = { id: 'a1', user_id: 'u1', strava_activity_id: '123', start_date: '2026-10-13 21:34:25', start_latlng: [36.05, 138.11] };
const missing = { start_latlng: [36.05, 138.11], trainer: false, sport_type: 'Run', detail_fetched_at: null, streams_fetched_at: null, weather_fetched_at: null, fetch_error: null, updated_at: null, has_streams: false };

test('refreshAllowed: only production or an explicit opt-in', () => {
  assert.equal(refreshAllowed({ VERCEL_ENV: 'production' }), true);
  assert.equal(refreshAllowed({ VERCEL_ENV: 'preview' }), false);
  assert.equal(refreshAllowed({}), false);
  assert.equal(refreshAllowed({ STRAVA_ALLOW_REFRESH: '1' }), true);
});

test('an expired token with refresh off: no Strava call and no token refresh, weather still loads', async () => {
  const { sql } = fakeSql([
    [/FROM strava_activities a LEFT JOIN strava_activity_details/, [missing]],
    [/SELECT access_token, expires_at FROM strava_connections/, [{ access_token: 'old', expires_at: Math.floor(Date.now() / 1000) - 10 }]],
    [/to_char\(start_date/, [{ start_iso: '2026-10-13T21:34:25Z' }]],
    [/FROM strava_activities WHERE id/, [activity]],
  ]);
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    if (String(url).includes('open-meteo')) {
      return new Response(JSON.stringify({ hourly: { time: ['2026-10-13T22:00'], temperature_2m: [15], weather_code: [1] } }));
    }
    return new Response(JSON.stringify({ address: { city: 'Suwa', country: 'Japan' } }));
  };
  const out = await fetchActivityParts(sql, 'a1', { env: {}, fetchImpl });
  assert.equal(out.skipped, 'token expired, refresh off');
  assert.deepEqual(out.fetched, ['weather']);
  assert.ok(urls.every((u) => !u.includes('strava.com')), urls.join('\n'));
});

test('a valid token: detail and streams are fetched with it and stored', async () => {
  const { sql, log } = fakeSql([
    [/FROM strava_activities a LEFT JOIN strava_activity_details/, [{ ...missing, weather_fetched_at: '2026-10-14 00:00:00' }]],
    [/SELECT access_token, expires_at FROM strava_connections/, [{ access_token: 'tok', expires_at: Math.floor(Date.now() / 1000) + 3600 }]],
    [/SELECT hr_zones FROM strava_athlete_profile/, [{ hr_zones: { zones: [{ min: 0, max: 140 }, { min: 140, max: -1 }] } }]],
    [/FROM strava_activities WHERE id/, [activity]],
  ]);
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push([String(url), init?.headers?.Authorization]);
    if (String(url).includes('/streams')) {
      return new Response(JSON.stringify({ time: { data: [0, 1, 2] }, heartrate: { data: [130, 150, 150] } }));
    }
    return new Response(JSON.stringify({ id: 123, device_name: 'Garmin', calories: 900, gear: { id: 'g1', name: 'Shoe', distance: 1000 }, start_date: '2026-10-13T21:34:25Z', start_date_local: '2026-10-14T06:34:25Z' }));
  };
  const out = await fetchActivityParts(sql, 'a1', { env: {}, fetchImpl });
  assert.equal(out.error, null);
  assert.deepEqual(out.fetched, ['detail', 'streams']);
  assert.ok(seen.every(([, auth]) => auth === 'Bearer tok'));
  assert.ok(!seen.some(([u]) => u.includes('oauth')));
  const times = log.find((q) => /start_date_local = COALESCE/.test(q.text));
  assert.ok(times.values.includes('2026-10-14T06:34:25'), 'the local start is stored as Strava wrote it');
  const zones = log.find((q) => /SET zone_times/.test(q.text));
  assert.deepEqual(JSON.parse(zones.values[0]), { z1: 1, z2: 2 });
});

test('a Strava error is stored, not thrown', async () => {
  const { sql, log } = fakeSql([
    [/FROM strava_activities a LEFT JOIN strava_activity_details/, [{ ...missing, weather_fetched_at: 'x' }]],
    [/SELECT access_token, expires_at FROM strava_connections/, [{ access_token: 'tok', expires_at: Math.floor(Date.now() / 1000) + 3600 }]],
    [/FROM strava_activities WHERE id/, [activity]],
  ]);
  const out = await fetchActivityParts(sql, 'a1', { env: {}, fetchImpl: async () => new Response('limit', { status: 429 }) });
  assert.match(out.error, /429/);
  assert.ok(log.some((q) => /SET fetch_error/.test(q.text)));
});
