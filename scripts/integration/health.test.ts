// Integration test: every page loader (src/lib/health.ts) on a real Postgres with realistic rows. It runs each
// check twice: with node-postgres's Date objects, and with times as Postgres text ('…+00'), the shape Neon's HTTP
// driver gives raw `sql`. The 2026-10-19 outage needed that text shape; hand-written test objects never had it.
//
// Needs DATABASE_URL to a database built by npm run db:migrate, and DATABASE_DRIVER=pg.
// Run: npm run test:integration  (CI: .github/workflows/web.yml)
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { runChecks } from '@/lib/health';
import { addDays, mondayOf, todayIn } from '@/lib/plan/week.mjs';

const url = process.env.DATABASE_URL;
if (!url || process.env.DATABASE_DRIVER !== 'pg') throw new Error('Set DATABASE_URL and DATABASE_DRIVER=pg');
process.env.HOME_TOKEN ??= 'integration-home-token';
process.env.LIFT_SYNC_TOKEN ??= 'integration-lift-token';

const TIME_TYPES = [1082, 1114, 1184]; // date, timestamp, timestamptz
const client = new pg.Client({ connectionString: url });
const today = todayIn('America/Los_Angeles');
const monday = mondayOf(today);
const id = () => crypto.randomUUID();

async function seed() {
  const q = (text: string, values: unknown[] = []) => client.query(text, values);
  await q(`INSERT INTO users (id, email) VALUES ('user_owner', 'owner@example.com')`);
  await q(
    `INSERT INTO garmin_connections (user_id, tokens_ciphertext, status, last_success_at, last_attempt_at, synced_through)
     VALUES ('user_owner', 'v1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'ok', now() - interval '3 hours', now() - interval '3 hours', $1)`,
    [addDays(today, -1)]
  );
  await q(
    `INSERT INTO strava_connections (id, user_id, athlete_id, access_token, refresh_token, expires_at, scope, last_synced_at)
     VALUES ('conn', 'user_owner', 1, 'a', 'r', 0, 'read', now())`
  );
  const types = ['Ride', 'VirtualRide', 'Run', 'Hike', 'WeightTraining', 'Rowing'];
  for (let i = 0; i < 60; i++) {
    await q(
      `INSERT INTO strava_activities (id, user_id, connection_id, strava_activity_id, name, sport_type, start_date, start_date_local, distance, moving_time, tss)
       VALUES ($1, 'user_owner', 'conn', $2, 'Workout', $3, now() - ($4 || ' days')::interval, (now() - ($4 || ' days')::interval)::timestamp, 10000, 3600, 50)`,
      [id(), String(i), types[i % types.length], String(i * 1.4)]
    );
    // Peaks for the rides and runs, so the peak loaders rank real rows.
    const t = types[i % types.length];
    if (t === 'Ride' || t === 'Run') {
      const [metric, span, value] = t === 'Ride' ? ['power', 300, 250 + (i % 7) * 5] : ['run', 5000, 1500 + (i % 5) * 20];
      await q(`INSERT INTO activity_peaks (user_id, strava_activity_id, metric, span, value) VALUES ('user_owner', $1, $2, $3, $4)`, [String(i), metric, span, value]);
    }
  }
  for (let i = 0; i < 90; i++) {
    await q(`INSERT INTO daily_training_load (id, user_id, date, ctl, atl, tsb, tss) VALUES ($1, 'user_owner', $2, 60, 55, 5, 70)`, [id(), addDays(today, -i)]);
  }
  for (const week of [addDays(monday, -7), monday, addDays(monday, 7)]) {
    const plan = id();
    await q(
      `INSERT INTO training_plans (id, user_id, week_start_date, week_end_date, plan_content, ai_model, status)
       VALUES ($1, 'user_owner', $2, $3, '', 'test', 'active')`,
      [plan, week, addDays(week, 6)]
    );
    for (const [d, type, title] of [[0, 'strength', 'Heavy lift'], [1, 'run', 'Easy run'], [5, 'ride', 'Long ride'], [6, 'rest', 'Rest day']] as const) {
      await q(
        `INSERT INTO training_plan_activities (id, plan_id, activity_type, title, scheduled_date, duration, tss)
         VALUES ($1, $2, $3, $4, $5, 60, 50)`,
        [id(), plan, type, title, addDays(week, d)]
      );
    }
  }
  await q(
    `INSERT INTO calendar_connections (id, user_id, google_email, access_token, refresh_token, token_expires_at, google_account_id, scope, last_synced_at, is_active)
     VALUES ('cal', 'user_owner', 'owner@example.com', 'a', 'r', now(), 'g', 's', now(), true)`
  );
  const session = id();
  const exercise = id();
  const slot = id();
  const rows: [string, string, Record<string, unknown>][] = [
    ['exercise', exercise, { id: exercise, name: 'Back squat' }],
    ['session', session, { id: session, day: addDays(today, -1), title: 'Lower A', startedAt: `${addDays(today, -1)}T17:00:00Z`, unitsAtLog: 'kg' }],
    ['sessionExercise', slot, { id: slot, sessionID: session, exerciseID: exercise, displayName: 'Back squat', position: 0 }],
  ];
  // A malformed day from an older app build: it must drop the session, not break the pages.
  const odd = id();
  rows.push(['session', odd, { id: odd, day: `${addDays(today, -2)}T00:00`, title: 'Odd day' }]);
  for (let s = 0; s < 3; s++) {
    const set = id();
    rows.push(['set', set, { id: set, sessionExerciseID: slot, position: s, kind: 'working', status: 'done', actualReps: 5, actualWeight: 100, unit: 'kg' }]);
  }
  // updated_at is timestamptz: the column whose '…+00' text broke the site on 2026-10-19.
  for (const [entity, rowId, payload] of rows) {
    await q(`INSERT INTO lift_rows (entity, id, payload, updated_at) VALUES ($1, $2, $3, now())`, [entity, rowId, JSON.stringify(payload)]);
  }
}

before(async () => {
  await client.connect();
  await seed();
});
after(async () => {
  for (const oid of TIME_TYPES) pg.types.setTypeParser(oid, pg.types.getTypeParser(oid));
  await client.end();
});

async function assertAllPass(label: string) {
  const checks = await runChecks();
  const failed = checks.filter((c) => !c.ok);
  assert.deepEqual(failed, [], `${label}: ${failed.map((c) => `${c.name}: ${c.error}`).join('; ')}`);
  assert.ok(checks.some((c) => c.name === '/api/home'), 'the /api/home check ran');
  assert.ok(checks.some((c) => c.name === '/api/lift/week'), 'the /api/lift/week check ran');
}

test('every page loader works when Postgres times arrive as Date objects', () => assertAllPass('Date objects'));

test('every page loader works when Postgres times arrive as text (Neon HTTP)', async () => {
  for (const oid of TIME_TYPES) pg.types.setTypeParser(oid, (text: string) => text);
  await assertAllPass('text times');
});
