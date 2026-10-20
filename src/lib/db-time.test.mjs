import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toDate, toDay, toIso } from './db-time.mjs';

// Every shape Postgres can send. The 2026-10-19 outage was the timestamptz row: '…+00' with 'Z' added.
const ISO = [
  ['timestamptz +00', '2026-10-20 03:00:41.123+00', '2026-10-20T03:00:41.123Z'],
  ['timestamptz +00, no fraction', '2026-10-20 03:00:41+00', '2026-10-20T03:00:41.000Z'],
  ['timestamptz +09:00', '2026-10-20 12:00:41+09:00', '2026-10-20T03:00:41.000Z'],
  ['timestamptz +0530', '2026-10-20 08:30:41+0530', '2026-10-20T03:00:41.000Z'],
  ['timestamptz -07', '2026-10-19 20:00:41-07', '2026-10-20T03:00:41.000Z'],
  ['timestamptz microseconds', '2026-10-20 03:00:41.123456+00', '2026-10-20T03:00:41.123Z'],
  ['timestamp without zone is UTC', '2026-10-20 03:00:41.123', '2026-10-20T03:00:41.123Z'],
  ['ISO with T and Z', '2026-10-20T03:00:41.123Z', '2026-10-20T03:00:41.123Z'],
  ['date', '2026-10-20', '2026-10-20T00:00:00.000Z'],
  ['Date object', new Date('2026-10-20T03:00:41Z'), '2026-10-20T03:00:41.000Z'],
  ['epoch ms', Date.UTC(2026, 9, 20, 3, 0, 41), '2026-10-20T03:00:41.000Z'],
];
for (const [name, input, want] of ISO) test(`toIso: ${name}`, () => assert.equal(toIso(input), want));

const BAD = [null, undefined, '', 'not a date', '2026-13-45', '2026-10-20T03:00:41+00Z', new Date(NaN), NaN, {}, []];
for (const input of BAD) {
  test(`unreadable ${String(input)} is null, never an exception`, () => {
    assert.equal(toDate(input), null);
    assert.equal(toIso(input), null);
    assert.equal(toDay(input), null);
  });
}

test('toDay keeps the written day of a text value (local times stay local)', () => {
  assert.equal(toDay('2026-10-19 23:30:00'), '2026-10-19');
  assert.equal(toDay('2026-10-19 23:30:00-07'), '2026-10-19');
  assert.equal(toDay('2026-10-19'), '2026-10-19');
});

test('toDay of a Date is its UTC day', () => assert.equal(toDay(new Date('2026-10-19T23:30:00Z')), '2026-10-19'));
