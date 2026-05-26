#!/usr/bin/env node
/**
 * Build the unified athlete profile + recent context.
 * Aggregates: athlete profile, training log, fitness state (CTL/ATL/TSB),
 * sport-specific averages, calendar rhythm (preferred days/times),
 * upcoming calendar events, weather, and Apple Notes workouts.
 *
 * Outputs both:
 *   - profile.md (human-readable, comprehensive)
 *   - profile.json (machine-readable, for the /plan command prompt)
 *
 * Usage:
 *   node --env-file=.env.local scripts/coach-profile.mjs [--week-of YYYY-MM-DD]
 */

import { neon } from '@neondatabase/serverless';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = neon(process.env.DATABASE_URL);
const args = process.argv.slice(2);
const weekOfIdx = args.indexOf('--week-of');
const weekOfArg = weekOfIdx >= 0 ? args[weekOfIdx + 1] : null;
const SKIP_SYNC = args.includes('--no-sync');

const USER_ID = 'user_33cD9CNNEIECAQkXy0z1I2jpgw5';
const LOCATION = { lat: 37.7749, lon: -122.4194, label: 'San Francisco, CA', tz: 'America/Los_Angeles' };

// ===== 0. Refresh upstream data (Strava + Calendar) unless --no-sync =====
if (!SKIP_SYNC) {
  try {
    console.error('Syncing calendar…');
    execFileSync('/opt/homebrew/bin/node', [resolve(import.meta.dirname, 'calendar-sync.mjs')], { stdio: 'inherit', env: process.env });
  } catch (e) {
    console.error('calendar-sync failed (continuing):', e.message);
  }
  try {
    console.error('Incremental Strava sync…');
    execFileSync('/opt/homebrew/bin/node', [resolve(import.meta.dirname, 'strava-backfill.mjs')], { stdio: 'inherit', env: process.env });
  } catch (e) {
    console.error('strava-backfill failed (continuing):', e.message);
  }
}

