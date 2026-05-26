#!/usr/bin/env node
/**
 * Pull all coaching context as JSON for slash-command workflows.
 *
 * Usage:
 *   node --env-file=.env.local scripts/coach-context.mjs [--week-of YYYY-MM-DD]
 *
 * Outputs JSON with:
 *   user, goals, recentActivities (last 14d), calendarEvents (target week),
 *   weather (target week), fitnessState (CTL/ATL/TSB)
 */

import { neon } from '@neondatabase/serverless';

// ===== Config — keep in sync with src/modules/chat/chat-config.ts =====
const USER_ID = 'user_33cD9CNNEIECAQkXy0z1I2jpgw5';
const LOCATION = { lat: 37.7749, lon: -122.4194, label: 'San Francisco, CA', tz: 'America/Los_Angeles' };
const TEMP_UNIT = 'celsius';

// ===== Args =====
const args = process.argv.slice(2);
const weekOfIdx = args.indexOf('--week-of');
const weekOfArg = weekOfIdx >= 0 ? args[weekOfIdx + 1] : null;

// ===== Date helpers =====
function mondayOf(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

const today = new Date();
const weekStart = weekOfArg ? new Date(`${weekOfArg}T00:00:00Z`) : mondayOf(today);
const weekEnd = new Date(weekStart);
weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

const sql = neon(process.env.DATABASE_URL);

// ===== 1. User + goals =====
const [user] = await sql`SELECT id, email, first_name, last_name, timezone FROM users WHERE id = ${USER_ID}`;
if (!user) {
  console.error('User not found');
  process.exit(1);
}
const [goals] = await sql`SELECT * FROM user_goals WHERE user_id = ${USER_ID}`;

// ===== 2. Recent Strava activities (last 60 days for fitness compute, 14 for display) =====
const sixtyDaysAgo = new Date(Date.now() - 60 * 86400_000);
const activities = await sql`
  SELECT name, type, sport_type, distance, moving_time, elapsed_time, total_elevation_gain,
         start_date_local, start_date, average_heartrate, max_heartrate, average_speed
  FROM strava_activities
  WHERE user_id = ${USER_ID}
    AND start_date_local >= ${sixtyDaysAgo.toISOString()}
  ORDER BY start_date_local DESC`;

const recentActivities = activities.filter((a) => {
  const d = new Date(a.start_date_local);
  return d >= new Date(Date.now() - 14 * 86400_000);
});

// ===== 3. Calendar events for target week =====
const events = await sql`
  SELECT cc.google_email, ce.summary, ce.start_time, ce.end_time, ce.is_all_day, ce.location, ce.status
  FROM calendar_events ce
  JOIN calendar_connections cc ON cc.id = ce.connection_id
  WHERE cc.user_id = ${USER_ID}
    AND ce.start_time >= ${weekStart.toISOString()}
    AND ce.start_time < ${weekEnd.toISOString()}
    AND ce.status <> 'cancelled'
  ORDER BY ce.start_time`;

// ===== 4. Weather for target week (Open-Meteo, free, no key) =====
const daysUntilEnd = Math.max(1, Math.min(16, Math.ceil((weekEnd - today) / 86_400_000) + 1));
const wxUrl = new URL('https://api.open-meteo.com/v1/forecast');
wxUrl.searchParams.set('latitude', String(LOCATION.lat));
wxUrl.searchParams.set('longitude', String(LOCATION.lon));
wxUrl.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,wind_speed_10m_max');
wxUrl.searchParams.set('timezone', LOCATION.tz);
wxUrl.searchParams.set('forecast_days', String(daysUntilEnd));
wxUrl.searchParams.set('temperature_unit', TEMP_UNIT);
wxUrl.searchParams.set('wind_speed_unit', 'kmh');

const codes = {
  0:'clear',1:'mostly clear',2:'partly cloudy',3:'overcast',45:'fog',48:'fog',
  51:'light drizzle',53:'drizzle',55:'heavy drizzle',
  61:'light rain',63:'rain',65:'heavy rain',
  71:'light snow',73:'snow',75:'heavy snow',
  80:'showers',81:'showers',82:'heavy showers',95:'thunderstorm',
};

let weather = null;
try {
  const wxRes = await fetch(wxUrl.toString());
  if (wxRes.ok) {
    const wx = await wxRes.json();
    const all = wx.daily.time.map((date, i) => ({
      date,
      tempMin: Math.round(wx.daily.temperature_2m_min[i]),
      tempMax: Math.round(wx.daily.temperature_2m_max[i]),
      precipMm: Math.round((wx.daily.precipitation_sum[i] ?? 0) * 10) / 10,
      precipChance: wx.daily.precipitation_probability_max[i] ?? 0,
      windKph: Math.round(wx.daily.wind_speed_10m_max[i]),
      conditions: codes[wx.daily.weather_code[i]] ?? `code ${wx.daily.weather_code[i]}`,
    }));
    // Filter to the target week
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    weather = {
      location: LOCATION,
      unit: TEMP_UNIT,
      daily: all.filter((d) => d.date >= weekStartStr && d.date < weekEndStr),
    };
  }
} catch (e) {
  weather = { error: String(e) };
}

// ===== 5. Fitness state (CTL/ATL/TSB) =====
// Estimate threshold HR from p95 of recent max HRs * 0.88
const maxHRs = activities.map((a) => a.max_heartrate).filter((v) => v && v > 100).sort((a, b) => a - b);
const thresholdHr = maxHRs.length > 0 ? Math.round(maxHRs[Math.floor(maxHRs.length * 0.95)] * 0.88) : 168;

function hrTss(a) {
  const secs = a.moving_time ?? a.elapsed_time ?? 0;
  if (secs <= 0) return 0;
  const hrs = secs / 3600;
  if (a.average_heartrate && a.average_heartrate > 0) {
    const r = a.average_heartrate / thresholdHr;
    return Math.round(hrs * r * r * 100 * 10) / 10;
  }
  const IF = a.type === 'Ride' ? 0.7 : a.type === 'Run' ? 0.8 : 0.6;
  return Math.round(hrs * IF * IF * 100 * 10) / 10;
}

const tssByDate = new Map();
for (const a of activities) {
  const d = new Date(a.start_date_local ?? a.start_date);
  if (isNaN(d)) continue;
  const key = d.toISOString().slice(0, 10);
  tssByDate.set(key, (tssByDate.get(key) ?? 0) + hrTss(a));
}

let ctl = 0, atl = 0;
const series = [];
if (tssByDate.size > 0) {
  const dates = [...tssByDate.keys()].sort();
  const start = new Date(dates[0]);
  const todayUTC = new Date(); todayUTC.setUTCHours(0, 0, 0, 0);
  for (let d = new Date(start); d <= todayUTC; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    const tss = tssByDate.get(k) ?? 0;
    ctl += (tss - ctl) / 42;
    atl += (tss - atl) / 7;
    series.push({ date: k, tss: Math.round(tss * 10) / 10, ctl: Math.round(ctl * 10) / 10, atl: Math.round(atl * 10) / 10, tsb: Math.round((ctl - atl) * 10) / 10 });
  }
}

const last = series[series.length - 1] ?? { ctl: 0, atl: 0, tsb: 0, date: new Date().toISOString().slice(0, 10) };
const sevenAgo = series[series.length - 8] ?? series[0] ?? last;
const ramp7d = Math.round((last.ctl - sevenAgo.ctl) * 10) / 10;
const weeklyTss = Math.round(series.slice(-7).reduce((a, b) => a + b.tss, 0) * 10) / 10;
const trend = ramp7d <= -2 ? 'detraining' : ramp7d < 1 ? 'maintaining' : ramp7d < 5 ? 'building' : 'overreaching';

const recentNoHr = recentActivities.filter((a) => !a.average_heartrate).length;
const notes = [];
if (recentNoHr > 0) notes.push(`${recentNoHr}/${recentActivities.length} recent activities missing HR — TSS estimated.`);
if (activities[0]?.start_date_local) {
  const days = Math.floor((Date.now() - new Date(activities[0].start_date_local).getTime()) / 86_400_000);
  if (days > 5) notes.push(`Most recent Strava activity is ${days} days old — sync may be stale.`);
}

const fitness = {
  asOf: last.date,
  ctl: last.ctl,
  atl: last.atl,
  tsb: last.tsb,
  trend,
  ramp7d,
  weeklyTss,
  thresholdHr,
  notes,
};

// ===== Output =====
console.log(JSON.stringify({
  weekStart: weekStart.toISOString().slice(0, 10),
  weekEnd: new Date(weekEnd.getTime() - 86400_000).toISOString().slice(0, 10),
  user: { id: user.id, name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(), email: user.email },
  goals: goals ?? null,
  recentActivities: recentActivities.map((a) => ({
    name: a.name, type: a.type, distance_km: a.distance ? Math.round(a.distance / 100) / 10 : null,
    duration_min: a.moving_time ? Math.round(a.moving_time / 60) : null,
    elevation_m: a.total_elevation_gain, date: a.start_date_local,
    avg_hr: a.average_heartrate, max_hr: a.max_heartrate,
  })),
  calendarEvents: events.map((e) => ({
    cal: e.google_email, summary: e.summary, start: e.start_time, end: e.end_time, allDay: e.is_all_day, location: e.location,
  })),
  weather,
  fitness,
}, null, 2));
