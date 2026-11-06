import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endTimeOf, minutesOf } from './end-time.mjs';

test('the length wins over an old stored end (a move that kept the end)', () => {
  // Fri 2026-11-06: 45 min ride moved to 11:45 kept an end of 14:45.
  assert.equal(endTimeOf({ start_time: '11:45', end_time: '14:45', duration: 45 }), '12:30');
  assert.equal(minutesOf({ start_time: '07:45', end_time: '10:35', duration: 20 }), 20);
});

test('no length: the stored end when it is after the start', () => {
  assert.equal(endTimeOf({ start_time: '07:00', end_time: '08:15', duration: null }), '08:15');
  assert.equal(endTimeOf({ start_time: '10:40', end_time: '07:45', duration: null }), null);
});

test('no start, or an end past midnight: null', () => {
  assert.equal(endTimeOf({ start_time: null, duration: 45 }), null);
  assert.equal(endTimeOf({ start_time: '23:30', duration: 90 }), null);
  assert.equal(endTimeOf({ start_time: '06:45:00', duration: '60' }), '07:45');
});
