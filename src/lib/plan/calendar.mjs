// Month calendar logic for /plan: the week grid, the weekly summary column, the workout library and
// weather codes. No framework or database imports, so node --test can run it (calendar.test.mjs).

import { addDays, mondayOf, sportOf } from './week.mjs';

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** 'YYYY-MM' from a URL value, or the month of `today` when the value is missing or bad. */
export function parseMonth(value, today) {
  return typeof value === 'string' && MONTH.test(value) ? value : today.slice(0, 7);
}

/** 'YYYY-MM' plus n months. */
export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** The Mondays of the weeks (Mon–Sun rows) that show `month`: from the week of the 1st to the week of the last day. */
export function monthWeeks(month) {
  const first = `${month}-01`;
  const last = addDays(`${addMonths(month, 1)}-01`, -1);
  const weeks = [];
  for (let w = mondayOf(first); w <= last; w = addDays(w, 7)) weeks.push(w);
  return weeks;
}

/** The seven days of the week that starts on `monday`. */
export function weekDays(monday) {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * The summary column for one week.
 *
 * @param {string} monday
 * @param {{
 *   activities: Array<{ date: string, sport: string, min: number, km: number, tss: number | null, commute?: boolean }>,
 *   lifts: Array<{ date: string }>,
 *   workouts: Array<{ date: string, sport: string, title?: string, workoutType?: string | null, duration: number | null, tss: number | null, status: string, state: string, match?: object | null }>,
 *   load: Array<{ date: string, ctl: number, atl: number, tsb: number }>,
 *   today: string,
 * }} data  The month's data; only rows in this week count. `load` sorted by date.
 */
export function weekSummary(monday, { activities, lifts, workouts, load, today }) {
  const sunday = addDays(monday, 6);
  const inWeek = (d) => d >= monday && d <= sunday;

  const done = { min: 0, km: 0, tss: 0, count: 0, liftSessions: 0, bySport: {} };
  for (const a of activities) {
    if (!inWeek(a.date) || a.commute) continue;
    done.min += a.min;
    done.km += a.km;
    done.tss += a.tss ?? 0;
    done.count += 1;
    done.bySport[a.sport] = (done.bySport[a.sport] ?? 0) + a.min;
  }
  done.liftSessions = lifts.filter((l) => inWeek(l.date)).length;

  const planned = { min: 0, tss: 0, count: 0, done: 0, missed: 0 };
  for (const w of workouts) {
    if (!inWeek(w.date) || w.status === 'skipped' || sportOf(w) === 'rest') continue;
    planned.min += w.duration ?? 0;
    planned.tss += w.tss ?? 0;
    planned.count += 1;
    if (w.state === 'done') planned.done += 1;
    if (w.state === 'missed') planned.missed += 1;
    // Marked done by hand with no activity behind it: its planned time and TSS count as done.
    if (w.status === 'done' && !w.match) {
      done.min += w.duration ?? 0;
      done.tss += w.tss ?? 0;
      done.count += 1;
      const s = sportOf(w);
      done.bySport[s] = (done.bySport[s] ?? 0) + (w.duration ?? 0);
    }
  }

  // Fitness at the end of the week: the last load row on or before Sunday. None for a week that has not started.
  let fitness = null;
  if (monday <= today) {
    for (const row of load) {
      if (row.date > sunday) break;
      if (row.date >= monday) fitness = row;
    }
  }

  done.km = Math.round(done.km * 10) / 10;
  done.tss = Math.round(done.tss);
  planned.tss = Math.round(planned.tss);
  return { monday, done, planned, fitness };
}

/** A workout title without the leading emoji the plan files use. */
export function plainTitle(title) {
  return String(title ?? '').replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '').trim();
}

/** Adapted titles from "how do you feel" (adaptForFeel): not reusable workouts. */
const ADAPTED = /\((instead of|lighter)\b/i;

/**
 * The workout library: one entry per distinct planned workout (sport + title, the newest copy wins), then the
 * Lift templates. Rest days and adapted workouts are left out.
 *
 * @param {Array<{ id: string, sport: string, title: string, workoutType?: string | null, intensity?: string | null, duration?: number | null, tss?: number | null, description?: string | null, date: string }>} rows
 * @param {Array<{ id: string, name: string, position?: number, slots?: string[] }>} templates
 */
export function libraryFrom(rows, templates = []) {
  const byKey = new Map();
  for (const r of [...rows].sort((a, b) => b.date.localeCompare(a.date))) {
    const sport = sportOf(r);
    if (sport === 'rest' || ADAPTED.test(r.title)) continue;
    const title = plainTitle(r.title);
    if (!title) continue;
    const key = `${sport}|${title.toLowerCase()}`;
    const seen = byKey.get(key);
    if (seen) {
      seen.uses += 1;
      continue;
    }
    byKey.set(key, {
      id: `plan:${r.id}`,
      source: 'plan',
      sport,
      title,
      duration: r.duration ?? null,
      tss: r.tss ?? null,
      intensity: r.intensity ?? null,
      description: r.description ?? null,
      lastUsed: r.date,
      uses: 1,
    });
  }
  const planned = [...byKey.values()].sort((a, b) => a.sport.localeCompare(b.sport) || b.uses - a.uses || a.title.localeCompare(b.title));
  const lift = [...templates]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((t) => ({
      id: `lift:${t.id}`,
      source: 'lift',
      sport: 'strength',
      title: t.name,
      duration: null,
      tss: null,
      intensity: null,
      description: (t.slots ?? []).join('\n') || null,
      lastUsed: null,
      uses: 0,
    }));
  return [...lift, ...planned];
}

/** A WMO weather code (Open-Meteo `weathercode`) as words and an icon group. */
export function weatherOf(code) {
  const c = Number(code);
  if (c === 0) return { label: 'Clear', icon: 'sun' };
  if (c === 1 || c === 2) return { label: c === 1 ? 'Mostly clear' : 'Partly cloudy', icon: 'cloud-sun' };
  if (c === 3) return { label: 'Overcast', icon: 'cloud' };
  if (c === 45 || c === 48) return { label: 'Fog', icon: 'fog' };
  if (c >= 51 && c <= 57) return { label: 'Drizzle', icon: 'drizzle' };
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return { label: c >= 80 ? 'Showers' : 'Rain', icon: 'rain' };
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { label: 'Snow', icon: 'snow' };
  if (c >= 95) return { label: 'Thunderstorm', icon: 'storm' };
  return { label: 'Unknown', icon: 'cloud' };
}

/** A location from users.settings.location, or `fallback` when it is missing or bad. */
export function locationFrom(settings, fallback) {
  const l = settings?.location;
  const lat = Number(l?.lat);
  const lon = Number(l?.lon);
  if (l && l.lat != null && l.lon != null && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    return { name: typeof l.name === 'string' && l.name ? l.name : `${lat.toFixed(2)}, ${lon.toFixed(2)}`, lat, lon };
  }
  return fallback;
}
