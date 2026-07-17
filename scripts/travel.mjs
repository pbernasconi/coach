#!/usr/bin/env node
/**
 * Travel detection — turns calendar events into a structured itinerary.
 *
 * Why: the plan pipeline used to hardcode San Francisco, so a week abroad got
 * SF weather and PDT event times. This module derives *where you actually are*
 * on each day of the planning horizon, so weather follows you and workout
 * events get the right timezone.
 *
 * Inputs are raw calendar_events rows (Gmail auto-creates "Flight to X (UA 123)"
 * events with the *origin* airport in `location`, so the destination is parsed
 * from the summary).
 *
 * Exports (the only two entry points — everything else is internal):
 *   resolveTravel(events, home, a, b)    → { segments, placeByDate, travelDays, flights, trips, away }
 *   dateKeysBetween(a, b)                → ['YYYY-MM-DD', ...]  (UTC day grid)
 *   HOME_TZ                              → default timezone, single source of truth
 */

// Default timezone. Single source of truth — render-plan.mjs and
// add-workouts-to-calendar.mjs import this rather than redeclaring the literal.
export const HOME_TZ = 'America/Los_Angeles';

// Gmail flight events look like: "Flight to Munich (UA 194)".
// The destination capture is bounded and excludes parens/newlines: an unbounded
// lazy `.+?` followed by `\s*` is ambiguous (`.` matches spaces too), which
// backtracks catastrophically — ~O(n^2.8), 12s on an 8KB title. Calendar
// summaries are attacker-supplied (anyone can send an invite) and Google
// documents no max length for the field, so this must be bounded structurally.
const FLIGHT_RE = /^\s*Flight\s+to\s+([^()\n]{1,80}?)\s*(?:\(\s*([A-Z0-9]{2}\s?\d{1,4})\s*\))?\s*$/i;

// All-day events that imply being away even without a flight.
// Deliberately NOT 'camp' or 'conference': a *training camp* is the opposite of
// a rest week for this athlete, and flagging it as travel would suppress
// intensity exactly when the week is meant to be hard.
const TRIP_RE = /\b(wedding|trip|vacation|vacay|holiday|retreat|offsite|off-site)\b/i;

// A stay shorter than this is a layover, not a place you train.
const MIN_STAY_HOURS = 18;

function dateKeyInTz(d, tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d instanceof Date ? d : new Date(d));
}

