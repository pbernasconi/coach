#!/usr/bin/env node --test
/**
 * Tests for travel.mjs — driven through the public resolveTravel() surface with
 * an injected geocode, so no network and no need to widen the module's exports.
 *
 * Run: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTravel, dateKeysBetween, HOME_TZ } from './travel.mjs';

const HOME = { lat: 37.7749, lon: -122.4194, label: 'San Francisco, CA', tz: HOME_TZ };

// Fake geocoder: deterministic, offline. Throws on anything unexpected so a test
// that accidentally geocodes an unintended city fails loudly rather than silently.
const CITIES = {
  lisbon: { label: 'Lisbon, PT', lat: 38.7167, lon: -9.1333, tz: 'Europe/Lisbon' },
  munich: { label: 'Munich, DE', lat: 48.1374, lon: 11.5755, tz: 'Europe/Berlin' },
  washington: { label: 'Washington D.C., US', lat: 38.895, lon: -77.036, tz: 'America/New_York' },
  'san francisco del rincon': { label: 'San Francisco del Rincón, MX', lat: 21.02, lon: -101.86, tz: 'America/Mexico_City' },
  quito: { label: 'Quito, EC', lat: 0.0, lon: -78.5, tz: 'America/Guayaquil' },
};
const fakeGeocode = async (name) => CITIES[name.trim().toLowerCase()] ?? null;
const deps = { geocode: fakeGeocode };

const ev = (summary, start, end, extra = {}) => ({
  summary, start_time: start, end_time: end, is_all_day: false, location: null, ...extra,
});

// Real itinerary from Paolo's calendar: SFO -> MUC (layover) -> LIS, then home.
const LISBON_TRIP = [
  ev('Flight to Munich (UA 194)', '2026-07-22T21:00:00Z', '2026-07-23T08:05:00Z'),
  ev('Flight to Lisbon (UA 8938)', '2026-07-23T09:15:00Z', '2026-07-23T12:40:00Z'),
  ev('Flight to Washington (UA 943)', '2026-07-26T11:20:00Z', '2026-07-26T19:15:00Z'),
  ev('Flight to San Francisco (UA 1757)', '2026-07-26T21:55:00Z', '2026-07-27T03:37:00Z'),
];
const H_START = new Date('2026-07-13T00:00:00Z');
const H_END = new Date('2026-07-27T00:00:00Z');

test('resolves the real Lisbon itinerary: place per day + travel days', async () => {
  const t = await resolveTravel(LISBON_TRIP, HOME, H_START, H_END, deps);

  assert.equal(t.away, true);
  assert.deepEqual(t.travelDays, ['2026-07-22', '2026-07-23', '2026-07-26']);

  // Home before departure, Lisbon for the stay, in-transit on flight days.
  assert.equal(t.placeByDate['2026-07-13'].label, 'San Francisco, CA');
  assert.equal(t.placeByDate['2026-07-22'].label, 'San Francisco, CA');
  assert.equal(t.placeByDate['2026-07-23'], null, '07-23 is mid-flight');
  assert.equal(t.placeByDate['2026-07-24'].label, 'Lisbon, PT');
  assert.equal(t.placeByDate['2026-07-25'].label, 'Lisbon, PT');
  assert.equal(t.placeByDate['2026-07-26'], null, '07-26 is mid-flight');

  // The timezone the workout events get stamped with.
  assert.equal(t.placeByDate['2026-07-24'].tz, 'Europe/Lisbon');
  assert.equal(t.placeByDate['2026-07-13'].tz, HOME_TZ);
});

test('layovers under 18h are transit, not a place you train', async () => {
  const t = await resolveTravel(LISBON_TRIP, HOME, H_START, H_END, deps);
  const stays = t.segments.filter((s) => s.kind === 'stay').map((s) => s.place.label);
  const transits = t.segments.filter((s) => s.kind === 'transit').map((s) => s.place.label);

  // 70min in Munich and 2.6h in Washington must never become weather locations.
  assert.ok(transits.includes('Munich, DE'), 'Munich (70min) should be transit');
  assert.ok(transits.includes('Washington D.C., US'), 'Washington (2.6h) should be transit');
  assert.ok(!stays.includes('Munich, DE'), 'Munich must not be a stay');
  assert.ok(stays.includes('Lisbon, PT'), 'Lisbon (~3 days) should be a stay');
});

test('no flights => home for the whole horizon, no travel days', async () => {
  const t = await resolveTravel([ev('Bike club', '2026-07-16T20:30:00Z', '2026-07-16T22:30:00Z')], HOME, H_START, H_END, deps);
  assert.equal(t.away, false);
  assert.deepEqual(t.travelDays, []);
  assert.equal(t.flights.length, 0);
  for (const k of dateKeysBetween(H_START, H_END)) {
    assert.equal(t.placeByDate[k].label, 'San Francisco, CA');
  }
});

test('sameCity: exact token match, not substring', async () => {
  // REGRESSION: substring matching treated "San Francisco del Rincon" as home,
  // which silently applied SF weather + PDT and would schedule a bike ride there.
  const t = await resolveTravel(
    [ev('Flight to San Francisco del Rincon (AM 100)', '2026-07-14T10:00:00Z', '2026-07-14T18:00:00Z')],
    HOME, H_START, H_END, deps,
  );
  assert.equal(t.away, true, 'del Rincon is NOT home');
  assert.equal(t.placeByDate['2026-07-16'].label, 'San Francisco del Rincón, MX');
  assert.notEqual(t.placeByDate['2026-07-16'].tz, HOME_TZ);
});

test('a genuine return home is recognised as home, not re-geocoded', async () => {
  const t = await resolveTravel(
    [
      ev('Flight to Lisbon (UA 1)', '2026-07-14T10:00:00Z', '2026-07-14T20:00:00Z'),
      ev('Flight to San Francisco (UA 2)', '2026-07-20T10:00:00Z', '2026-07-20T20:00:00Z'),
    ],
    HOME, H_START, H_END, deps,
  );
  assert.equal(t.placeByDate['2026-07-22'].label, 'San Francisco, CA');
  assert.equal(t.placeByDate['2026-07-22'].tz, HOME_TZ);
});

test('FLIGHT_RE does not backtrack catastrophically on a hostile title', async () => {
  // REGRESSION: an unbounded lazy `.+?` beside `\s*` was ~O(n^2.8) — 12.8s on an
  // 8KB title. Calendar summaries are attacker-supplied and Google documents no
  // max length, so this must stay bounded. 200KB must resolve ~instantly.
  const n = 100_000;
  const hostile = ev(`Flight to ${'a'.repeat(n)}${' '.repeat(n)}(AA`, '2026-07-14T10:00:00Z', '2026-07-14T12:00:00Z');
  const t0 = Date.now();
  const t = await resolveTravel([hostile], HOME, H_START, H_END, deps);
  const ms = Date.now() - t0;
  assert.ok(ms < 1000, `took ${ms}ms — regex is backtracking again`);
  assert.equal(t.flights.length, 0, 'an 80+ char destination must not parse as a flight');
});

test('trips: wedding/vacation flagged, training camp is NOT', async () => {
  const allDay = (summary, from, to) => ({ summary, start_time: from, end_time: to, is_all_day: true, location: null });

  const wedding = await resolveTravel([allDay('Sarah\'s wedding', '2026-07-18T00:00:00Z', '2026-07-19T00:00:00Z')], HOME, H_START, H_END, deps);
  assert.equal(wedding.trips.length, 1);
  assert.ok(wedding.travelDays.includes('2026-07-18'));

  // REGRESSION: 'camp' in TRIP_RE flagged a *training camp* as travel, which makes
  // /plan prescribe "rest or easy only" — backwards for this athlete.
  const camp = await resolveTravel([allDay('Training camp', '2026-07-18T00:00:00Z', '2026-07-19T00:00:00Z')], HOME, H_START, H_END, deps);
  assert.equal(camp.trips.length, 0, 'a training camp must not be treated as travel');
  assert.deepEqual(camp.travelDays, []);
});

test('geocode failure degrades to home tz rather than throwing', async () => {
  const t = await resolveTravel(
    [ev('Flight to Atlantis (XX 1)', '2026-07-14T10:00:00Z', '2026-07-14T18:00:00Z')],
    HOME, H_START, H_END, { geocode: async () => null },
  );
  const p = t.placeByDate['2026-07-16'];
  assert.equal(p.label, 'Atlantis');
  assert.equal(p.tz, HOME_TZ, 'falls back to home tz');
  assert.equal(p.lat, null);
  assert.equal(p.geocodeFailed, true);
});

test('equatorial destination (lat 0) resolves — must not be dropped as falsy', async () => {
  const t = await resolveTravel(
    [ev('Flight to Quito (AV 1)', '2026-07-14T10:00:00Z', '2026-07-14T20:00:00Z')],
    HOME, H_START, H_END, deps,
  );
  assert.equal(t.placeByDate['2026-07-16'].label, 'Quito, EC');
  assert.equal(t.placeByDate['2026-07-16'].lat, 0, 'lat 0 must survive');
});

test('dateKeysBetween spans a UTC day grid, end-exclusive', () => {
  assert.deepEqual(
    dateKeysBetween(new Date('2026-07-13T00:00:00Z'), new Date('2026-07-16T00:00:00Z')),
    ['2026-07-13', '2026-07-14', '2026-07-15'],
  );
  assert.deepEqual(dateKeysBetween(new Date('2026-07-13T00:00:00Z'), new Date('2026-07-13T00:00:00Z')), []);
});
