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

import { calendarWins, movedFields, wallOf } from './push.mjs';

const timed = { ...base, start_time: '07:00', end_time: '08:30', updated_at: new Date('2026-10-20T06:00:00Z') };
// An event as Google returns it: an offset, and the zone it was written in.
const onCalendar = (start, end, extra = {}) => ({
  start: { dateTime: start, timeZone: 'America/Los_Angeles' },
  end: { dateTime: end, timeZone: 'America/Los_Angeles' },
  updated: '2026-10-21T14:47:08Z',
  ...extra,
});
const written = (w) => ({ extendedProperties: { private: { coachTime: eventFor(w, '2026-10-19').extendedProperties.private.coachTime } } });

test('wallOf reads a Google event in its own zone, whatever the offset', () => {
  const t = wallOf({ start: { dateTime: '2026-10-21T15:00:00-07:00', timeZone: 'Asia/Tokyo' }, end: { dateTime: '2026-10-21T16:30:00-07:00', timeZone: 'Asia/Tokyo' } });
  assert.deepEqual(t, { date: '2026-10-22', time: '07:00', endDate: '2026-10-22', endTime: '08:30', timeZone: 'Asia/Tokyo', minutes: 90 });
  assert.equal(wallOf({ start: { date: '2026-10-25' }, end: { date: '2026-10-26' } }).time, null);
});

test('the event Coach wrote carries its time, and reads back the same', () => {
  const body = eventFor(timed, '2026-10-19');
  assert.equal(body.extendedProperties.private.coachTime, '2026-10-21T07:00/2026-10-21T08:30@America/Los_Angeles');
  assert.equal(calendarWins(onCalendar('2026-10-21T07:00:00-07:00', '2026-10-21T08:30:00-07:00', written(timed)), timed, '2026-10-19'), false);
});

test('a move on the calendar wins over the time in Coach', () => {
  const e = onCalendar('2026-10-21T17:00:00-07:00', '2026-10-21T18:30:00-07:00', written(timed));
  assert.equal(calendarWins(e, timed, '2026-10-19'), true);
  assert.deepEqual(movedFields(wallOf(e)), { scheduled_date: '2026-10-21', start_time: '17:00', end_time: '18:30', time_zone: null, duration: 90 });
});

test('a change in Coach wins when the calendar still shows what Coach wrote', () => {
  const e = onCalendar('2026-10-21T07:00:00-07:00', '2026-10-21T08:30:00-07:00', written(timed));
  assert.equal(calendarWins(e, { ...timed, start_time: '12:00', end_time: '13:30' }, '2026-10-19'), false);
});

test('both changed: the later change wins', () => {
  const e = onCalendar('2026-10-21T17:00:00-07:00', '2026-10-21T18:30:00-07:00', written(timed));
  const changed = { ...timed, start_time: '12:00', end_time: '13:30' };
  assert.equal(calendarWins(e, { ...changed, updated_at: new Date('2026-10-21T10:00:00Z') }, '2026-10-19'), true);
  assert.equal(calendarWins(e, { ...changed, updated_at: new Date('2026-10-21T20:00:00Z') }, '2026-10-19'), false);
});

test('an event from before coachTime: moved when it differs and was edited after the workout', () => {
  const e = onCalendar('2026-10-21T17:00:00-07:00', '2026-10-21T18:30:00-07:00');
  assert.equal(calendarWins(e, timed, '2026-10-19'), true);
  assert.equal(calendarWins(e, { ...timed, updated_at: new Date('2026-10-21T20:00:00Z') }, '2026-10-19'), false);
});

test('a move to another day, and to all day', () => {
  const e = onCalendar('2026-10-24T09:00:00-07:00', '2026-10-24T10:00:00-07:00', written(timed));
  assert.equal(calendarWins(e, timed, '2026-10-19'), true);
  assert.equal(movedFields(wallOf(e)).scheduled_date, '2026-10-24');
  assert.deepEqual(movedFields(wallOf({ start: { date: '2026-10-27' }, end: { date: '2026-10-28' } })), { scheduled_date: '2026-10-27', start_time: null, end_time: null, time_zone: null });
});