export function dateKeysBetween(from, to) {
  const keys = [];
  const cur = new Date(from);
  cur.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  while (cur < end) {
    keys.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return keys;
}

function parseFlights(events) {
  return (events ?? [])
    .map((e) => {
      const m = FLIGHT_RE.exec(e.summary ?? '');
      if (!m) return null;
      const depart = new Date(e.start_time ?? e.start);
      const arrive = new Date(e.end_time ?? e.end ?? e.start_time ?? e.start);
      if (Number.isNaN(depart.getTime())) return null;
      return {
        destination: m[1].trim(),
        flightNo: m[2] ? m[2].replace(/\s+/g, ' ').trim() : null,
        depart,
        arrive: Number.isNaN(arrive.getTime()) ? depart : arrive,
        originLabel: e.location ?? null,
        summary: e.summary,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.depart - b.depart);
}

function detectTripEvents(events) {
  return (events ?? [])
    .filter((e) => e.is_all_day && TRIP_RE.test(e.summary ?? ''))
    .map((e) => ({
      summary: e.summary,
      from: new Date(e.start_time ?? e.start),
      to: new Date(e.end_time ?? e.end ?? e.start_time ?? e.start),
      location: e.location ?? null,
    }));
}

const geoCache = new Map();

async function geocode(name) {
  const key = name.trim().toLowerCase();
  if (geoCache.has(key)) return geoCache.get(key);
  let out = null;
  try {
    const u = new URL('https://geocoding-api.open-meteo.com/v1/search');
    u.searchParams.set('name', name.trim());
    u.searchParams.set('count', '1');
    u.searchParams.set('language', 'en');
    u.searchParams.set('format', 'json');
    const r = await fetch(u);
    if (r.ok) {
      const hit = (await r.json()).results?.[0];
      if (hit) {
        out = {
          label: [hit.name, hit.country_code].filter(Boolean).join(', '),
          lat: hit.latitude,
          lon: hit.longitude,
          tz: hit.timezone,
        };
      }
    }
  } catch (e) {
    console.error(`geocode("${name}") failed:`, e.message);
  }
  geoCache.set(key, out);
  return out;
}

// Is this flight destination the same city as home?
// Exact normalized-token match, NOT substring containment: `includes` treated
// "San Francisco del Rincon" (Guanajuato, MX) as San Francisco, which would
// silently apply home weather + timezone and schedule a bike ride there. It
// would also collapse home "New York" against a real "Flight to York".
function sameCity(a, b) {
  if (!a || !b) return false;
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
  return norm(a) === norm(b.split(',')[0]);
}

/**
 * Build the where-am-I timeline across [horizonStart, horizonEnd).
 * Segments alternate stay → flight → stay. Stays shorter than MIN_STAY_HOURS
 * are downgraded to 'transit' (layovers) so we don't fetch weather for them.
 */
function buildItinerary(flights, home, horizonStart, horizonEnd) {
  const segments = [];
  let cursorTime = new Date(horizonStart);
  let cursorPlace = home;

  for (const f of flights) {
    if (f.depart >= horizonEnd) break;
    segments.push({ kind: 'stay', place: cursorPlace, from: new Date(cursorTime), to: new Date(f.depart) });
    segments.push({ kind: 'flight', place: null, from: new Date(f.depart), to: new Date(f.arrive), flight: f });
    cursorTime = new Date(f.arrive);
    cursorPlace = sameCity(f.destination, home.label) ? home : { label: f.destination, unresolved: true };
  }
  segments.push({ kind: 'stay', place: cursorPlace, from: new Date(cursorTime), to: new Date(horizonEnd) });

  for (const s of segments) {
    if (s.kind === 'stay' && (s.to - s.from) / 3_600_000 < MIN_STAY_HOURS) s.kind = 'transit';
  }
  return segments.filter((s) => s.to > s.from);
}

/**
 * Main entry. Returns the itinerary plus a date → place map for the horizon.
 * A date with no stay segment covering midday is a pure travel day (no weather).
 */
export async function resolveTravel(events, home, horizonStart, horizonEnd) {
  const flights = parseFlights(events);
  const trips = detectTripEvents(events);
  const segments = buildItinerary(flights, home, horizonStart, horizonEnd);

  // Geocode any destination we don't already know (home is pre-resolved).
  for (const s of segments) {
    if (s.kind === 'flight' || !s.place?.unresolved) continue;
    const g = await geocode(s.place.label);
    s.place = g ?? { ...s.place, lat: null, lon: null, tz: home.tz, geocodeFailed: true };
  }

  // Assign a place to each date by probing midday UTC.
  const placeByDate = {};
  for (const key of dateKeysBetween(horizonStart, horizonEnd)) {
    const probe = new Date(`${key}T12:00:00Z`);
    const seg = segments.find((s) => s.kind === 'stay' && probe >= s.from && probe < s.to);
    placeByDate[key] = seg ? seg.place : null; // null = in transit that day
  }

  // Travel days: any date touched by a flight, in either origin or destination tz.
  const travelDays = new Set();
  for (const f of flights) {
    if (f.arrive < horizonStart || f.depart >= horizonEnd) continue;
    travelDays.add(dateKeyInTz(f.depart, home.tz));
    travelDays.add(dateKeyInTz(f.arrive, home.tz));
  }
  for (const t of trips) {
    for (const k of dateKeysBetween(
      t.from < horizonStart ? horizonStart : t.from,
      t.to > horizonEnd ? horizonEnd : t.to,
    )) travelDays.add(k);
  }

  const away = Object.values(placeByDate).some((p) => p && p.label !== home.label);

  return {
    segments,
    placeByDate,
    travelDays: [...travelDays].sort(),
    flights: flights.map((f) => ({
      destination: f.destination,
      flightNo: f.flightNo,
      depart: f.depart.toISOString(),
      arrive: f.arrive.toISOString(),
      summary: f.summary,
    })),
    trips: trips.map((t) => ({ summary: t.summary, from: t.from.toISOString(), to: t.to.toISOString() })),
    away,
  };
}
