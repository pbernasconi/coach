import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cityOf, convert, instantOf, localBlocks, shortName, stampZones, wallOf, weekPlaces } from './where.mjs';

const CITIES = {
  newark: { name: 'Newark', label: 'Newark, US', lat: 40.7, lon: -74.2, tz: 'America/New_York', population: 281944 },
  'new york': { name: 'New York', label: 'New York, US', lat: 40.7, lon: -74, tz: 'America/New_York', population: 8_000_000 },
  geneva: { name: 'Geneva', label: 'Geneva, CH', lat: 46.2, lon: 6.1, tz: 'Europe/Zurich', population: 201741 },
  zurich: { name: 'Zürich', label: 'Zürich, CH', lat: 47.4, lon: 8.5, tz: 'Europe/Zurich', population: 415367 },
  lisbon: { name: 'Lisbon', label: 'Lisbon, PT', lat: 38.7, lon: -9.1, tz: 'Europe/Lisbon', population: 500000 },
};
const geocode = async (name) => CITIES[name.trim().toLowerCase()] ?? null;
const timed = (summary, start, end) => ({ summary, start_time: start, end_time: end, is_all_day: false });
const allDay = (summary, first, endExclusive) => ({ summary, start_time: `${first}T00:00:00Z`, end_time: `${endExclusive}T00:00:00Z`, is_all_day: true });

// Paolo's Nov 9–15 2026: SF Mon–Tue, Tue 2 pm flight to Newark, NYC Wed–Thu, Thu 2:35 pm (PT) flight to Geneva, Zurich Fri–Sun.
const NOV = [
  allDay('Liv birthday', '2026-11-09', '2026-11-10'),
  timed('Flight to Newark (UA 1808)', '2026-11-10T22:00:00Z', '2026-11-11T03:31:00Z'),
  allDay('NYC', '2026-11-11', '2026-11-13'),
  allDay('Victors Bday', '2026-11-12', '2026-11-13'),
  timed('Lunch w/ Miles', '2026-11-12T18:00:00Z', '2026-11-12T19:15:00Z'),
  timed('Flight to Geneva (UA 956)', '2026-11-12T22:35:00Z', '2026-11-13T06:25:00Z'),
  allDay('HOLD: Zurich + Zug (Alex Fri, Erik weekend)', '2026-11-13', '2026-11-18'),
  allDay('Stay at Comfortable 1BR flat / great location - Baron 24', '2026-11-13', '2026-11-16'),
  timed('Dinner w/ Erik', '2026-11-13T18:00:00Z', '2026-11-13T20:30:00Z'),
];

test('zone maths: wall clock to instant and back, across zones', () => {
  assert.equal(new Date(instantOf('2026-11-13', '17:30', 'Europe/Zurich')).toISOString(), '2026-11-13T16:30:00.000Z');
  assert.deepEqual(wallOf(Date.parse('2026-11-12T22:35:00Z'), 'America/New_York'), { date: '2026-11-12', time: '17:35' });
  assert.deepEqual(convert('2026-11-13', '07:00', 'Europe/Zurich', 'America/Los_Angeles'), { date: '2026-11-12', time: '22:00' });
  // Summer time in March: 09:00 in SF on the day the clocks change.
  assert.equal(new Date(instantOf('2026-03-08', '09:00', 'America/Los_Angeles')).toISOString(), '2026-03-08T16:00:00.000Z');
});

test('the city an all-day event names', () => {
  assert.equal(cityOf('NYC'), 'New York');
  assert.equal(cityOf('HOLD: Zurich + Zug (Alex Fri, Erik weekend)'), 'Zurich');
  assert.equal(cityOf('Trip to Lisbon'), 'Lisbon');
  assert.equal(cityOf('Liv birthday'), null);
  assert.equal(cityOf('Victors Bday'), null);
  assert.equal(cityOf('Stay at Comfortable 1BR flat / great location - Baron 24'), null);
  assert.equal(shortName('San Francisco, CA'), 'SF');
  assert.equal(shortName('New York, US'), 'NYC');
});

