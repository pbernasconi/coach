import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCard, cleanReplies, dayTimeline, MAX_CARDS } from './cards.mjs';

const plan = { rows: [{ id: 'v' }], today: '2026-10-26' };

test('checkCard takes plan ids, days near now, exercise names, and readiness for today only', () => {
  assert.deepEqual(checkCard({ kind: 'workout', ref: 'v' }, plan), { ok: true, value: { kind: 'workout', ref: 'v' } });
  assert.equal(checkCard({ kind: 'workout', ref: 'x' }, plan).ok, false);
  assert.equal(checkCard({ kind: 'week', ref: '2026-10-21' }, plan).ok, true);
  assert.equal(checkCard({ kind: 'week', ref: '2026-08-01' }, plan).ok, false);
  assert.equal(checkCard({ kind: 'day', ref: 'Tuesday' }, plan).ok, false);
  assert.equal(checkCard({ kind: 'readiness', ref: '2026-10-27' }, plan).ok, false);
  assert.equal(checkCard({ kind: 'exercise', ref: ' Romanian deadlift ' }, plan).value?.ref, 'Romanian deadlift');
  assert.equal(checkCard({ kind: 'chart', ref: 'x' }, plan).ok, false);
  assert.equal(MAX_CARDS, 2);
});

test('cleanReplies keeps up to 3 short distinct strings', () => {
  assert.deepEqual(cleanReplies({ options: [' Tue 09:00 ', 'Tue 09:00', 3, '', 'Wed 07:00', 'Thu', 'Fri'] }), ['Tue 09:00', 'Wed 07:00', 'Thu']);
  assert.deepEqual(cleanReplies({}), []);
});

test('dayTimeline: meetings merge, sessions stay, gaps of 30 min or more are free, in the local zone', () => {
  const tz = 'America/Los_Angeles';
  const d = dayTimeline({
    date: '2026-10-27', timeZone: tz,
    events: [
      { title: 'Call with Rafael', start: '2026-10-27T20:30:00Z', end: '2026-10-27T21:30:00Z', allDay: false }, // 13:30–14:30
      { title: 'Overlap', start: '2026-10-27T21:00:00Z', end: '2026-10-27T22:00:00Z', allDay: false }, // 14:00–15:00
      { title: 'Short gap after', start: '2026-10-27T22:15:00Z', end: '2026-10-27T23:00:00Z', allDay: false }, // 15:15–16:00
      { title: 'Holiday', start: '2026-10-27', end: '2026-10-28', allDay: true },
    ],
    sessions: [{ id: 'h', title: 'Heavy barbell', startTime: '09:00:00', duration: 75 }],
  });
  assert.match(d.title, /Tuesday.*27 Oct/);
  assert.deepEqual(d.allDay, ['Holiday']);
  assert.deepEqual(d.blocks.map((b) => `${b.start}-${b.end} ${b.kind}${b.title ? ` ${b.title}` : ''}`), [
    '06:00-09:00 free',
    '09:00-10:15 session Heavy barbell',
    '10:15-13:30 free',
    '13:30-15:00 busy Call with Rafael',
    '15:15-16:00 busy Short gap after',
    '16:00-22:00 free',
  ]);
  assert.equal(d.blocks[1].workoutId, 'h');
});
