#!/usr/bin/env node
/**
 * Compute proper TSS / CTL / ATL / TSB using athlete profile values.
 * - Ride TSS: power-based when NP + FTP available  ((NP/FTP)^2 * hours * 100)
 *             else HR-based hrTSS using threshold HR
 * - Run TSS: rTSS using HR or running power if available
 * - Other (lift, yoga, hike): hrTSS only
 * - Commute rides excluded.
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const userId = 'user_33cD9CNNEIECAQkXy0z1I2jpgw5';

// Pull athlete profile
const [prof] = await sql`SELECT * FROM strava_athlete_profile WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 1`;
if (!prof) { console.error('No athlete profile'); process.exit(1); }

const ftp = prof.ftp ?? 280;
// Derive threshold HR from zones: top of Z3 = 168
const hrZones = prof.hr_zones?.zones ?? [];
const thresholdHr = hrZones[2]?.max ?? 168;
const maxHr = hrZones[4]?.min ?? 182;

console.log(`Using FTP=${ftp}W, thresholdHR=${thresholdHr}bpm, maxHR≈${maxHr}+\n`);

// Pull last 120 days of non-commute activities
const acts = await sql`
  SELECT id, name, type, sport_type, start_date_local, moving_time, elapsed_time,
         weighted_average_watts, average_watts, device_watts,
         average_heartrate, max_heartrate, suffer_score, commute, distance
  FROM strava_activities
  WHERE user_id = ${userId}
    AND start_date_local >= NOW() - INTERVAL '120 days'
    AND COALESCE(commute, false) = false
  ORDER BY start_date_local ASC`;

function rideTss(a) {
  const hrs = (a.moving_time ?? a.elapsed_time ?? 0) / 3600;
  if (hrs <= 0) return 0;
  // Power-based when usable
  if (a.weighted_average_watts && a.device_watts && ftp) {
    const IF = a.weighted_average_watts / ftp;
    return Math.round(IF * IF * hrs * 100 * 10) / 10;
  }
  // HR fallback
  if (a.average_heartrate) {
    const r = a.average_heartrate / thresholdHr;
    return Math.round(r * r * hrs * 100 * 10) / 10;
  }
  return Math.round(hrs * 0.65 * 0.65 * 100 * 10) / 10;
}

function runTss(a) {
  const hrs = (a.moving_time ?? a.elapsed_time ?? 0) / 3600;
  if (hrs <= 0) return 0;
  // Use HR-based for now; running power on Strava is device-specific (Stryd)
  if (a.average_heartrate) {
    const r = a.average_heartrate / thresholdHr;
    return Math.round(r * r * hrs * 100 * 10) / 10;
  }
  return Math.round(hrs * 0.75 * 0.75 * 100 * 10) / 10;
}

function otherTss(a) {
  const hrs = (a.moving_time ?? a.elapsed_time ?? 0) / 3600;
  if (hrs <= 0) return 0;
  if (a.average_heartrate) {
    const r = a.average_heartrate / thresholdHr;
    return Math.round(r * r * hrs * 100 * 10) / 10;
  }
  // Lifts/yoga without HR: a flat moderate factor
  return Math.round(hrs * 0.5 * 0.5 * 100 * 10) / 10;
}

function tssFor(a) {
  const t = a.type;
  if (t === 'Ride' || t === 'VirtualRide') return rideTss(a);
  if (t === 'Run') return runTss(a);
  return otherTss(a);
}

// Bucket by date
const dateMap = new Map();
for (const a of acts) {
  const d = new Date(a.start_date_local);
  const k = d.toISOString().slice(0, 10);
  const tss = tssFor(a);
  dateMap.set(k, (dateMap.get(k) ?? 0) + tss);
}

// EWMA over full date range
const dates = [...dateMap.keys()].sort();
const start = new Date(dates[0]);
const today = new Date(); today.setUTCHours(0,0,0,0);
let ctl = 0, atl = 0;
const series = [];
for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
  const k = d.toISOString().slice(0, 10);
  const tss = dateMap.get(k) ?? 0;
  ctl += (tss - ctl) / 42;
  atl += (tss - atl) / 7;
  series.push({ date: k, tss: round(tss), ctl: round(ctl), atl: round(atl), tsb: round(ctl - atl) });
}

function round(n) { return Math.round(n * 10) / 10; }

const last = series[series.length - 1];
const sevenAgo = series[series.length - 8] ?? series[0];
const ramp7d = round(last.ctl - sevenAgo.ctl);
const weeklyTss = round(series.slice(-7).reduce((a, b) => a + b.tss, 0));

console.log('=== CURRENT FITNESS STATE ===');
console.log(`As of ${last.date}:`);
console.log(`  CTL (fitness, 42d EWMA): ${last.ctl}`);
console.log(`  ATL (fatigue, 7d EWMA):  ${last.atl}`);
console.log(`  TSB (form = CTL - ATL):  ${last.tsb}  ${last.tsb > 5 ? '(fresh)' : last.tsb < -10 ? '(deeply fatigued)' : last.tsb < 0 ? '(fatigued)' : '(neutral)'}`);
console.log(`  Ramp7d (CTL change):     ${ramp7d >= 0 ? '+' : ''}${ramp7d}/wk  ${ramp7d <= -2 ? '(detraining)' : ramp7d < 1 ? '(maintaining)' : ramp7d < 5 ? '(building)' : '(overreaching)'}`);
console.log(`  Last 7d TSS sum:         ${weeklyTss}`);

console.log('\n=== LAST 14 DAYS DAILY ===');
console.log('date        tss    ctl    atl    tsb');
for (const d of series.slice(-14)) {
  console.log(`${d.date}  ${String(d.tss).padStart(5)}  ${String(d.ctl).padStart(5)}  ${String(d.atl).padStart(5)}  ${String(d.tsb).padStart(5)}`);
}

console.log('\n=== LAST 14 DAYS WORKOUT TSS ===');
for (const a of acts.slice(-15)) {
  const date = new Date(a.start_date_local).toISOString().slice(0, 10);
  const tss = tssFor(a);
  const dur = Math.round((a.moving_time ?? 0) / 60);
  console.log(`${date}  ${a.type.padEnd(15)} ${String(dur).padStart(3)}min  TSS=${String(tss).padStart(5)}  ${a.name}`);
}
