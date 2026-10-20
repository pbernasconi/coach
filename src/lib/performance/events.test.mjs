import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countdown, parseEvent, sortEvents } from './events.mjs';

test('countdown', () => {
  assert.deepEqual(countdown('2026-10-19', '2026-10-19'), { days: 0, weeks: 0, restDays: 0, label: 'Today' });
  assert.equal(countdown('2026-10-19', '2026-10-20').label, 'Tomorrow');
  assert.equal(countdown('2026-10-19', '2026-10-28').label, 'In 9 days');
  assert.deepEqual(countdown('2026-10-19', '2026-12-06'), { days: 48, weeks: 6, restDays: 6, label: 'In 6 wk 6 d' });
  assert.equal(countdown('2026-10-19', '2026-11-16').label, 'In 4 wk');
  assert.equal(countdown('2026-10-19', '2026-10-01').label, '2 wk 4 d ago');
  assert.equal(countdown('2026-10-19', '2026-10-09').label, '10 days ago');
  assert.equal(countdown('2026-10-19', '2026-10-18').label, 'Yesterday');
  // Across the DST change in early November (dates are UTC days, so no off-by-one).
  assert.equal(countdown('2026-10-30', '2026-11-02').days, 3);
});

test('parse event', () => {
  assert.deepEqual(parseEvent({ name: ' Berkeley Hills RR ', date: '2027-04-11', priority: 'a', sport: 'ride', notes: '', target: 'Top 10' }), {
    ok: true,
    value: { name: 'Berkeley Hills RR', date: '2027-04-11', priority: 'A', sport: 'ride', notes: null, target: 'Top 10' },
  });
  assert.equal(parseEvent({ name: '', date: '2027-04-11' }).ok, false);
  assert.equal(parseEvent({ name: 'X', date: '2027-02-30' }).ok, false);
  assert.equal(parseEvent({ name: 'X', date: '11/04/2027' }).ok, false);
  assert.equal(parseEvent({ name: 'X', date: '2027-04-11', priority: 'D' }).ok, false);
  assert.equal(parseEvent({ name: 'X', date: '2027-04-11', sport: 'curling' }).ok, false);
  assert.equal(parseEvent({ name: 'X', date: '2027-04-11' }).value.priority, 'B');
});

test('sort events', () => {
  const ev = [
    { id: '1', date: '2026-12-01', priority: 'B' },
    { id: '2', date: '2026-11-01', priority: 'A' },
    { id: '3', date: '2026-09-01', priority: 'A' },
    { id: '4', date: '2026-12-01', priority: 'A' },
    { id: '5', date: '2026-10-01', priority: 'C' },
  ];
  const { upcoming, past } = sortEvents(ev, '2026-10-19');
  assert.deepEqual(upcoming.map((e) => e.id), ['2', '4', '1']);
  assert.deepEqual(past.map((e) => e.id), ['5', '3']);
});
