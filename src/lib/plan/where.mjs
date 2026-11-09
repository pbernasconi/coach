// Where Paolo is each day of a week, and the clock that day runs on. The week planner plans sessions at local
// times, the planning screen draws each day in its own zone, and the time zone columns name the week's zones.
// Flights (scripts/travel.mjs) decide when the zone changes; all-day holds like "NYC" or "HOLD: Zurich + Zug" name
// the place and cover trips with no flight on the calendar. Pure but for the injected geocoder (where.test.mjs).

import { resolveTravel } from '../../../scripts/travel.mjs';

export const HOME = { lat: 37.7749, lon: -122.4194, label: 'San Francisco, CA', tz: 'America/Los_Angeles' };

const DAY_MS = 86_400_000;
const addDay = (/** @type {string} */ d, n = 1) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** A zone's offset from UTC at an instant, in minutes (Zurich in winter: 60). */
export function offsetMin(ms, tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  );
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
  return Math.round((wall - Math.floor(ms / 1000) * 1000) / 60_000);
}

/** The instant of a wall-clock time ("YYYY-MM-DD", "HH:MM") in a zone. */
export function instantOf(date, time, tz) {
  const guess = Date.parse(`${date}T${time}:00Z`);
  let ms = guess - offsetMin(guess, tz) * 60_000;
  ms = guess - offsetMin(ms, tz) * 60_000; // again, for a time near a clock change
  return ms;
}

/** An instant on a zone's wall clock: { date: 'YYYY-MM-DD', time: 'HH:MM' }. */
export function wallOf(ms, tz) {
  const d = new Date(ms + offsetMin(ms, tz) * 60_000).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
}

/** A wall-clock time moved from one zone to another. */
export function convert(date, time, from, to) {
  return from === to ? { date, time } : wallOf(instantOf(date, time, from), to);
}