test('Nov 9–15: SF, then NYC from Wednesday, then Zurich from Friday', async () => {
  const w = await weekPlaces(NOV, '2026-11-09', { geocode });
  assert.deepEqual(w.days.map((d) => `${d.date.slice(8)} ${d.short} ${d.tz}${d.travel ? ' ✈' : ''}`), [
    '09 SF America/Los_Angeles',
    '10 SF America/Los_Angeles ✈',
    '11 NYC America/New_York',
    '12 NYC America/New_York ✈',
    '13 Zürich Europe/Zurich ✈',
    '14 Zürich Europe/Zurich',
    '15 Zürich Europe/Zurich',
  ]);
  assert.deepEqual(w.zones.map((z) => z.short), ['SF', 'NYC', 'Zürich']);
  assert.equal(w.days[0].home, true);
  assert.equal(w.days[3].home, false);
});

test('a trip with no flight on the calendar comes from its all-day hold', async () => {
  const w = await weekPlaces([allDay('Lisbon', '2026-07-22', '2026-07-25')], '2026-07-20', { geocode });
  assert.deepEqual(w.days.map((d) => d.short), ['SF', 'SF', 'Lisbon', 'Lisbon', 'Lisbon', 'SF', 'SF']);
});

test('a trip that began the week before carries into this week', async () => {
  const w = await weekPlaces([timed('Flight to Lisbon (TP 238)', '2026-07-15T22:00:00Z', '2026-07-16T09:00:00Z')], '2026-07-20', { geocode });
  assert.ok(w.days.every((d) => d.tz === 'Europe/Lisbon'));
});

test('no network: home all week', async () => {
  const w = await weekPlaces(NOV.filter((e) => !/Flight/.test(e.summary)), '2026-11-09', { geocode: async () => null });
  assert.ok(w.days.every((d) => d.home));
});

test('calendar blocks on each day\'s own clock; an overnight flight shows on both days', async () => {
  const w = await weekPlaces(NOV, '2026-11-09', { geocode });
  const b = localBlocks(NOV, w.days);
  const lunch = b.find((x) => x.title === 'Lunch w/ Miles');
  assert.deepEqual([lunch.date, lunch.start, lunch.minutes], ['2026-11-12', '13:00', 75]);
  const dinner = b.find((x) => x.title === 'Dinner w/ Erik');
  assert.deepEqual([dinner.date, dinner.start], ['2026-11-13', '19:00']);
  const flight = b.filter((x) => x.title.startsWith('Flight to Geneva')).map((x) => `${x.date} ${x.start} ${x.minutes}`);
  assert.deepEqual(flight, ['2026-11-12 17:35 385', '2026-11-13 00:00 445']);
  assert.deepEqual(b.filter((x) => x.title === 'NYC').map((x) => x.date), ['2026-11-11', '2026-11-12']);
});

test('sessions on days away get that day\'s zone; at home none', async () => {
  const w = await weekPlaces(NOV, '2026-11-09', { geocode });
  const plan = stampZones({ events: [
    { title: 'Run', start: '2026-11-09T06:00:00' },
    { title: 'Run', start: '2026-11-11T06:30:00' },
    { title: 'Lift', start: '2026-11-14T10:00:00', timeZone: 'Europe/Zurich' },
  ] }, w.days);
  assert.deepEqual(plan.events.map((e) => e.timeZone ?? null), [null, 'America/New_York', 'Europe/Zurich']);
});

test('body clock: about 1 h a day east and 1.5 h a day west', async () => {
  const { bodyClock } = await import('./where.mjs');
  const d = (date, tz) => ({ date, tz });
  const east = bodyClock([d('2026-11-10', 'America/Los_Angeles'), d('2026-11-11', 'America/New_York'), d('2026-11-12', 'America/New_York'), d('2026-11-13', 'Europe/Zurich'), d('2026-11-14', 'Europe/Zurich')]);
  assert.deepEqual(east.map((x) => x.lagH), [0, 3, 2, 7, 6]);
  const west = bodyClock([d('2026-12-02', 'Europe/London'), d('2026-12-03', 'America/Los_Angeles'), d('2026-12-04', 'America/Los_Angeles')]);
  assert.deepEqual(west.map((x) => x.lagH), [0, -8, -6.5]);
});
