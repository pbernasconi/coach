import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formWord, planningContext } from './planning-context.mjs';

const base = {
  load: [
    { date: '2026-10-15', ctl: 54, atl: 40, tsb: 14 },
    { date: '2026-10-22', ctl: 52, atl: 39, tsb: 13 },
  ],
  weeks: [
    { monday: '2026-10-12', tss: 400, min: 480, sessions: 7 },
    { monday: '2026-10-05', tss: 300, min: 360, sessions: 6 },
  ],
  readiness: { status: 'good', flags: [], sleep: { totalMin: 412, avg7: 420 }, garmin: { sleepScore: { value: 81 }, trainingReadiness: { value: 72 } } },
  feedback: [
    { date: '2026-10-20', title: 'VO2', feel: 4, rpe: 8 },
    { date: '2026-10-18', title: 'Long run', feel: 4, rpe: 6 },
  ],
  skips: [],
  events: [{ name: '10k test', date: '2026-10-30', priority: 'B', days: 8 }],
  calendar: [
    { date: '2026-10-29', title: 'Dentist', allDay: false, start: '12:00', minutes: 120 },
    { date: '2026-10-31', title: 'Halloween', allDay: true, start: null, minutes: 0 },
    { date: '2026-10-30', title: "Sam's birthday", allDay: true, start: null, minutes: 0 },
  ],
  weekStart: '2026-10-26',
  today: '2026-10-22',
};

test('facts from the data, and a fresh suggestion when form and readiness are good', () => {
  const c = planningContext(base);
  const byId = Object.fromEntries(c.facts.map((f) => [f.id, f]));
  assert.equal(byId.fitness.value, '52 CTL');
  assert.equal(byId.fitness.note, '-2 in 7 days');
  assert.equal(byId.form.value, '+13');
  assert.equal(byId.volume.value, '7 h / wk');
  assert.equal(byId.readiness.value, '72');
  assert.match(byId.readiness.note, /sleep 6:52 h/);
  assert.equal(byId.feel.value, 'Strong');
  assert.equal(byId.event.note, 'in 8 days');
  assert.match(byId.calendar.value, /Sat Halloween/);
  assert.doesNotMatch(byId.calendar.value, /birthday/);
  assert.equal(byId.skips, undefined);
  assert.equal(planningContext({ ...base, feedback: base.feedback.slice(0, 1) }).facts.find((f) => f.id === 'feel'), undefined);
  assert.equal(c.suggested.feel, 'fresh');
  assert.equal(c.suggested.hours, 7);
  assert.equal(c.days['2026-10-29'], '12:00 Dentist');
});

test('tired skips or deep fatigue suggest an easier week', () => {
  const skips = [{ date: '2026-10-20', title: 'Run', reason: 'tired' }, { date: '2026-10-21', title: 'Ride', reason: 'sore' }];
  assert.equal(planningContext({ ...base, skips }).suggested.feel, 'fatigued');
  assert.match(planningContext({ ...base, skips }).suggested.feelWhy, /2 tired skips/);
  const deep = { ...base, load: [{ date: '2026-10-22', ctl: 60, atl: 90, tsb: -30 }] };
  assert.equal(planningContext(deep).suggested.feel, 'recovery');
  assert.equal(formWord(-30), 'very tired');
});

test('no data gives no facts and no suggestion beyond normal', () => {
  const c = planningContext({ ...base, load: [], weeks: [], readiness: null, feedback: [], events: [], calendar: [] });
  assert.deepEqual(c.facts, []);
  assert.equal(c.suggested.feel, 'normal');
  assert.equal(c.suggested.hours, null);
});