const fold = (/** @type {string} */ s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

/** Names Paolo writes for a city, and the short name the screen shows. */
const ALIASES = { nyc: 'New York', ny: 'New York', sf: 'San Francisco', la: 'Los Angeles', dc: 'Washington', zh: 'Zurich', zrh: 'Zurich', ldn: 'London' };
const SHORT = { newyork: 'NYC', sanfrancisco: 'SF', losangeles: 'LA', washington: 'DC' };

/** "San Francisco, CA" → "SF", "Zürich, CH" → "Zürich". */
export function shortName(label) {
  const city = String(label ?? '').split(',')[0].trim();
  return SHORT[fold(city)] ?? city;
}

const NOT_A_PLACE = /birthday|bday|anniversary|holiday|day off|\booo\b|out of office|reminder|deadline|wfh|work from/i;

/**
 * The city an all-day event names, or null: "NYC" → "New York", "HOLD: Zurich + Zug (Alex Fri)" → "Zurich",
 * "Trip to Lisbon" → "Lisbon". Only short names: "Liv birthday" or a long note is not a place.
 */
export function cityOf(title) {
  const t = String(title ?? '');
  if (NOT_A_PLACE.test(t)) return null;
  const head = t
    .replace(/^\s*(hold|tentative|tbc|tbd)\s*[:\-–]\s*/i, '')
    .replace(/^\s*(trip|travel|flying|in|at|visit(ing)?)\s+(to\s+)?/i, '')
    .split(/[+(/,–—|:]| - | & /)[0]
    .replace(/[^\p{L} .'-]/gu, '')
    .trim();
  if (!head || head.length > 24 || head.split(/\s+/).length > 3) return null;
  return ALIASES[fold(head)] ?? head;
}

/** A geocoder hit counts only when it is the place the title names and a real city (not a hamlet called "Gym"). */
function sameName(hit, city) {
  return hit && fold(hit.name ?? hit.label?.split(',')[0] ?? '') === fold(city) && (hit.population == null || hit.population >= 50_000);
}

/** The place at an instant: a stay's place; on a flight or a layover, where it lands next. */
function placeAt(segments, ms) {
  const i = segments.findIndex((s) => ms >= s.from.getTime() && ms < s.to.getTime());
  if (i < 0) return null;
  const s = segments[i];
  if (s.kind === 'stay') return s.place;
  const next = segments.slice(i + 1).find((x) => x.kind === 'stay') ?? segments.slice(i + 1).find((x) => x.kind === 'transit');
  return next?.place ?? (s.kind === 'transit' ? s.place : null);
}

/**
 * Each day of the week with where he is and its zone: [{ date, label, short, tz, home, travel }], and the week's
 * zones in order of first use: [{ tz, short }]. A day's place is where he is at noon on that day's clock (on a
 * flight, where it lands): Tuesday with an afternoon flight east is still home, the day he lands in Europe is there.
 * @param {any[]} events calendar rows { summary, start_time, end_time, is_all_day, location } from 3 weeks before the week on
 * @param {string} weekStart Monday 'YYYY-MM-DD'
 * @param {{ geocode?: (name: string) => Promise<any>, home?: typeof HOME, days?: number }} [opts]
 */
export async function weekPlaces(events, weekStart, { geocode, home = HOME, days = 7 } = {}) {
  const dates = Array.from({ length: days }, (_, i) => addDay(weekStart, i));
  const from = new Date(instantOf(addDay(weekStart, -21), '00:00', home.tz));
  const to = new Date(instantOf(addDay(weekStart, days + 1), '00:00', home.tz));
  const travel = await resolveTravel(events, home, from, to, geocode ? { geocode } : {});
  const segments = travel.segments;

  // Flights and the day's place, walking the week so each day's noon is on the clock of the day before.
  let tz = (placeAt(segments, instantOf(weekStart, '00:00', home.tz)) ?? home).tz ?? home.tz;
  const out = dates.map((date) => {
    const place = placeAt(segments, instantOf(date, '12:00', tz)) ?? home;
    tz = place.tz || home.tz;
    return { date, place };
  });
  const flewOn = new Set();
  for (const f of travel.flights) {
    for (const d of out) {
      const z = d.place.tz || home.tz;
      if (wallOf(Date.parse(f.depart), z).date === d.date || wallOf(Date.parse(f.arrive), z).date === d.date) flewOn.add(d.date);
    }
  }

  // All-day holds: name the place ("Newark" → "New York"), or move a day with no flight to where the hold says.
  const holds = (events ?? []).filter((e) => e.is_all_day && cityOf(e.summary));
  const rename = new Map();
  for (const e of holds) {
    const first = new Date(e.start_time ?? e.start).toISOString().slice(0, 10);
    const endRaw = e.end_time ?? e.end;
    const last = endRaw ? addDay(new Date(endRaw).toISOString().slice(0, 10), -1) : first;
    const covered = out.filter((d) => d.date >= first && d.date <= (last < first ? first : last));
    if (!covered.length) continue;
    const city = cityOf(e.summary);
    const hit = geocode ? await geocode(city).catch(() => null) : null;
    if (!sameName(hit, city) || !hit.tz) continue;
    for (const d of covered) {
      if (d.place.tz === hit.tz) {
        if (d.place !== home && fold(d.place.label.split(',')[0]) !== fold(hit.name ?? city)) rename.set(d.place, hit);
      } else if (d.place === home && !flewOn.has(d.date)) {
        d.place = hit;
      }
    }
  }

  const rows = out.map(({ date, place }) => {
    const p = rename.get(place) ?? place;
    const tzOf = p.tz || home.tz;
    const short = shortName(p.label ?? home.label);
    return { date, label: String(p.label ?? home.label), short, tz: tzOf, home: tzOf === home.tz && short === shortName(home.label), travel: flewOn.has(date) };
  });
  /** @type {{ tz: string, short: string }[]} */
  const zones = [];
  for (const r of rows) if (!zones.some((z) => z.tz === r.tz)) zones.push({ tz: r.tz, short: r.short });
  return { days: rows, zones, flights: travel.flights };
}

/** The zone of a day, home when the week's places don't say. */
export function zoneOf(days, date, homeTz = HOME.tz) {
  return days?.find((d) => d.date === date)?.tz ?? homeTz;
}

/**
 * Calendar rows as blocks on each day's own clock: a timed event lands on the days it touches, cut at that day's
 * midnight (an overnight flight shows on both days); an all-day event on every day it covers.
 * @param {any[]} rows { summary, start_time, end_time, is_all_day }
 * @param {{ date: string, tz: string }[]} days
 * @returns {{ date: string, title: string, allDay: boolean, start: string | null, minutes: number }[]}
 */
export function localBlocks(rows, days) {
  const out = [];
  for (const r of rows ?? []) {
    const title = String(r.summary ?? 'Busy').slice(0, 60);
    const s = new Date(r.start_time).getTime();
    const e = r.end_time ? new Date(r.end_time).getTime() : s;
    if (!Number.isFinite(s)) continue;
    if (r.is_all_day) {
      const first = new Date(s).toISOString().slice(0, 10);
      const last = Number.isFinite(e) && e > s ? addDay(new Date(e).toISOString().slice(0, 10), -1) : first;
      for (const d of days) if (d.date >= first && d.date <= last) out.push({ date: d.date, title, allDay: true, start: null, minutes: 0 });
      continue;
    }
    for (const d of days) {
      const a = instantOf(d.date, '00:00', d.tz);
      const b = instantOf(addDay(d.date), '00:00', d.tz);
      const from = Math.max(s, a);
      const until = Math.min(Math.max(e, s), b);
      if (from >= b || until < a || (until === from && s < a)) continue;
      out.push({ date: d.date, title, allDay: false, start: wallOf(from, d.tz).time, minutes: Math.round((until - from) / 60_000) });
    }
  }
  return out;
}

/**
 * A plan's sessions with the zone of the day they're on: the planner writes local times, and one it left without
 * a `timeZone` on a day away gets that day's zone. A session at home carries none.
 * @param {any} plan @param {{ date: string, tz: string }[]} days
 */
export function stampZones(plan, days, homeTz = HOME.tz) {
  if (!plan || !Array.isArray(plan.events) || !days?.length) return plan;
  const events = plan.events.map((e) => {
    const tz = zoneOf(days, String(e?.start ?? '').slice(0, 10), homeTz);
    if (!e || typeof e !== 'object' || e.timeZone || tz === homeTz) return e;
    return { ...e, timeZone: tz };
  });
  return { ...plan, events };
}