// ===== Week date math =====
function mondayOf(d) {
  const x = new Date(d); x.setUTCHours(0, 0, 0, 0);
  const day = x.getUTCDay();
  x.setUTCDate(x.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return x;
}
const today = new Date();
const weekStart = weekOfArg ? new Date(`${weekOfArg}T00:00:00Z`) : mondayOf(today);
const weekEnd = new Date(weekStart); weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

// ===== 1. User + athlete profile =====
const [user] = await sql`SELECT * FROM users WHERE id = ${USER_ID}`;
const [prof] = await sql`SELECT * FROM strava_athlete_profile WHERE user_id = ${USER_ID} ORDER BY updated_at DESC LIMIT 1`;
const [goals] = await sql`SELECT * FROM user_goals WHERE user_id = ${USER_ID}`;
const ftp = prof?.ftp ?? null;
const hrZones = prof?.hr_zones?.zones ?? [];
const thresholdHr = hrZones[2]?.max ?? 168;
const maxHrEst = hrZones[4]?.min ?? 182;

// ===== 2. Activities (last 120 days for stats, 14 for log) =====
const acts120 = await sql`
  SELECT * FROM strava_activities
  WHERE user_id = ${USER_ID}
    AND start_date_local >= NOW() - INTERVAL '120 days'
    AND COALESCE(commute, false) = false
  ORDER BY start_date_local DESC`;

const acts365 = await sql`
  SELECT type, EXTRACT(DOW FROM start_date_local) AS dow, EXTRACT(HOUR FROM start_date_local) AS hour
  FROM strava_activities
  WHERE user_id = ${USER_ID}
    AND start_date_local >= NOW() - INTERVAL '365 days'
    AND COALESCE(commute, false) = false`;

// ===== 3. TSS / CTL / ATL / TSB compute =====
function tssOf(a) {
  // Use persisted column if available (single source of truth).
  if (typeof a.tss === 'number' && a.tss > 0) return a.tss;
  // Fallback compute (for activities without stored tss)
  const hrs = (a.moving_time ?? a.elapsed_time ?? 0) / 3600;
  if (hrs <= 0) return 0;
  if ((a.type === 'Ride' || a.type === 'VirtualRide') && a.weighted_average_watts && a.device_watts && ftp) {
    const IF = a.weighted_average_watts / ftp;
    return Math.round(IF * IF * hrs * 100 * 10) / 10;
  }
  if (a.average_heartrate) {
    const r = a.average_heartrate / thresholdHr;
    return Math.round(r * r * hrs * 100 * 10) / 10;
  }
  const sportIF = a.type === 'Run' ? 0.75 : a.type === 'Ride' ? 0.65 : 0.5;
  return Math.round(hrs * sportIF * sportIF * 100 * 10) / 10;
}
function r1(n) { return Math.round(n * 10) / 10; }

// Read CTL/ATL/TSB from precomputed daily_training_load (O(1) instead of O(120 days)).
const todayKey = new Date().toISOString().slice(0, 10);
const dtl = await sql`
  SELECT date, tss, ctl, atl, tsb
  FROM daily_training_load
  WHERE user_id = ${USER_ID}
  ORDER BY date DESC
  LIMIT 60`;
const series = dtl.slice().reverse(); // ASC for downstream uses
const last = series.at(-1) ?? { ctl: 0, atl: 0, tsb: 0, date: todayKey };
const sevenAgo = series.at(-8) ?? series[0] ?? last;
const ramp7d = r1(last.ctl - sevenAgo.ctl);
const weeklyTss = r1(series.slice(-7).reduce((a, b) => a + Number(b.tss ?? 0), 0));
const trend = ramp7d <= -2 ? 'detraining' : ramp7d < 1 ? 'maintaining' : ramp7d < 5 ? 'building' : 'overreaching';

// ===== 4. Sport-specific averages (last 90 days, excluding commute) =====
function statsBySport(filter, label) {
  const xs = acts120.filter(filter);
  if (xs.length === 0) return null;
  const n = xs.length;
  const totalKm = xs.reduce((s, a) => s + (a.distance ?? 0), 0) / 1000;
  const totalMin = xs.reduce((s, a) => s + ((a.moving_time ?? 0) / 60), 0);
  const totalVert = xs.reduce((s, a) => s + (a.total_elevation_gain ?? 0), 0);
  const avgHr = avg(xs.map((a) => a.average_heartrate).filter(Boolean));
  const avgPaceMinKm = totalKm > 0 ? totalMin / totalKm : null;
  const avgSpeedKph = totalMin > 0 ? totalKm / (totalMin / 60) : null;
  const avgNp = avg(xs.map((a) => a.weighted_average_watts).filter(Boolean));
  const avgPower = avg(xs.map((a) => a.average_watts).filter(Boolean));
  return {
    label, count: n,
    perWeek: r1(n / (120 / 7)),
    totalKm: Math.round(totalKm),
    totalHours: r1(totalMin / 60),
    avgKm: r1(totalKm / n),
    avgMin: Math.round(totalMin / n),
    avgVert: Math.round(totalVert / n),
    avgHr: avgHr ? Math.round(avgHr) : null,
    avgPace: avgPaceMinKm ? `${Math.floor(avgPaceMinKm)}:${String(Math.round((avgPaceMinKm % 1) * 60)).padStart(2, '0')}/km` : null,
    avgSpeedKph: avgSpeedKph ? r1(avgSpeedKph) : null,
    avgNp: avgNp ? Math.round(avgNp) : null,
    avgPower: avgPower ? Math.round(avgPower) : null,
  };
}
function avg(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }

const runStats = statsBySport((a) => a.type === 'Run', 'Run');
const rideStats = statsBySport((a) => a.type === 'Ride', 'Outdoor Ride');
const vrideStats = statsBySport((a) => a.type === 'VirtualRide', 'Virtual Ride (Zwift)');
const liftStats = statsBySport((a) => a.type === 'WeightTraining', 'Weight Training');
const hikeStats = statsBySport((a) => a.type === 'Hike', 'Hike');

// ===== 5. Calendar rhythm (preferred DOW + hour from last 365d) =====
const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const rhythmByType = {};
for (const a of acts365) {
  const t = a.type;
  if (!rhythmByType[t]) rhythmByType[t] = { dows: Array(7).fill(0), hours: Array(24).fill(0), total: 0 };
  rhythmByType[t].dows[a.dow]++;
  rhythmByType[t].hours[a.hour]++;
  rhythmByType[t].total++;
}
const rhythmSummary = {};
for (const [t, r] of Object.entries(rhythmByType)) {
  // Top 3 days for this sport
  const dowsRanked = r.dows.map((v, i) => ({ d: DOW_NAMES[i], v })).sort((a, b) => b.v - a.v).slice(0, 3);
  // Modal hour bucket
  const peakHour = r.hours.indexOf(Math.max(...r.hours));
  rhythmSummary[t] = {
    total: r.total,
    topDays: dowsRanked,
    peakHour: peakHour,
    timeOfDay: peakHour < 11 ? 'morning' : peakHour < 14 ? 'midday' : peakHour < 18 ? 'afternoon' : 'evening',
  };
}

// ===== 6. Calendar events this week + next =====
const events = await sql`
  SELECT cc.google_email, ce.summary, ce.start_time, ce.end_time, ce.is_all_day, ce.location
  FROM calendar_events ce
  JOIN calendar_connections cc ON cc.id = ce.connection_id
  WHERE cc.user_id = ${USER_ID}
    AND ce.start_time >= ${weekStart.toISOString()}
    AND ce.start_time < ${new Date(weekEnd.getTime() + 7 * 86400_000).toISOString()}
    AND ce.status <> 'cancelled'
  ORDER BY ce.start_time`;

// ===== 7. Weather for the week =====
let weather = null;
try {
  const daysSpan = Math.max(1, Math.min(16, Math.ceil((weekEnd - today) / 86_400_000) + 1));
  const wxUrl = new URL('https://api.open-meteo.com/v1/forecast');
  wxUrl.searchParams.set('latitude', String(LOCATION.lat));
  wxUrl.searchParams.set('longitude', String(LOCATION.lon));
  wxUrl.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,wind_speed_10m_max');
  wxUrl.searchParams.set('timezone', LOCATION.tz);
  wxUrl.searchParams.set('forecast_days', String(daysSpan));
  wxUrl.searchParams.set('temperature_unit', 'celsius');
  wxUrl.searchParams.set('wind_speed_unit', 'kmh');
  const r = await fetch(wxUrl);
  if (r.ok) {
    const wx = await r.json();
    const codes = { 0:'clear',1:'mostly clear',2:'partly cloudy',3:'overcast',45:'fog',48:'fog',51:'drizzle',53:'drizzle',55:'drizzle',61:'rain',63:'rain',65:'rain',71:'snow',73:'snow',75:'snow',80:'showers',81:'showers',82:'showers',95:'thunderstorm' };
    weather = wx.daily.time.map((d, i) => ({
      date: d,
      tempMin: Math.round(wx.daily.temperature_2m_min[i]),
      tempMax: Math.round(wx.daily.temperature_2m_max[i]),
      precipPct: wx.daily.precipitation_probability_max[i] ?? 0,
      precipMm: Math.round((wx.daily.precipitation_sum[i] ?? 0) * 10) / 10,
      windKph: Math.round(wx.daily.wind_speed_10m_max[i]),
      conditions: codes[wx.daily.weather_code[i]] ?? `code ${wx.daily.weather_code[i]}`,
    })).filter((d) => d.date >= weekStart.toISOString().slice(0, 10) && d.date < weekEnd.toISOString().slice(0, 10));
  }
} catch (e) { console.error('weather fail:', e.message); }

// ===== 8. Apple Notes workouts (recent) =====
let appleNotes = [];
try {
  const out = execFileSync('/opt/homebrew/bin/node', [resolve(import.meta.dirname, 'apple-notes-workouts.mjs'), '--since', new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10)], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const jsonEnd = out.lastIndexOf(']');
  if (jsonEnd > 0) appleNotes = JSON.parse(out.slice(0, jsonEnd + 1));
} catch (e) { console.error('apple notes fail:', e.message); }

// ===== 9. Build markdown profile =====
const md = [];
md.push(`# Athlete Profile — ${user.first_name ?? user.email}`);
md.push(`_Generated ${new Date().toISOString().slice(0, 10)} · target week ${weekStart.toISOString().slice(0, 10)}_\n`);

md.push(`## Physiology`);
md.push(`- **Sex**: ${prof?.sex ?? 'unknown'}`);
md.push(`- **Weight**: ${prof?.weight_kg ?? '?'} kg`);
md.push(`- **FTP**: ${ftp ?? '?'} W (${ftp && prof?.weight_kg ? r1(ftp / prof.weight_kg) : '?'} W/kg)`);
md.push(`- **Threshold HR**: ${thresholdHr} bpm  ·  **Max HR (observed)**: ~${maxHrEst}+ bpm`);
if (hrZones.length) {
  md.push(`- **HR zones**: ` + hrZones.map((z, i) => `Z${i + 1} ${z.min}-${z.max === -1 ? '∞' : z.max}`).join(' · '));
}
md.push('');

md.push(`## Current Fitness State (as of ${last.date})`);
md.push(`- **CTL (fitness, 42d)**: ${last.ctl}`);
md.push(`- **ATL (fatigue, 7d)**: ${last.atl}`);
md.push(`- **TSB (form)**: ${last.tsb} ${last.tsb > 5 ? '🟢 fresh' : last.tsb < -10 ? '🔴 deeply fatigued' : last.tsb < 0 ? '🟡 fatigued' : '⚪ neutral'}`);
md.push(`- **7d trend**: ${trend} (ramp ${ramp7d >= 0 ? '+' : ''}${ramp7d}/wk)`);
md.push(`- **Weekly TSS (last 7d)**: ${weeklyTss}\n`);

md.push(`## Training Profile (last 90 days, commutes excluded)`);
for (const s of [runStats, rideStats, vrideStats, liftStats, hikeStats].filter(Boolean)) {
  md.push(`### ${s.label} (${s.count} sessions, ${s.perWeek}/wk)`);
  md.push(`- Avg: ${s.avgKm}km, ${s.avgMin}min, ${s.avgVert}m vert`);
  if (s.avgHr) md.push(`- Avg HR: ${s.avgHr} bpm`);
  if (s.avgPace) md.push(`- Avg pace: ${s.avgPace}`);
  if (s.avgSpeedKph) md.push(`- Avg speed: ${s.avgSpeedKph} kph`);
  if (s.avgNp) md.push(`- Avg NP: ${s.avgNp} W`);
  else if (s.avgPower) md.push(`- Avg power: ${s.avgPower} W`);
  md.push(`- Volume: ${s.totalKm}km / ${s.totalHours}h total`);
  md.push('');
}

md.push(`## Natural Weekly Rhythm (last 365 days)`);
md.push('What days/times you actually train when not traveling:');
for (const [t, r] of Object.entries(rhythmSummary)) {
  if (r.total < 5) continue;
  const top = r.topDays.map((d) => `${d.d} (${d.v})`).join(', ');
  md.push(`- **${t}** (n=${r.total}): typically ${top}, ${r.timeOfDay} (peak hour ${r.peakHour}:00)`);
}
md.push('');

md.push(`## Last 14 Days — Training Log`);
md.push('| Date | Type | Time | Dist | Vert | avgHR | NP/W | TSS | Notes |');
md.push('|---|---|---|---|---|---|---|---|---|');
for (const a of acts120.filter((x) => new Date(x.start_date_local) >= new Date(Date.now() - 14 * 86400_000))) {
  const d = new Date(a.start_date_local).toISOString().slice(0, 10);
  const min = Math.round((a.moving_time ?? 0) / 60);
  const km = a.distance ? r1(a.distance / 1000) : '–';
  const vert = a.total_elevation_gain ? Math.round(a.total_elevation_gain) + 'm' : '–';
  const hr = a.average_heartrate ? Math.round(a.average_heartrate) : '–';
  const np = a.weighted_average_watts ? Math.round(a.weighted_average_watts) + 'W' : a.average_watts ? Math.round(a.average_watts) + 'W' : '–';
  const tss = r1(tssOf(a));
  const notes = (a.description ?? '').replace(/\n/g, ' ').slice(0, 40);
  md.push(`| ${d} | ${a.type} | ${min}min | ${km}km | ${vert} | ${hr} | ${np} | ${tss} | ${notes} |`);
}
md.push('');

md.push(`## Target Week: ${weekStart.toISOString().slice(0, 10)} → ${new Date(weekEnd.getTime() - 86400_000).toISOString().slice(0, 10)}`);
md.push('### Calendar commitments');
const eventsThisWeek = events.filter((e) => new Date(e.start_time) < weekEnd);
if (eventsThisWeek.length === 0) md.push('_(no events)_');
for (const e of eventsThisWeek) {
  const s = new Date(e.start_time);
  const eend = new Date(e.end_time);
  const day = DOW_NAMES[s.getUTCDay()];
  const tz = LOCATION.tz;
  const fmt = (d) => d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
  md.push(`- **${day} ${s.toISOString().slice(5, 10)}** ${e.is_all_day ? '(all-day)' : `${fmt(s)}–${fmt(eend)}`} · ${e.summary}`);
}
md.push('');

md.push(`### Weather forecast (${LOCATION.label})`);
if (weather && weather.length) {
  md.push('| Date | Lo–Hi | Conditions | Precip | Wind |');
  md.push('|---|---|---|---|---|');
  for (const w of weather) {
    md.push(`| ${w.date} | ${w.tempMin}–${w.tempMax}°C | ${w.conditions} | ${w.precipPct}% / ${w.precipMm}mm | ${w.windKph} kph |`);
  }
} else md.push('_(no forecast)_');
md.push('');

md.push(`### Pending workouts from Apple Notes`);
if (appleNotes.length === 0) md.push('_(none)_');
for (const n of appleNotes.slice(0, 5)) {
  md.push(`- **${n.title}** (${(n.modified || '').slice(0, 10)}) — ${n.body.slice(0, 200).replace(/\n/g, ' ')}…`);
}
md.push('');

md.push(`## Inferred Goals (from data)`);
const goalInferences = [];
if (rideStats && runStats) goalInferences.push(`Balanced multisport athlete — ${rideStats.perWeek}/wk rides + ${runStats.perWeek}/wk runs.`);
if (ftp && prof?.weight_kg) goalInferences.push(`Power-to-weight: ${r1(ftp / prof.weight_kg)} W/kg — intermediate cyclist; next milestone 3.5+ W/kg.`);
if (runStats && runStats.avgPace) goalInferences.push(`Run pace averaging ${runStats.avgPace} — solid Z2 endurance, room to push tempo.`);
if (rhythmSummary['Ride']?.topDays?.[0]?.d === 'Sat' || rhythmSummary['Ride']?.topDays?.[0]?.d === 'Sun') goalInferences.push(`Weekend long-ride habit established.`);
if (liftStats && liftStats.perWeek >= 1) goalInferences.push(`Maintains 1+ strength session/wk — keeps injury risk down.`);
for (const g of goalInferences) md.push(`- ${g}`);
if (!goals) md.push(`- ⚠️ No user_goals row set — defaults inferred from training history. To override, populate the user_goals table.`);
md.push('');

// Write outputs
const profileMd = md.join('\n');
writeFileSync('profile.md', profileMd);

const profileJson = {
  generatedAt: new Date().toISOString(),
  weekStart: weekStart.toISOString().slice(0, 10),
  weekEnd: new Date(weekEnd.getTime() - 86400_000).toISOString().slice(0, 10),
  user: { id: user.id, name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(), email: user.email },
  athleteProfile: { ftp, weightKg: prof?.weight_kg, sex: prof?.sex, thresholdHr, maxHrEst, hrZones, powerZones: prof?.power_zones, paceZones: prof?.pace_zones },
  fitnessState: { asOf: last.date, ctl: last.ctl, atl: last.atl, tsb: last.tsb, trend, ramp7d, weeklyTss },
  sportStats: { run: runStats, ride: rideStats, virtualRide: vrideStats, lift: liftStats, hike: hikeStats },
  rhythm: rhythmSummary,
  recentActivities: acts120.slice(0, 30).map((a) => ({
    date: new Date(a.start_date_local).toISOString().slice(0, 10),
    type: a.type, name: a.name,
    minutes: Math.round((a.moving_time ?? 0) / 60),
    km: a.distance ? r1(a.distance / 1000) : null,
    vert: a.total_elevation_gain ? Math.round(a.total_elevation_gain) : null,
    avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    maxHr: a.max_heartrate,
    np: a.weighted_average_watts ? Math.round(a.weighted_average_watts) : null,
    avgPower: a.average_watts ? Math.round(a.average_watts) : null,
    devicePower: a.device_watts,
    sufferScore: a.suffer_score,
    description: a.description,
    tss: r1(tssOf(a)),
  })),
  calendarThisWeek: eventsThisWeek.map((e) => ({
    summary: e.summary, start: e.start_time, end: e.end_time, allDay: e.is_all_day, location: e.location,
  })),
  weather,
  appleNotes: appleNotes.slice(0, 5),
  goals: goals ?? null,
  inferredGoals: goalInferences,
};
writeFileSync('profile.json', JSON.stringify(profileJson, null, 2));

console.log(`Wrote profile.md (${profileMd.length} chars) and profile.json (${JSON.stringify(profileJson).length} chars).`);
