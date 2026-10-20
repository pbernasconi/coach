import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeTime, parseSlots, parseDays, parseCredits, parseReservations, parseBookingResponse, looksLoggedIn, parseLocId,
} from './parse.mjs';

const page = readFileSync(new URL('./fixtures/castro-page.html', import.meta.url), 'utf8');

test('normalizeTime accepts the ways people write times', () => {
  assert.equal(normalizeTime('2pm'), '2:00pm');
  assert.equal(normalizeTime('2:00 PM'), '2:00pm');
  assert.equal(normalizeTime('14:00'), '2:00pm');
  assert.equal(normalizeTime('0:30'), '12:30am');
  assert.equal(normalizeTime('6:30am'), '6:30am');
  assert.equal(normalizeTime('25:00'), null);
  assert.equal(normalizeTime('soon'), null);
});

test('parseSlots reads station names and every status', () => {
  const slots = parseSlots(page);
  const by = (st, t) => slots.find((s) => s.station === st && s.time === t);
  assert.equal(slots.length, 6);
  assert.equal(by('Castro 1', '1:00pm').status, 'available');
  assert.match(by('Castro 1', '1:00pm').reserveRequest, /^v2=true&reserve=200&res_date=2026-10-20&res_time=1:00pm/);
  assert.equal(by('Castro 1', '2:00pm').status, 'reserved');
  assert.equal(by('Castro 3', '6:00am').status, 'closed');
  assert.equal(by('Castro 3', '7:00am').status, 'recurring');
});

test('your own slot is "mine" and never carries a request to send', () => {
  const mine = parseSlots(page).find((s) => s.station === 'Castro 3' && s.time === '2:00pm');
  assert.equal(mine.status, 'mine');
  assert.equal(mine.reserveRequest, '');
  assert.equal(mine.reservedBy, 'Paolo');
});

test('a slot titled "Click to reserve" but carrying unreserve is not bookable', () => {
  const html = `<span class='station-name'>Castro 2</span><p id='res_time_201_2026-10-20_9:00am'><a onclick="loadRequest('x','v2=true&unreserve=5&resourceID=201')" title='Click to reserve'>9:00am</a></p>`;
  const [s] = parseSlots(html);
  assert.equal(s.status, 'mine');
  assert.equal(s.reserveRequest, '');
});

test('unknown slot shapes are never available', () => {
  const [s] = parseSlots(`<p id='res_time_201_2026-10-20_9:00am'><a title='Something new'>9:00am</a></p>`);
  assert.equal(s.status, 'closed');
});

test('parseDays, parseLocId and parseCredits', () => {
  const days = parseDays(page);
  assert.deepEqual(days.map((d) => d.date), ['2026-10-20', '2026-10-21']);
  assert.equal(days[0].locID, '51551');
  assert.equal(days[0].reservableType, 'station');
  assert.equal(parseLocId(page), '51551');
  assert.equal(parseCredits(page), 4);
  assert.equal(parseCredits('<p>Hi Paolo, you have <b>5</b> Gym Credits remaining.</p>'), 5);
  assert.equal(parseCredits('3'), 3);
  assert.equal(parseCredits('<p>nothing</p>'), null);
});

test('parseReservations reads bookings and rolls January into next year', () => {
  const r = parseReservations(page, '2026-10-20');
  assert.deepEqual(r[0], { id: '128242', station: 'Castro 3', date: '2026-10-20', time: '2:00pm', cancelHref: 'reserve-castro-station?unreserve=128242' });
  assert.equal(r[1].date, '2027-01-08');
});

test('parseBookingResponse maps the server words', () => {
  assert.equal(parseBookingResponse('reload').code, 'reload');
  assert.equal(parseBookingResponse('duplicate').ok, false);
  assert.equal(parseBookingResponse('concurrent').ok, false);
  assert.equal(parseBookingResponse('').ok, false);
  assert.equal(parseBookingResponse('<a>2:00pm</a>').ok, true);
});

test('looksLoggedIn', () => {
  assert.equal(looksLoggedIn(page), true);
  assert.equal(looksLoggedIn('<h3>Already Have an Account?</h3>'), false);
  assert.equal(looksLoggedIn('Sign In Required'), false);
});
