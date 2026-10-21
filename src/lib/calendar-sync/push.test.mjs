import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventFor } from './push.mjs';

const base = { id: 'w1', scheduled_date: '2026-10-21', title: 'VO2 A', description: 'Main set', why: 'Rotation', workout_type: 'ride-vo2' };

test('a timed workout uses its zone and end time, and carries the workout id', () => {
  const e = eventFor({ ...base, start_time: '07:00', end_time: '08:15', time_zone: 'Asia/Tokyo' }, '2026-10-19');
  assert.deepEqual(e.start, { dateTime: '2026-10-21T07:00:00', timeZone: 'Asia/Tokyo' });
  assert.deepEqual(e.end, { dateTime: '2026-10-21T08:15:00', timeZone: 'Asia/Tokyo' });
  assert.equal(e.extendedProperties.private.coachWorkoutId, 'w1');
  assert.equal(e.extendedProperties.private.coachPlanDate, '2026-10-19');
  assert.equal(e.colorId, '3');
  assert.equal(e.description, 'Main set\n\nWhy: Rotation\n\nOpen in Coach: https://coach.paolobernasconi.com/plan?week=2026-10-19&open=w-w1');
  assert.deepEqual(e.source, { title: 'Coach', url: 'https://coach.paolobernasconi.com/plan?week=2026-10-19&open=w-w1' });
});

test('a workout with no description still links to Coach', () => {
  const e = eventFor({ ...base, description: null, why: null }, '2026-10-19');
  assert.equal(e.description, 'Open in Coach: https://coach.paolobernasconi.com/plan?week=2026-10-19&open=w-w1');
});

test('no end time: start plus duration, crossing midnight when needed', () => {
  const e = eventFor({ ...base, start_time: '23:30', duration: 90 }, '2026-10-19');
  assert.equal(e.start.timeZone, 'America/Los_Angeles');
  assert.equal(e.end.dateTime, '2026-10-22T01:00:00');
});

test('no start time: an all-day, free event', () => {
  const e = eventFor({ ...base, scheduled_date: new Date('2026-10-25T00:00:00Z') }, '2026-10-19');
  assert.deepEqual(e.start, { date: '2026-10-25' });
  assert.deepEqual(e.end, { date: '2026-10-26' });
  assert.equal(e.transparency, 'transparent');
});
