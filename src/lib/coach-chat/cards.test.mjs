import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breakdownCard, breakdownSpan, checkCard, cleanQuestions, cleanReplies, dayTimeline, hoursText, MAX_CARDS, MAX_QUESTIONS } from './cards.mjs';

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

test('breakdownSpan: a week from its Monday, a calendar month, never past tomorrow or a year back', () => {
  assert.deepEqual(breakdownSpan('week:2026-10-28', '2026-10-29'), { from: '2026-10-26', to: '2026-10-30', caption: 'This week' });
  assert.deepEqual(breakdownSpan('week:2026-10-21', '2026-10-29'), { from: '2026-10-19', to: '2026-10-26', caption: 'Week of Oct 19' });
  assert.deepEqual(breakdownSpan('month:2026-10', '2026-10-29'), { from: '2026-10-01', to: '2026-10-30', caption: 'October 2026' });
  assert.deepEqual(breakdownSpan('month:2026-09', '2026-10-29'), { from: '2026-09-01', to: '2026-10-01', caption: 'September 2026' });
  assert.equal(breakdownSpan('month:2026-12', '2026-10-29')?.to, undefined);
  assert.equal(breakdownSpan('month:2026-11', '2026-10-29'), null);
  assert.equal(breakdownSpan('month:2024-01', '2026-10-29'), null);
  assert.equal(breakdownSpan('2026-10-28', '2026-10-29'), null);
  assert.equal(checkCard({ kind: 'breakdown', ref: 'month:2026-10' }, plan).ok, true);
  assert.equal(checkCard({ kind: 'breakdown', ref: 'year:2026' }, plan).ok, false);
});

test('breakdownCard adds up time by sport, biggest first', () => {
  const card = breakdownCard([
    { sport: 'run', minutes: 45 }, { sport: 'ride', minutes: 90 }, { sport: 'run', minutes: 30 },
    { sport: 'hike', minutes: 20 }, { sport: 'yoga', minutes: 0 },
  ], 'October 2026');
  assert.equal(card.total, '3 h 5 m');
  assert.deepEqual(card.rows.map((r) => [r.label, r.value, r.display, r.tint]), [
    ['Ride', 90, '1 h 30 m', 'ride'], ['Run', 75, '1 h 15 m', 'run'], ['Hike', 20, '20 m', 'walk'],
  ]);
  assert.equal(hoursText(120), '2 h');
  assert.equal(breakdownCard([], 'This week').total, '0 m');
});

test('cleanQuestions keeps valid questions, numbered, at most five', () => {
  const qs = cleanQuestions({ questions: [
    { title: ' Which days? ', kind: 'multi', options: ['Mon', 'Tue', 'Mon'], allowOther: true },
    { title: 'Pick', kind: 'single', options: ['Only one'] },
    { title: 'How long do you have?', kind: 'text', placeholder: 'e.g. 40 min' },
    { title: 'Apply it?', kind: 'confirm', confirm: { primary: 'Apply', secondary: 'Change first' } },
    { title: 'Bad confirm', kind: 'confirm' },
    { title: 'Nope', kind: 'essay' },
  ] });
  assert.deepEqual(qs.map((q) => [q.id, q.title, q.kind]), [['q1', 'Which days?', 'multi'], ['q2', 'How long do you have?', 'text'], ['q3', 'Apply it?', 'confirm']]);
  assert.deepEqual(qs[0].options, ['Mon', 'Tue']);
  assert.equal(qs[0].allowOther, true);
  assert.equal(qs[1].placeholder, 'e.g. 40 min');
  assert.deepEqual(qs[2].confirm, { primary: 'Apply', secondary: 'Change first' });
  const many = cleanQuestions({ questions: Array.from({ length: 8 }, (_, i) => ({ title: `Q${i}`, kind: 'text' })) });
  assert.equal(many.length, MAX_QUESTIONS);
  assert.deepEqual(cleanQuestions(null), []);
});
