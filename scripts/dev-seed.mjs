#!/usr/bin/env node
// Fills a LOCAL Postgres with realistic synthetic data for one athlete, so every page has something to show:
// Strava activities (with laps, splits and streams for the newest ones), training load, peaks, a plan around today,
// workout feedback, vitals, labs, DEXA scans, Lift sessions, goals, an event and connected-account rows (fake tokens).
//
//   DATABASE_URL=postgres://postgres:postgres@localhost:5432/coach_dev node scripts/dev-seed.mjs [--today YYYY-MM-DD]
//
// It refuses any DATABASE_URL whose host is not localhost or 127.0.0.1, and it replaces the owner's data each run.
// Run `npm run db:migrate` (with DATABASE_DRIVER=pg) on the database first.
import pg from 'pg';
import { createHash } from 'node:crypto';
import { importPlan } from '../src/lib/plan/import.mjs';
import { loadSeries } from '../src/lib/strava-sync/load.mjs';
import { fullScan, storedDerived } from '../src/lib/vitals/dexa.mjs';
import { toScanRow } from '../src/lib/vitals/bodyspec.mjs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('dev-seed: DATABASE_URL is not set');
  process.exit(2);
}
const host = new URL(url).hostname;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
  console.error(`dev-seed: refusing to seed ${host}: only a local Postgres (localhost) is allowed`);
  process.exit(2);
}
const argToday = process.argv.includes('--today') ? process.argv[process.argv.indexOf('--today') + 1] : null;
const TZ = 'America/Los_Angeles';
const TODAY = argToday ?? new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const DAYS = 120;

const pool = new pg.Pool({ connectionString: url, max: 2 });
const q = (text, params = []) => pool.query(text, params).then((r) => r.rows);
/** A Neon-style tagged template over the pool, for the app's own helpers (importPlan). */
const sql = (strings, ...values) => q(strings.reduce((t, s, i) => t + s + (i < values.length ? `$${i + 1}` : ''), ''), values);

// Deterministic randomness, so two runs give the same data.
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const between = (a, b) => a + (b - a) * rnd();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 0.8;
const round = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;
const uuid = (key) => {
  const h = createHash('sha1').update(key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const cid = (key) => 'c' + createHash('sha1').update(key).digest('hex').slice(0, 23);

const addDays = (day, n) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (day) => new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
const mondayOf = (day) => addDays(day, -((weekday(day) + 6) % 7));
/** UTC instant for a local wall time in Los Angeles (PDT -7 / PST -8). */
const utcOf = (day, hh, mm = 0) => {
  const guess = new Date(`${day}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);
  const local = new Date(guess.toLocaleString('en-US', { timeZone: TZ }));
  return new Date(guess.getTime() + (guess.getTime() - local.getTime()));
};

async function main() {
  // ---------- owner ----------
  let [owner] = await q('SELECT id FROM users ORDER BY created_at LIMIT 1');
  if (!owner) {
    await q(
      `INSERT INTO users (id, email, first_name, last_name, full_name, timezone, settings, created_at)
       VALUES ('user_dev_owner', 'paolo@example.com', 'Paolo', 'Bernasconi', 'Paolo Bernasconi', $1, $2, now() - interval '2 years')`,
      [TZ, JSON.stringify({ targets: { runKm: 35, rideHours: 4, strength: 2 } })]
    );
    [owner] = await q('SELECT id FROM users ORDER BY created_at LIMIT 1');
  }
  const U = owner.id;
  const settings = {
    targets: { runKm: 35, rideHours: 4, strength: 2 },
    goals: [
      { id: 'g-10k', kind: 'run_10k_pace', title: '10k at 3:40/km', target: 220, baseline: 236, start: addDays(TODAY, -90), deadline: addDays(TODAY, 34) },
      { id: 'g-vo2', kind: 'vo2max', title: 'VO2 max 58', target: 58, baseline: 55, start: addDays(TODAY, -120), deadline: addDays(TODAY, 70) },
      { id: 'g-ride', kind: 'ride_km', title: '6,000 km ridden this year', target: 6000, baseline: 0, start: '2026-01-01', deadline: '2026-12-31' },
    ],
  };
  await q(`UPDATE users SET timezone = $2, settings = $3 WHERE id = $1`, [U, TZ, JSON.stringify(settings)]);
  console.log(`owner ${U}, today ${TODAY}`);

  // ---------- wipe the owner's data ----------
  const wipe = [
    'DELETE FROM strava_activities WHERE user_id = $1',
    'DELETE FROM strava_connections WHERE user_id = $1',
    'DELETE FROM strava_gear WHERE user_id = $1',
    'DELETE FROM strava_athlete_profile WHERE user_id = $1',
    'DELETE FROM daily_training_load WHERE user_id = $1',
    'DELETE FROM activity_peaks WHERE user_id = $1',
    'DELETE FROM activity_peak_scans WHERE user_id = $1',
    'DELETE FROM training_plans WHERE user_id = $1',
    'DELETE FROM workout_feedback WHERE user_id = $1',
    'DELETE FROM health_samples WHERE user_id = $1',
    'DELETE FROM garmin_raw WHERE user_id = $1',
    'DELETE FROM garmin_activities WHERE user_id = $1',
    'DELETE FROM garmin_connections WHERE user_id = $1',
    'DELETE FROM lab_results WHERE user_id = $1',
    'DELETE FROM lab_biomarkers WHERE user_id = $1',
    'DELETE FROM lab_categories WHERE user_id = $1',
    'DELETE FROM lab_planned_draws WHERE user_id = $1',
    'DELETE FROM clinician_notes WHERE user_id = $1',
    'DELETE FROM dexa_scans WHERE user_id = $1',
    'DELETE FROM bodyspec_connections WHERE user_id = $1',
    'DELETE FROM user_goals WHERE user_id = $1',
    'DELETE FROM events WHERE user_id = $1',
    'DELETE FROM calendar_connections WHERE user_id = $1',
    'DELETE FROM plan_proposals WHERE user_id = $1',
  ];
  for (const w of wipe) await q(w, [U]);
  await q('DELETE FROM lift_rows');

  // ---------- connections ----------
  const conn = cid('strava-conn');
  await q(
    `INSERT INTO strava_connections (id, user_id, athlete_id, access_token, refresh_token, expires_at, scope, last_synced_at)
     VALUES ($1, $2, 1234567, 'dev-fake-access', 'dev-fake-refresh', $3, 'read,activity:read_all,profile:read_all', now() - interval '25 minutes')`,
    [conn, U, Math.floor(Date.now() / 1000) + 10 * 365 * 86400]
  );
  await q(
    `INSERT INTO strava_athlete_profile (athlete_id, user_id, sex, weight_kg, ftp, hr_zones, power_zones, threshold_hr, max_hr)
     VALUES (1234567, $1, 'M', 74.2, 268, $2, $3, 172, 189)`,
    [
      U,
      JSON.stringify({ custom_zones: true, zones: [{ min: 0, max: 124 }, { min: 124, max: 145 }, { min: 145, max: 160 }, { min: 160, max: 172 }, { min: 172, max: -1 }] }),
      JSON.stringify({ zones: [{ min: 0, max: 147 }, { min: 148, max: 201 }, { min: 202, max: 241 }, { min: 242, max: 281 }, { min: 282, max: 322 }, { min: 323, max: 402 }, { min: 403, max: -1 }] }),
    ]
  );
  await q(`INSERT INTO strava_gear (id, user_id, name, distance, retired) VALUES ('g1001', $1, 'Nike Pegasus 41', 612000, false), ('g1002', $1, 'Saucony Endorphin Speed 4', 218000, false), ('b2001', $1, 'Canyon Ultimate CF SLX', 8421000, false), ('b2002', $1, 'Wahoo KICKR (Zwift)', 3120000, false)`, [U]);
  const cal = cid('cal-conn');
  await q(
    `INSERT INTO calendar_connections (id, user_id, google_email, access_token, refresh_token, token_expires_at, google_account_id, scope, last_synced_at)
     VALUES ($1, $2, 'paolo@example.com', 'dev-fake', 'dev-fake', now() + interval '1 hour', 'dev-google-1', 'https://www.googleapis.com/auth/calendar', now() - interval '2 hours')
     ON CONFLICT (google_account_id) DO UPDATE SET user_id = EXCLUDED.user_id`,
    [cal, U]
  );
  await q(
    `INSERT INTO garmin_connections (user_id, tokens_ciphertext, status, last_success_at, last_attempt_at, synced_through)
     VALUES ($1, 'dev-fake', 'ok', now() - interval '40 minutes', now() - interval '40 minutes', $2)`,
    [U, TODAY]
  );
  await q(
    `INSERT INTO bodyspec_connections (user_id, client_id, redirect_uri, access_token, refresh_token, expires_at, scope, status, connected_at, last_attempt_at, last_success_at)
     VALUES ($1, 'dev-client', 'http://localhost:3000/api/auth/bodyspec/callback', 'dev-fake', 'dev-fake', now() + interval '30 days', 'read', 'ok', now() - interval '60 days', now() - interval '6 hours', now() - interval '6 hours')`,
    [U]
  );

  // ---------- activities ----------
  const start = addDays(TODAY, -DAYS + 1);
  const acts = [];
  // Weekly pattern (0 = Sunday): Mon strength + easy, Tue VO2 run, Wed Zwift ride, Thu strength + easy run, Fri rest, Sat long ride, Sun long run.
  for (let i = 0; i < DAYS; i++) {
    const day = addDays(start, i);
    const wd = weekday(day);
    const block = Math.floor(i / 28); // build 3 weeks, recover 1
    const recovery = Math.floor(i / 7) % 4 === 3;
    const scale = (recovery ? 0.7 : 1) * (1 + block * 0.05);
    if (rnd() < 0.07 && day !== TODAY) continue; // the odd missed day
    if (day === TODAY) {
      // Today: one morning easy run already done.
      acts.push({ day, kind: 'easy-run', hh: 7, scale: 1 });
      continue;
    }
    if (wd === 1) acts.push({ day, kind: 'strength', hh: 18, scale }, { day, kind: 'easy-run', hh: 7, scale });
    if (wd === 2) acts.push({ day, kind: 'vo2-run', hh: 7, scale });
    if (wd === 3) acts.push({ day, kind: 'zwift', hh: 18, scale });
    if (wd === 4) acts.push({ day, kind: 'strength', hh: 18, scale }, { day, kind: 'tempo-run', hh: 7, scale });
    if (wd === 6) acts.push({ day, kind: 'long-ride', hh: 8, scale });
    if (wd === 0) acts.push({ day, kind: 'long-run', hh: 8, scale });
  }

  const SF = [37.7694, -122.4862]; // Golden Gate Park
  const rows = [];
  for (const [n, a] of acts.entries()) {
    const id = cid(`act-${a.day}-${a.kind}`);
    const stravaId = String(16_000_000_000 + n * 137);
    const startUtc = utcOf(a.day, a.hh, Math.floor(between(0, 40)));
    const base = { id, stravaId, startUtc, day: a.day, kind: a.kind };
    const fit = 1 + (n / acts.length) * 0.06; // fitter over time
    if (a.kind.endsWith('run')) {
      const spec = {
        'easy-run': { name: 'Easy run', min: 45, pace: 5.45, hr: 138, wt: 0 },
        'vo2-run': { name: 'VO2 intervals 5×3′', min: 55, pace: 4.9, hr: 156, wt: 3 },
        'tempo-run': { name: 'Tempo 3×10′', min: 60, pace: 4.75, hr: 152, wt: 3 },
        'long-run': { name: 'Long run', min: 95, pace: 5.35, hr: 142, wt: 2 },
      }[a.kind];
      const moving = Math.round(spec.min * 60 * a.scale * between(0.9, 1.1));
      const pace = (spec.pace / fit) * between(0.97, 1.03); // min/km
      const speed = 1000 / (pace * 60);
      const hr = spec.hr + gauss() * 3;
      const ifactor = a.kind === 'easy-run' ? 0.72 : a.kind === 'long-run' ? 0.77 : 0.86;
      rows.push({
        ...base,
        name: a.kind === 'long-run' && rnd() < 0.3 ? 'Long run — Presidio loop' : spec.name,
        type: 'Run', sportType: 'Run', distance: round(moving * speed, 1), movingTime: moving, elapsedTime: moving + Math.round(between(30, 300)),
        elevation: round(between(40, a.kind === 'long-run' ? 320 : 120)), averageSpeed: round(speed, 3), maxSpeed: round(speed * 1.35, 3),
        cadence: round(between(84, 89), 1), hr: round(hr, 1), maxHr: Math.round(hr + between(12, 24)), watts: null, np: null,
        workoutType: spec.wt, trainer: false, gear: a.kind === 'vo2-run' ? 'g1002' : 'g1001', latlng: SF,
        tss: round((moving / 3600) * ifactor * ifactor * 100, 1), tssMethod: 'pace', temp: round(between(11, 19)),
      });
    } else if (a.kind === 'zwift' || a.kind === 'long-ride') {
      const zwift = a.kind === 'zwift';
      const moving = Math.round((zwift ? 70 : 180) * 60 * a.scale * between(0.9, 1.1));
      const ftp = 268;
      const avgW = (zwift ? 205 : 178) * fit * between(0.95, 1.05);
      const np = avgW * (zwift ? 1.08 : 1.05);
      const ifactor = np / ftp;
      const speed = zwift ? between(9.2, 10.2) : between(7.6, 8.6);
      rows.push({
        ...base,
        name: zwift ? 'Zwift - Threshold 3×12′ in Watopia' : rnd() < 0.5 ? 'Long ride — Marin Headlands' : 'Long ride — Old La Honda',
        type: zwift ? 'VirtualRide' : 'Ride', sportType: zwift ? 'VirtualRide' : 'Ride', distance: round(moving * speed, 1), movingTime: moving,
        elapsedTime: moving + (zwift ? 20 : Math.round(between(300, 1500))), elevation: round(zwift ? between(200, 600) : between(900, 1900)),
        averageSpeed: round(speed, 3), maxSpeed: round(speed * 1.9, 3), cadence: round(between(84, 92), 1), hr: round((zwift ? 149 : 137) + gauss() * 3, 1),
        maxHr: Math.round(between(165, 178)), watts: round(avgW, 1), np: round(np, 1), workoutType: zwift ? 12 : 10, trainer: zwift,
        gear: zwift ? 'b2002' : 'b2001', latlng: zwift ? null : SF, tss: round((moving / 3600) * ifactor * ifactor * 100, 1), tssMethod: 'power',
        temp: zwift ? null : round(between(12, 22)),
      });
    } else {
      const moving = Math.round(between(50, 70) * 60);
      rows.push({
        ...base, name: weekday(a.day) === 1 ? 'Strength — Lower' : 'Strength — Upper', type: 'WeightTraining', sportType: 'WeightTraining',
        distance: 0, movingTime: moving, elapsedTime: moving + 120, elevation: 0, averageSpeed: 0, maxSpeed: 0, cadence: null,
        hr: round(between(102, 115), 1), maxHr: Math.round(between(140, 155)), watts: null, np: null, workoutType: null, trainer: false,
        gear: null, latlng: null, tss: round((moving / 3600) * 40, 1), tssMethod: 'duration_fallback', temp: null,
      });
    }
  }
  for (const r of rows) {
    const local = new Date(r.startUtc.toLocaleString('en-US', { timeZone: TZ }));
    const localText = `${r.day}T${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}:00`;
    await q(
      `INSERT INTO strava_activities (id, user_id, connection_id, strava_activity_id, name, type, sport_type, distance, moving_time, elapsed_time,
         total_elevation_gain, start_date, start_date_local, timezone, average_speed, max_speed, average_cadence, average_watts, weighted_average_watts,
         max_watts, device_watts, average_heartrate, max_heartrate, kilojoules, average_temp, workout_type, description, commute, trainer, gear_id,
         start_latlng, location_city, location_country, achievement_count, pr_count, suffer_score, tss, tss_method, zone_times, kudos_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,false,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39)`,
      [
        r.id, U, conn, r.stravaId, r.name, r.type, r.sportType, r.distance, r.movingTime, r.elapsedTime, r.elevation, r.startUtc, localText,
        '(GMT-08:00) America/Los_Angeles', r.averageSpeed, r.maxSpeed, r.cadence, r.watts, r.np, r.watts ? Math.round(r.watts * 3.2) : null,
        r.watts ? true : null, r.hr, r.maxHr, r.watts ? round((r.watts * r.movingTime) / 1000, 1) : null, r.temp, r.workoutType,
        rnd() < 0.3 ? 'Felt smooth. RPE 6.' : null, r.trainer, r.gear, r.latlng ? JSON.stringify(r.latlng) : null,
        r.latlng ? 'San Francisco' : null, r.latlng ? 'United States' : null, Math.floor(between(0, 6)), rnd() < 0.15 ? 1 : 0,
        Math.round(r.tss * 0.9), r.tss, r.tssMethod,
        JSON.stringify(zoneTimes(r)), Math.floor(between(2, 25)),
      ]
    );
  }
  console.log(`${rows.length} activities`);

  // Laps, splits, streams and details for the newest 10 outdoor/indoor endurance activities; details for all.
  const endurance = rows.filter((r) => r.type !== 'WeightTraining');
  const detailed = new Set(endurance.slice(-10).map((r) => r.id));
  // Make sure the latest Zwift ride is detailed too.
  const lastZwift = [...rows].reverse().find((r) => r.type === 'VirtualRide');
  if (lastZwift) detailed.add(lastZwift.id);
  for (const r of rows) {
    const withStreams = detailed.has(r.id);
    await q(
      `INSERT INTO strava_activity_details (activity_id, calories, device_name, place, perceived_exertion, best_efforts, segment_efforts, weather,
         detail_fetched_at, streams_fetched_at, weather_fetched_at, summary_polyline, polyline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now(), now(), NULL, NULL)`,
      [
        r.id, Math.round(r.movingTime / 60 * (r.type === 'WeightTraining' ? 6 : 11)), r.trainer ? 'Zwift' : 'Garmin Forerunner 965',
        r.latlng ? 'San Francisco, United States' : null, r.workoutType === 3 ? 7 : null,
        r.type === 'Run' ? JSON.stringify(runBestEfforts(r)) : null, null,
        r.latlng ? JSON.stringify({ source: 'open-meteo', time: r.startUtc.toISOString(), code: 2, tempC: r.temp, feelsLikeC: r.temp - 1, humidityPct: 72, windKmh: 14, windDeg: 280, precipMm: 0 }) : null,
      ]
    );
    if (!withStreams) continue;
    const s = makeStreams(r);
    for (const [type, data] of Object.entries(s.streams)) {
      await q(`INSERT INTO strava_activity_streams (id, activity_id, stream_type, resolution, original_size, data) VALUES ($1,$2,$3,'high',$4,$5)`, [
        cid(`${r.id}-${type}`), r.id, type, data.length, JSON.stringify(data),
      ]);
    }
    for (const [i, lap] of s.laps.entries()) {
      await q(
        `INSERT INTO strava_activity_laps (id, activity_id, lap_index, name, distance, moving_time, elapsed_time, total_elevation_gain, average_speed, max_speed,
           average_cadence, average_watts, average_heartrate, max_heartrate, start_index, end_index, lap_split)
         VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [cid(`${r.id}-lap-${i}`), r.id, i + 1, `Lap ${i + 1}`, lap.distance, lap.time, lap.elev, lap.speed, lap.speed * 1.2, r.cadence, lap.watts, lap.hr, Math.round(lap.hr + 8), lap.start, lap.end, i + 1]
      );
    }
    if (r.type === 'Run') {
      for (const [i, sp] of s.splits.entries()) {
        await q(
          `INSERT INTO strava_activity_splits (id, activity_id, split_index, distance, moving_time, elapsed_time, average_speed, elevation_difference, pace_zone, average_heartrate, average_grade_adjusted_speed)
           VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10)`,
          [cid(`${r.id}-split-${i}`), r.id, i + 1, sp.distance, sp.time, sp.speed, sp.elev, 2, sp.hr, sp.speed * 1.01]
        );
      }
    }
  }

  // ---------- peaks ----------
  for (const r of rows) {
    if (r.type === 'Run') {
      const pace = r.movingTime / r.distance; // s/m
      for (const span of [1000, 5000, 10000, 21097]) {
        if (r.distance < span) continue;
        const factor = span === 1000 ? 0.86 : span === 5000 ? 0.93 : span === 10000 ? 0.97 : 1;
        await q(`INSERT INTO activity_peaks (user_id, strava_activity_id, metric, span, value) VALUES ($1,$2,'run',$3,$4)`, [U, r.stravaId, span, round(span * pace * factor * (r.workoutType === 3 ? 0.95 : 1), 1)]);
      }
    } else if (r.watts) {
      for (const [span, f] of [[5, 3.9], [60, 1.9], [300, 1.38], [1200, 1.14], [3600, 1.0]]) {
        if (r.movingTime < span) continue;
        await q(`INSERT INTO activity_peaks (user_id, strava_activity_id, metric, span, value) VALUES ($1,$2,'power',$3,$4)`, [U, r.stravaId, span, round(r.np * f * between(0.92, 1.03))]);
      }
    }
    await q(`INSERT INTO activity_peak_scans (user_id, strava_activity_id, version, status) VALUES ($1,$2,1,'ok')`, [U, r.stravaId]);
  }

  // ---------- training load ----------
  const tssByDate = new Map();
  for (const r of rows) tssByDate.set(r.day, (tssByDate.get(r.day) ?? 0) + r.tss);
  // A starting fitness: the 6 weeks before the data with a steady 55 TSS a day.
  for (let i = 1; i <= 60; i++) tssByDate.set(addDays(start, -i), 55);
  const series = loadSeries(tssByDate, TODAY);
  for (const d of series) {
    await q(`INSERT INTO daily_training_load (id, user_id, date, tss, ctl, atl, tsb) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [cid(`load-${d.date}`), U, d.date, d.tss, d.ctl, d.atl, d.tsb]);
  }

  // ---------- Lift ----------
  const lift = await seedLift(rows.filter((r) => r.type === 'WeightTraining'));

  // ---------- plan: 5 weeks back, 3 weeks ahead ----------
  const thisMonday = mondayOf(TODAY);
  const actByDay = new Map();
  for (const r of rows) actByDay.set(`${r.day}|${r.type}`, r);
  const planIds = [];
  for (let w = -5; w <= 3; w++) {
    const ws = addDays(thisMonday, w * 7);
    const day = (n) => addDays(ws, n);
    const recovery = w === -2;
    const events = [
      { title: 'Easy run', start: `${day(0)}T07:00`, end: `${day(0)}T07:45`, workoutType: 'run-easy', intensity: 'easy', workout: { bank: 'easy', sport: 'run' }, why: 'Aerobic volume.' },
      { title: 'Strength — Lower', start: `${day(0)}T18:00`, end: `${day(0)}T19:00`, workoutType: 'strength-heavy', intensity: 'moderate', liftTemplate: 'Lower A', tss: 40, why: 'Squat and hinge.' },
      { title: 'VO2 run 5×3′', start: `${day(1)}T07:00`, end: `${day(1)}T07:55`, workoutType: 'run-vo2', intensity: 'hard', workout: { bank: recovery ? 'easy' : 'vo2-a', sport: 'run', level: 1 }, why: 'VO2max stimulus.' },
      { title: 'Zwift threshold 3×12′', start: `${day(2)}T18:00`, end: `${day(2)}T19:10`, workoutType: 'ride-threshold', intensity: 'threshold', workout: { bank: recovery ? 'easy' : 'threshold-a', sport: 'ride', level: 1 }, why: 'FTP work indoors.' },
      { title: 'Tempo run 3×10′', start: `${day(3)}T07:00`, end: `${day(3)}T08:00`, workoutType: 'run-tempo', intensity: 'tempo', workout: { bank: 'tempo', sport: 'run', level: 1 }, why: 'Threshold durability.' },
      { title: 'Strength — Upper', start: `${day(3)}T18:00`, end: `${day(3)}T19:00`, workoutType: 'strength-upper', intensity: 'moderate', liftTemplate: 'Upper A', tss: 35, why: 'Press and pull.' },
      { title: 'Long ride', start: `${day(5)}T08:00`, end: `${day(5)}T11:00`, workoutType: 'ride-long', intensity: 'easy', workout: { bank: 'long', sport: 'ride' }, why: 'Endurance base.' },
      { title: 'Long run', start: `${day(6)}T08:00`, end: `${day(6)}T09:35`, workoutType: 'run-long', intensity: 'easy', workout: { bank: 'long', sport: 'run' }, why: 'Half-marathon endurance.' },
    ];
    const plan = {
      weekStart: ws,
      weekEnd: day(6),
      title: recovery ? 'Recovery week' : w > 0 ? 'Build — half marathon specific' : 'Build week',
      philosophy: 'Polarized: two quality days, the rest easy.',
      events,
      rest: [{ day: day(4), reason: 'Rest before the weekend volume.' }],
    };
    const res = await importPlan(sql, U, plan, `# ${plan.title}\n\nTwo quality sessions, a long ride and a long run.`);
    planIds.push(res.planId);
  }
  // Skip a few past workouts, with reasons; link strength sessions to Lift.
  const past = await q(
    `SELECT a.id, a.scheduled_date::text AS d, a.title, a.activity_type FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
      WHERE p.user_id = $1 AND a.scheduled_date < $2::date ORDER BY a.scheduled_date`,
    [U, TODAY]
  );
  let skipped = 0;
  for (const p of past) {
    const hasRun = actByDay.has(`${p.d.slice(0, 10)}|Run`) || actByDay.has(`${p.d.slice(0, 10)}|Ride`) || actByDay.has(`${p.d.slice(0, 10)}|VirtualRide`);
    if (!hasRun && p.activity_type !== 'rest' && p.activity_type !== 'strength' && skipped < 4) {
      const reason = ['tired', 'busy', 'travel', 'sore'][skipped];
      await q(`UPDATE training_plan_activities SET status = 'skipped', skip_reason = $2, edited_at = now() WHERE id = $1`, [p.id, reason]);
      skipped++;
    }
  }
  for (const [day, sessionId] of lift.byDay) {
    await q(
      `UPDATE training_plan_activities SET lift_session_id = $2 WHERE id = (
         SELECT a.id FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
          WHERE p.user_id = $1 AND a.scheduled_date::date = $3::date AND a.activity_type = 'strength' LIMIT 1)`,
      [U, sessionId, day]
    );
  }
  await q(`UPDATE training_plans SET feel_log = $2 WHERE id = $1`, [planIds[5], JSON.stringify([{ date: addDays(thisMonday, 1), feel: 'good', at: new Date().toISOString() }])]);

  // ---------- workout feedback ----------
  const recentActs = rows.filter((r) => r.day >= addDays(TODAY, -21));
  for (const [i, r] of recentActs.entries()) {
    if (i % 2) continue;
    const hard = r.workoutType === 3 || r.workoutType === 12;
    await q(
      `INSERT INTO workout_feedback (user_id, item, date, title, feel, rpe, comment, source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [U, `strava:${r.stravaId}`, r.day, r.name, hard ? 3 : 4, hard ? 8 : 4, hard ? 'Last rep was a grind.' : i % 4 ? null : 'Legs fresh.', i % 3 ? null : 'watch']
    );
  }

  // ---------- vitals ----------
  const samples = [];
  const put = (date, metric, value, unit, source = 'garmin') => samples.push([date, metric, value, unit, source]);
  let weight = 75.6;
  for (let i = -DAYS + 1; i <= 0; i++) {
    const d = addDays(TODAY, i);
    const t = (i + DAYS) / DAYS;
    const load = tssByDate.get(addDays(d, -1)) ?? 0;
    const hrv = 62 + t * 6 - load / 25 + gauss() * 5;
    put(d, 'hrv_night_avg_ms', round(hrv), 'ms');
    put(d, 'hrv_weekly_avg_ms', round(62 + t * 6 + gauss()), 'ms');
    put(d, 'hrv_baseline_low_ms', 55, 'ms');
    put(d, 'hrv_baseline_high_ms', 74, 'ms');
    put(d, 'hrv_status', hrv < 52 ? 2 : hrv < 56 ? 3 : 4, 'code');
    const rhr = 48 - t * 2 + load / 60 + gauss();
    put(d, 'resting_hr_bpm', round(rhr), 'bpm');
    put(d, 'resting_hr_7d_avg_bpm', round(48 - t * 2 + gauss() * 0.3), 'bpm');
    const sleep = 440 + gauss() * 30;
    put(d, 'sleep_total_min', round(sleep), 'min');
    put(d, 'sleep_deep_min', round(sleep * 0.18), 'min');
    put(d, 'sleep_rem_min', round(sleep * 0.22), 'min');
    put(d, 'sleep_core_min', round(sleep * 0.55), 'min');
    put(d, 'sleep_awake_min', round(between(8, 30)), 'min');
    put(d, 'sleep_awake_count', Math.round(between(1, 5)), 'count');
    put(d, 'sleep_score', Math.round(Math.min(98, 72 + (sleep - 420) / 6 + gauss() * 4)), 'score');
    put(d, 'sleep_avg_hr_bpm', round(rhr + 4), 'bpm');
    put(d, 'sleep_avg_stress', round(between(12, 22)), 'score');
    put(d, 'body_battery_high', Math.round(Math.min(100, 78 + gauss() * 8)), 'score');
    put(d, 'body_battery_low', Math.round(between(12, 30)), 'score');
    put(d, 'stress_avg', Math.round(between(22, 38)), 'score');
    put(d, 'training_readiness', Math.round(Math.max(20, Math.min(95, 70 - load / 4 + gauss() * 8))), 'score');
    put(d, 'readiness_sleep_factor', Math.round(between(60, 95)), '%');
    put(d, 'readiness_hrv_factor', Math.round(between(60, 95)), '%');
    put(d, 'readiness_recovery_time_h', round(load / 6), 'h');
    put(d, 'steps', Math.round(i === 0 ? 6400 : between(7000, 16000)), 'count');
    put(d, 'active_energy_kcal', Math.round(400 + load * 6), 'kcal');
    put(d, 'intensity_minutes_moderate', Math.round(between(10, 50)), 'min');
    put(d, 'intensity_minutes_vigorous', Math.round(load / 2), 'min');
    put(d, 'floors_climbed', Math.round(between(4, 20)), 'floors');
    put(d, 'respiratory_rate', round(between(12.5, 14.5), 1), 'breaths/min');
    put(d, 'spo2_pct', Math.round(between(94, 98)), '%');
    put(d, 'wear_min', 1380, 'min');
    if (i % 3 === 0) put(d, 'vo2max', round(55 + t * 1.5, 1), 'mL/kg/min');
    if (i % 3 === 0) put(d, 'vo2max_cycling', round(56 + t * 1.2, 1), 'mL/kg/min');
    weight += -0.012 + gauss() * 0.15;
    if (rnd() < 0.8) {
      put(d, 'weight_kg', round(weight, 1), 'kg', 'scale');
      put(d, 'body_fat_pct', round(13.8 - t * 0.8 + gauss() * 0.3, 1), '%', 'scale');
    }
    if (i % 7 === 0 || i > -14) {
      put(d, 'training_load_acute', Math.round(520 + gauss() * 60), 'load');
      put(d, 'training_load_chronic', Math.round(480 + t * 60), 'load');
      put(d, 'training_load_ratio', round(between(0.9, 1.3), 2), 'ratio');
      put(d, 'load_focus_anaerobic', Math.round(between(150, 300)), 'load');
      put(d, 'load_focus_high_aerobic', Math.round(between(700, 1000)), 'load');
      put(d, 'load_focus_low_aerobic', Math.round(between(1100, 1500)), 'load');
      put(d, 'training_status', 5, 'code');
      put(d, 'endurance_score', Math.round(7200 + t * 400), 'score');
      put(d, 'hill_score', Math.round(62 + t * 4), 'score');
      put(d, 'race_pred_5k_s', Math.round(1170 - t * 30), 's');
      put(d, 'race_pred_10k_s', Math.round(2450 - t * 60), 's');
      put(d, 'race_pred_half_s', Math.round(5420 - t * 140), 's');
      put(d, 'race_pred_marathon_s', Math.round(11400 - t * 300), 's');
      put(d, 'lactate_threshold_hr_bpm', 172, 'bpm');
      put(d, 'lactate_threshold_pace_s_per_km', Math.round(262 - t * 6), 's/km');
      put(d, 'cycling_ftp_w', 268, 'W');
      put(d, 'fitness_age', 29, 'years');
    }
  }
  for (let i = 0; i < samples.length; i += 500) {
    const chunk = samples.slice(i, i + 500);
    await q(
      `INSERT INTO health_samples (user_id, date, metric, value, unit, source)
       SELECT $1, d, m, v, u, s FROM unnest($2::date[], $3::text[], $4::float8[], $5::text[], $6::text[]) AS x(d, m, v, u, s)`,
      [U, chunk.map((c) => c[0]), chunk.map((c) => c[1]), chunk.map((c) => c[2]), chunk.map((c) => c[3]), chunk.map((c) => c[4])]
    );
  }
  console.log(`${samples.length} health samples`);

  await seedLabs(U);
  await seedDexa(U);

  // ---------- goals and events ----------
  await q(
    `INSERT INTO user_goals (id, user_id, primary_sport, goal_type, target_event, target_event_date, days_per_week, hours_per_week, preferred_days, fitness_level, current_weekly_volume, notes)
     VALUES ($1, $2, 'running', 'speed', 'California International Marathon (half)', $3, 6, 9, $4, 'advanced', $5, 'Sub 1:25 half. Keep two strength sessions a week.')`,
    [cid('goals'), U, addDays(TODAY, 44), JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Sat', 'Sun']), JSON.stringify({ runKm: 38, rideHours: 4.5 })]
  );
  const evs = [
    ['Half marathon — CIM', addDays(TODAY, 44), 'A', 'run', 'sub 1:25'],
    ['Turkey Trot 10K', addDays(TODAY, 34), 'B', 'run', 'sub 37:00'],
    ['Mt. Tam gran fondo', addDays(TODAY, -40), 'C', 'ride', null],
    ['Spring century', addDays(TODAY, 160), 'B', 'ride', 'finish strong'],
  ];
  for (const [name, date, pr, sport, target] of evs) {
    await q(`INSERT INTO events (id, user_id, name, date, priority, sport, target) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [cid(`ev-${name}`), U, name, date, pr, sport, target]);
  }

  console.log('dev-seed: done');
}

function zoneTimes(r) {
  const t = r.movingTime;
  if (r.type === 'WeightTraining') return { z1: t * 0.8, z2: t * 0.2, z3: 0, z4: 0, z5: 0 };
  const hard = r.workoutType === 3 || r.workoutType === 12;
  const w = hard ? [0.15, 0.35, 0.2, 0.2, 0.1] : [0.25, 0.6, 0.12, 0.03, 0];
  return Object.fromEntries(w.map((x, i) => [`z${i + 1}`, Math.round(t * x)]));
}

function runBestEfforts(r) {
  const pace = r.movingTime / r.distance;
  return [
    ['400m', 400], ['1/2 mile', 805], ['1K', 1000], ['1 mile', 1609], ['2 mile', 3219], ['5K', 5000], ['10K', 10000],
  ]
    .filter(([, d]) => d <= r.distance)
    .map(([name, d], i) => ({ name, distance: d, elapsedTime: Math.round(d * pace * 0.95), movingTime: Math.round(d * pace * 0.95), startIndex: 0, endIndex: 10, prRank: i === 2 && r.workoutType === 3 ? 2 : null }));
}

/** Second-by-second streams (every 2 s) with laps and km splits. */
function makeStreams(r) {
  const step = 2;
  const n = Math.floor(r.movingTime / step);
  const time = [], distance = [], latlng = [], altitude = [], velocity = [], heartrate = [], cadence = [], watts = [], moving = [], grade = [], temp = [];
  const ride = r.type !== 'Run';
  const intervals = r.workoutType === 3 || r.workoutType === 12;
  let dist = 0, hr = r.hr - 25;
  const laps = [];
  const lapLen = ride ? (intervals ? Math.floor(n / 7) : Math.floor(n / 4)) : Math.floor(1000 / (r.averageSpeed * step));
  for (let i = 0; i < n; i++) {
    const f = i / n;
    const on = intervals && f > 0.2 && f < 0.85 && Math.floor((f - 0.2) * 10) % 2 === 0;
    const speed = Math.max(0.5, r.averageSpeed * (on ? 1.12 : intervals ? 0.9 : 1) + Math.sin(i / 37) * 0.15 + gauss() * 0.08);
    dist += speed * step;
    const target = r.hr + (on ? 12 : intervals ? -8 : 0) + Math.sin(i / 90) * 3;
    hr += (target - hr) * 0.05 + gauss() * 0.6;
    time.push(i * step);
    distance.push(round(dist, 1));
    const angle = (dist / 6000) * 2 * Math.PI;
    if (r.latlng) latlng.push([round(r.latlng[0] + 0.012 * Math.sin(angle), 6), round(r.latlng[1] + 0.02 * (1 - Math.cos(angle)), 6)]);
    const alt = 40 + (r.elevation / 2) * (1 - Math.cos(angle * 2));
    altitude.push(round(alt, 1));
    velocity.push(round(speed, 3));
    heartrate.push(Math.round(hr));
    cadence.push(Math.round((r.cadence ?? 85) + gauss() * 2));
    if (ride) watts.push(Math.max(0, Math.round((r.watts ?? 0) * (on ? 1.25 : intervals ? 0.75 : 1) + gauss() * 18)));
    moving.push(true);
    grade.push(round(Math.sin(angle * 2) * (r.elevation / 200), 1));
    if (r.temp != null) temp.push(r.temp);
  }
  const streams = { time, distance, altitude, velocity_smooth: velocity, heartrate, cadence, moving, grade_smooth: grade };
  if (latlng.length) streams.latlng = latlng;
  if (ride) streams.watts = watts;
  if (temp.length) streams.temp = temp;
  for (let s = 0; s < n; s += lapLen) {
    const e = Math.min(n - 1, s + lapLen - 1);
    if (e <= s) break;
    const secs = (e - s + 1) * step;
    const d = distance[e] - (s ? distance[s - 1] : 0);
    const avg = (a) => (a.length ? a.slice(s, e + 1).reduce((x, y) => x + y, 0) / (e - s + 1) : null);
    laps.push({ start: s, end: e, time: secs, distance: round(d, 1), speed: round(d / secs, 3), hr: round(avg(heartrate), 1), watts: ride ? round(avg(watts), 1) : null, elev: round(Math.max(0, altitude[e] - altitude[s]), 1) });
  }
  const splits = [];
  if (!ride) {
    let from = 0;
    for (let i = 0; i < n; i++) {
      if (distance[i] >= (splits.length + 1) * 1000 || i === n - 1) {
        const secs = (i - from + 1) * step;
        const d = distance[i] - (from ? distance[from - 1] : 0);
        const hrs = heartrate.slice(from, i + 1);
        splits.push({ distance: round(d, 1), time: secs, speed: round(d / secs, 3), elev: round(altitude[i] - altitude[from], 1), hr: round(hrs.reduce((a, b) => a + b, 0) / hrs.length, 1) });
        from = i + 1;
      }
    }
  }
  return { streams, laps, splits };
}

async function seedLift(strengthActs) {
  const ex = [
    ['Back Squat', 'barbell', ['quadriceps', 'glutes'], ['hamstrings'], 'lower'],
    ['Romanian Deadlift', 'barbell', ['hamstrings', 'glutes'], ['lower back'], 'lower'],
    ['Bulgarian Split Squat', 'dumbbell', ['quadriceps', 'glutes'], [], 'lower'],
    ['Standing Calf Raise', 'machine', ['calves'], [], 'lower'],
    ['Bench Press', 'barbell', ['chest'], ['triceps', 'shoulders'], 'upper'],
    ['Pull-Up', 'bodyweight', ['lats'], ['biceps'], 'upper'],
    ['Overhead Press', 'barbell', ['shoulders'], ['triceps'], 'upper'],
    ['Barbell Curl', 'barbell', ['biceps'], ['forearms'], 'upper'],
  ];
  const now = new Date().toISOString();
  const rowsOut = [];
  const add = (entity, id, payload, updatedAt = now) => rowsOut.push([entity, id, payload, updatedAt]);
  const exIds = {};
  for (const [name, equipment, primary, secondary] of ex) {
    const id = uuid(`ex-${name}`);
    exIds[name] = id;
    add('exercise', id, { id: id.toUpperCase(), name, equipment, primaryMuscles: primary, secondaryMuscles: secondary, catalogID: null, deletedAt: null });
  }
  const base = { 'Back Squat': 110, 'Romanian Deadlift': 100, 'Bulgarian Split Squat': 22, 'Standing Calf Raise': 60, 'Bench Press': 85, 'Pull-Up': 10, 'Overhead Press': 52.5, 'Barbell Curl': 35 };
  const byDay = new Map();
  for (const [k, a] of strengthActs.entries()) {
    const lower = weekday(a.day) === 1;
    const sessionId = uuid(`session-${a.day}`);
    byDay.set(a.day, sessionId);
    const startedAt = a.startUtc.toISOString();
    const finishedAt = new Date(a.startUtc.getTime() + a.movingTime * 1000).toISOString();
    add('session', sessionId, { id: sessionId.toUpperCase(), day: a.day, title: lower ? 'Lower A' : 'Upper A', startedAt, finishedAt, pausedSeconds: 0, note: k % 5 === 0 ? 'Felt strong today.' : null, unitsAtLog: 'kg', deletedAt: null });
    const names = ex.filter((e) => e[4] === (lower ? 'lower' : 'upper')).map((e) => e[0]);
    const progress = 1 + (k / strengthActs.length) * 0.08;
    for (const [pos, name] of names.entries()) {
      const seId = uuid(`se-${a.day}-${name}`);
      const bw = name === 'Pull-Up';
      add('sessionExercise', seId, { id: seId.toUpperCase(), sessionID: sessionId.toUpperCase(), exerciseID: exIds[name].toUpperCase(), displayName: name, position: pos, restSeconds: pos < 2 ? 180 : 90, loadMode: bw ? 'bodyweight' : 'weight', note: null, deletedAt: null });
      const w = Math.round((base[name] * progress) / 2.5) * 2.5;
      const sets = [{ kind: 'warmUp', reps: 8, weight: Math.round((w * 0.5) / 2.5) * 2.5 }];
      for (let s = 0; s < (pos < 2 ? 4 : 3); s++) sets.push({ kind: 'working', reps: pos < 2 ? 5 : 10, weight: w });
      for (const [i, s] of sets.entries()) {
        const setId = uuid(`set-${a.day}-${name}-${i}`);
        const fail = i === sets.length - 1 && rnd() < 0.15;
        add('set', setId, {
          id: setId.toUpperCase(), sessionExerciseID: seId.toUpperCase(), position: i, kind: s.kind, status: 'done', unit: 'kg',
          targetReps: s.reps, targetWeight: s.weight, actualReps: fail ? s.reps - 2 : s.reps, actualWeight: s.weight,
          rpe: s.kind === 'working' ? Math.min(10, 7 + i * 0.5) : null, note: null, deletedAt: null,
        });
      }
    }
  }
  // A planned session for the next strength day (sets not done yet).
  for (const [entity, id, payload, updatedAt] of rowsOut) {
    await q(`INSERT INTO lift_rows (entity, id, payload, updated_at) VALUES ($1,$2,$3,$4)`, [entity, id, JSON.stringify(payload), updatedAt]);
  }
  console.log(`${byDay.size} lift sessions`);
  return { byDay };
}

async function seedLabs(U) {
  const draws = [addDays(TODAY, -200), addDays(TODAY, -38)];
  // [key, name, slug, category, unit, refLow, refHigh, optLow, optHigh, values per draw]
  const markers = [
    ['glucose', 'Glucose', 'glucose', 'metabolic', 'mg/dL', 65, 99, 72, 90, [92, 101]],
    ['hba1c', 'Hemoglobin A1c', 'hemoglobin-a1c', 'metabolic', '%', 4, 5.6, 4.5, 5.3, [5.3, 5.4]],
    ['insulin', 'Insulin', 'insulin', 'metabolic', 'uIU/mL', 2.6, 24.9, 2, 6, [4.1, 3.8]],
    ['ldl', 'LDL Cholesterol', 'ldl-cholesterol', 'heart', 'mg/dL', 0, 99, 0, 89, [118, 104]],
    ['hdl', 'HDL Cholesterol', 'hdl-cholesterol', 'heart', 'mg/dL', 40, 200, 55, 200, [62, 66]],
    ['triglycerides', 'Triglycerides', 'triglycerides', 'heart', 'mg/dL', 0, 149, 0, 90, [71, 64]],
    ['apob', 'Apolipoprotein B', 'apolipoprotein-b', 'heart', 'mg/dL', 0, 90, 0, 80, [96, 88]],
    ['lpa', 'Lipoprotein(a)', 'lipoprotein-a', 'heart', 'nmol/L', 0, 75, 0, 75, [22, 21]],
    ['ferritin', 'Ferritin', 'ferritin', 'nutrients', 'ng/mL', 38, 380, 50, 150, [48, 36]],
    ['vitd', 'Vitamin D', 'vitamin-d', 'nutrients', 'ng/mL', 30, 100, 40, 80, [34, 46]],
    ['b12', 'Vitamin B12', 'vitamin-b12', 'nutrients', 'pg/mL', 232, 1245, 500, 1245, [610, 655]],
    ['testosterone', 'Testosterone, Total', 'testosterone-total', 'hormones', 'ng/dL', 264, 916, 500, 916, [612, 588]],
    ['cortisol', 'Cortisol', 'cortisol', 'hormones', 'ug/dL', 6.2, 19.4, 8, 15, [14.1, 16.2]],
    ['tsh', 'TSH', 'tsh', 'thyroid', 'mIU/L', 0.45, 4.5, 0.5, 2.5, [1.6, 1.9]],
    ['hscrp', 'hs-CRP', 'hs-crp', 'inflammation', 'mg/L', 0, 3, 0, 1, [0.6, 1.4]],
    ['ck', 'Creatine Kinase', 'creatine-kinase', 'muscle', 'U/L', 44, 196, 44, 196, [180, 342]],
    ['alt', 'ALT', 'alt', 'liver', 'U/L', 0, 44, 0, 30, [24, 28]],
    ['egfr', 'eGFR', 'egfr', 'kidney', 'mL/min/1.73m2', 60, 200, 90, 200, [104, 98]],
  ];
  const catNames = { metabolic: 'Metabolic', heart: 'Heart', nutrients: 'Nutrients', hormones: 'Hormones', thyroid: 'Thyroid', inflammation: 'Inflammation', muscle: 'Muscle', liver: 'Liver', kidney: 'Kidney' };
  const statusOf = (v, m) => (v < m[5] || v > m[6] ? 'out_of_range' : v >= m[7] && v <= m[8] ? 'optimal' : 'in_range');
  for (const m of markers) {
    for (const [i, d] of draws.entries()) {
      const v = m[9][i];
      await q(
        `INSERT INTO lab_results (user_id, collected_on, biomarker, category, value, value_text, unit, ref_low, ref_high, optimal_low, optimal_high, status, source, source_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'function',$13)`,
        [U, d, m[1], catNames[m[3]], v, String(v), m[4], m[5], m[6], m[7], m[8], statusOf(v, m), `req-${i}`]
      );
    }
    const cur = m[9][1];
    const out = cur < m[5] || cur > m[6];
    await q(
      `INSERT INTO lab_biomarkers (user_id, source, key, name, slug, result_names, categories, description, units, status, out_of_range_type, kind, range_text,
         range_min, range_max, range_min_op, range_max_op, optimal_range, optimal_low, optimal_high, current_display, current_on, content)
       VALUES ($1,'function',$2,$3,$4,$5,$6,$7,$8,$9,$10,'continuous_range',$11,$12,$13,'>=','<=',$14,$15,$16,$17,$18,$19)`,
      [
        U, m[0], m[1], m[2], [m[1]], [catNames[m[3]]], `${m[1]} is a standard marker in the ${catNames[m[3]].toLowerCase()} panel.`, m[4],
        out ? 'out_of_range' : 'in_range', out ? (cur > m[6] ? 'above' : 'below') : null, `${m[5]}–${m[6]} ${m[4]}`, m[5], m[6], `${m[7]}–${m[8]}`, m[7], m[8],
        `${cur} ${m[4]}`, draws[1],
        JSON.stringify({
          whyItMatters: `${m[1]} tracks how the ${catNames[m[3]].toLowerCase()} system is doing.`,
          sources: [],
          recommendations: [{ inRange: !out, outOfRangeType: out ? 'above' : null, sections: [{ key: 'what', title: 'What it means', body: out ? 'Outside the reference range on the latest draw.' : 'Within range.' }] }],
        }),
      ]
    );
  }
  let pos = 0;
  for (const [key, name] of Object.entries(catNames)) {
    await q(`INSERT INTO lab_categories (user_id, source, key, name, description, position, biomarker_keys) VALUES ($1,'function',$2,$3,$4,$5,$6)`, [
      U, key, name, null, pos++, markers.filter((m) => m[3] === key).map((m) => m[0]),
    ]);
  }
  await q(
    `INSERT INTO lab_planned_draws (user_id, source, key, type, recommended_on, window_start, window_end, visit_on, scheduled) VALUES ($1,'function','next','retest',$2,$3,$4,NULL,false)`,
    [U, addDays(TODAY, 140), addDays(TODAY, 120), addDays(TODAY, 170)]
  );
  const notes = [
    ['Metabolic', 'Fasting glucose is slightly above range on this draw. Retest fasted; endurance training the day before can raise it.'],
    ['Muscle', 'Creatine kinase is high, consistent with a hard session in the 48 hours before the draw. Not a concern without symptoms.'],
    ['Nutrients', 'Ferritin dropped below range. For an endurance athlete aim for 50+; consider iron with vitamin C and retest in 3 months.'],
    ['Heart', 'ApoB improved and is now in range.'],
  ];
  for (const [i, [category, body]] of notes.entries()) {
    await q(`INSERT INTO clinician_notes (user_id, source, requisition_id, position, noted_on, category, body) VALUES ($1,'function','req-1',$2,$3,$4,$5)`, [U, i, addDays(draws[1], 5), category, body]);
  }
  console.log(`${markers.length} biomarkers`);
}

async function seedDexa(U) {
  const scans = [
    [addDays(TODAY, -330), 76.8, 12.4, 61.0, 0.48],
    [addDays(TODAY, -170), 75.9, 11.3, 61.3, 0.42],
    [addDays(TODAY, -21), 74.6, 9.9, 61.4, 0.36],
  ];
  const region = (fat, lean, bone) => ({ fat_mass_kg: fat, lean_mass_kg: lean, bone_mass_kg: bone, total_mass_kg: round(fat + lean + bone, 2), region_fat_pct: round((fat / (fat + lean + bone)) * 100, 1), tissue_fat_pct: round((fat / (fat + lean)) * 100, 1) });
  for (const [i, [date, total, fat, lean, vat]] of scans.entries()) {
    const id = `dev-scan-${i + 1}`;
    const bone = round(total - fat - lean, 2);
    const sections = {
      'scan-info': { result_id: id, scanner_model: 'GE Lunar iDXA', acquire_time: `${date}T08:10:00`, patient_intake: { age_years: 36 + i * 0.4, height_cm: 180, weight_kg: total } },
      composition: {
        result_id: id,
        total: { fat_mass_kg: fat, lean_mass_kg: lean, bone_mass_kg: bone, total_mass_kg: total, region_fat_pct: round((fat / total) * 100, 1), tissue_fat_pct: round((fat / (fat + lean)) * 100, 1) },
        regions: {
          left_arm: region(fat * 0.05, lean * 0.064, 0.21), right_arm: region(fat * 0.052, lean * 0.067, 0.22),
          left_leg: region(fat * 0.17, lean * 0.18, 0.62), right_leg: region(fat * 0.17, lean * 0.183, 0.63),
          trunk: region(fat * 0.48, lean * 0.45, 0.95), android: region(fat * 0.07, lean * 0.06, 0.06), gynoid: region(fat * 0.16, lean * 0.15, 0.2),
        },
        android_gynoid_ratio: round(0.92 - i * 0.04, 2),
      },
      'visceral-fat': { result_id: id, vat_mass_kg: vat, vat_volume_cm3: Math.round(vat * 1060) },
      'bone-density': { result_id: id, total: { bone_mineral_density: 1.31 + i * 0.01, t_score: 1.2, z_score: 1.1 }, regions: { left_arm: { bone_mineral_density: 0.95 }, right_arm: { bone_mineral_density: 0.97 }, left_leg: { bone_mineral_density: 1.42 }, right_leg: { bone_mineral_density: 1.44 }, trunk: { bone_mineral_density: 1.1 } } },
      percentiles: { result_id: id, params: { reference_age_range: { min: 30, max: 39 } }, metrics: { body_fat_pct: { value: round((fat / total) * 100, 1), percentile: 12 - i * 3 }, vat_mass_kg: { value: vat, percentile: 30 - i * 6 }, lean_mass_kg: { value: lean, percentile: 70 + i } } },
      rmr: { result_id: id, estimates: [{ formula: 'Katch-McArdle', kcal_per_day: Math.round(370 + 21.6 * lean) }, { formula: 'Cunningham', kcal_per_day: Math.round(500 + 22 * lean) }] },
    };
    const row = toScanRow(U, { result_id: id, start_time: `${date}T08:10:00-07:00`, update_time: `${date}T10:00:00-07:00`, location: { name: 'BodySpec SF Mission' } }, sections);
    const full = fullScan(row);
    await q(
      `INSERT INTO dexa_scans (result_id, user_id, scanned_at, scan_date, location, scanner, age_years, height_cm, total_mass_kg, fat_mass_kg, lean_mass_kg, bone_mass_kg,
         body_fat_pct, vat_mass_kg, vat_volume_cm3, android_gynoid_ratio, bone_density, rmr_kcal, regions, bone_regions, percentiles, raw, derived, report_version, result_updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NULL,$24)`,
      [
        row.resultId, U, row.scannedAt, row.scanDate, row.location, row.scanner, row.ageYears, row.heightCm, row.totalMassKg, row.fatMassKg, row.leanMassKg,
        row.boneMassKg, row.bodyFatPct, row.vatMassKg, row.vatVolumeCm3, row.androidGynoidRatio, row.boneDensity, row.rmrKcal,
        JSON.stringify(row.regions), JSON.stringify(row.boneRegions), JSON.stringify(row.percentiles), JSON.stringify(row.raw), JSON.stringify(storedDerived(full)), row.resultUpdatedAt,
      ]
    );
  }
  console.log(`${scans.length} DEXA scans`);
}

try {
  await main();
} catch (e) {
  console.error('dev-seed failed:', e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
