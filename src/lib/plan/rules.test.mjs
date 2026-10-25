import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkProposal, checkRules, meetingsOf, sessionsFromPlan, sessionsFromRows, todayOf } from './rules.mjs';

// Week of Mon 2026-11-02 (block week 3, a full week).
const W = '2026-11-02';
const ev = (day, from, to, title, over = {}) => ({ title, start: `${day}T${from}:00`, end: `${day}T${to}:00`, ...over });
const heavy = (day, from = '07:30', to = '08:30') => ev(day, from, to, '🏋️ Heavy barbell', { workoutType: 'strength-heavy', liftTemplate: 'Heavy barbell' });
const upper = (day, from = '08:00', to = '08:45') => ev(day, from, to, '🏋️ Upper (dumbbells)', { workoutType: 'strength-dumbbell', liftTemplate: 'Upper (dumbbells)' });
const easyRun = (day, from = '07:00', to = '07:20') => ev(day, from, to, '🏃 Easy run to the gym', { workoutType: 'run-easy' });
const threshold = (day) => ev(day, '07:00', '08:15', '🚴 Threshold A', { workoutType: 'ride-threshold-a' });
const vo2Run = (day) => ev(day, '07:00', '08:00', '🏃 VO2 A', { workoutType: 'run-vo2-a' });
const longRun = (day, mins = '09:40') => ev(day, '08:00', mins, '🏃 Long run', { workoutType: 'run-long' });
const longRide = (day) => ev(day, '08:00', '11:00', '🚴 Long ride', { workoutType: 'ride-long' });

/** A good full week: lifts Tue and Thu stacked after easy runs, quality Mon/Wed, long ride Sat, long run Sun. */
const good = () => ({
  weekStart: W,
  events: [
    threshold('2026-11-02'),
    easyRun('2026-11-03', '07:10', '07:30'), heavy('2026-11-03', '07:40', '08:40'),
    vo2Run('2026-11-04'),
    ev('2026-11-05', '07:00', '07:45', '🚴 Zwift easy', { workoutType: 'ride-z2' }), upper('2026-11-05', '07:45', '08:30'),
    longRide('2026-11-07'),
    longRun('2026-11-08'),
  ],
  rest: [{ day: '2026-11-06', reason: 'Rest' }],
});
const ids = (issues) => issues.map((i) => `${i.id}:${i.level}`);

test('a good week passes every rule', () => {
  const r = checkProposal(good(), { weekStart: W, request: { kind: 'weekly', hours: 10, gym: 2, daysOff: ['2026-11-06'] } });
  assert.deepEqual(r.issues, []);
  assert.equal(r.fails, 0);
});

test('R1: two sessions hours apart on one day fail; a 10-minute walk to the gym is one block', () => {
  const plan = good();
  plan.events[2] = heavy('2026-11-03', '17:30', '18:30');
  const r = checkProposal(plan, { weekStart: W });
  assert.deepEqual(ids(r.issues), ['R1:fail']);
  assert.match(r.issues[0].message, /10 h after/);
  assert.equal(r.issues[0].day, '2026-11-03');
  // 10 minutes between the run and the lift is fine.
  assert.deepEqual(checkProposal(good(), { weekStart: W }).issues, []);
});

test('R2: a run after a lift fails, even stacked straight after it', () => {
  const plan = good();
  plan.events[1] = easyRun('2026-11-03', '08:40', '09:00');
  assert.ok(ids(checkProposal(plan, { weekStart: W }).issues).includes('R2:fail'));
});

test('R3: a heavy lift on a quality day fails; the dumbbell lift on one is fine', () => {
  const plan = good();
  plan.events.push(heavy('2026-11-02', '08:15', '09:15'));
  plan.events.splice(1, 2); // Tuesday's run and heavy lift move to Monday
  const r = checkProposal(plan, { weekStart: W });
  assert.ok(ids(r.issues).includes('R3:fail'), ids(r.issues).join());
  const ok = good();
  ok.events.push(upper('2026-11-02', '08:15', '09:00'));
  assert.ok(!ids(checkProposal(ok, { weekStart: W }).issues).includes('R3:fail'));
});

test('R4: no lift fails, one lift warns, back-to-back lifts fail, a home mini session is not a lift', () => {
  const none = good();
  none.events = none.events.filter((e) => !e.liftTemplate);
  none.events.push(ev('2026-11-05', '18:00', '18:15', '💪 Arm finisher', { workoutType: 'strength-home' }));
  assert.ok(ids(checkProposal(none, { weekStart: W }).issues).includes('R4:fail'));
  const one = good();
  one.events = one.events.filter((e) => e.liftTemplate !== 'Upper (dumbbells)');
  assert.ok(ids(checkProposal(one, { weekStart: W }).issues).includes('R4:warn'));
  // A floor week: one lift is the plan.
  assert.ok(!ids(checkProposal({ ...one, title: 'Floor week: Lisbon' }, { weekStart: W }).issues).includes('R4:warn'));
  const b2b = good();
  b2b.events.push(upper('2026-11-04', '08:00', '08:45'));
  assert.ok(ids(checkProposal(b2b, { weekStart: W }).issues).includes('R4:fail'));
  // He asked for 1: one lift is what he wanted.
  assert.ok(!ids(checkProposal(one, { weekStart: W, request: { gym: 1 } }).issues).some((i) => i.startsWith('R4')));
});

test('R4: never miss twice puts the first lift on Monday or Tuesday', () => {
  const plan = good();
  plan.events.splice(1, 2);
  const context = { consistency: { lifts: { liftFirst: true, daysSince: 8 } } };
  const r = checkProposal(plan, { weekStart: W, context });
  assert.ok(r.issues.some((i) => i.id === 'R4' && /Never miss twice/.test(i.message)));
  assert.ok(!checkProposal(good(), { weekStart: W, context }).issues.some((i) => /Never miss twice/.test(i.message)));
});

test('R5: two hard days in a row fail; easy strides are not hard', () => {
  const plan = good();
  plan.events.push(vo2Run('2026-11-03'));
  plan.events.splice(1, 2);
  assert.ok(ids(checkProposal(plan, { weekStart: W }).issues).includes('R5:fail'));
  const strides = good();
  strides.events[1] = easyRun('2026-11-03', '07:10', '07:30');
  strides.events[1].intensity = 'Easy with 6 × 20 s strides (intervals)';
  assert.ok(!ids(checkProposal(strides, { weekStart: W }).issues).includes('R5:fail'));
});

test('R6: no long run fails; 75–89 min warns on a full week and passes on a floor week', () => {
  const none = good();
  none.events = none.events.filter((e) => e.workoutType !== 'run-long');
  assert.ok(ids(checkProposal(none, { weekStart: W }).issues).includes('R6:fail'));
  const short = good();
  short.events[short.events.length - 1] = ev('2026-11-08', '08:00', '09:20', '🏃 Steady run', { workoutType: 'run-easy' });
  assert.ok(ids(checkProposal(short, { weekStart: W }).issues).includes('R6:warn'));
  assert.ok(!ids(checkProposal({ ...short, context: ['Floor week: travel'] }, { weekStart: W }).issues).includes('R6:warn'));
  // A check-in whose long run is already done.
  const done = { ...none, completed: [{ day: '2026-11-02', session: '🏃 Run 18 km', tss: 120 }] };
  assert.ok(!ids(checkProposal(done, { weekStart: W }).issues).includes('R6:fail'));
});

test('R7: a session on a day off fails; one on top of a meeting warns; Coach events and all-day events are ignored', () => {
  const r = checkProposal(good(), { weekStart: W, request: { daysOff: ['2026-11-07'] } });
  assert.ok(ids(r.issues).includes('R7:fail'));
  const context = {
    calendarByWeek: [{
      weekStart: W,
      events: [
        // 07:00–08:00 PST on Wed 4 Nov (UTC−8): on top of the VO2 run.
        { summary: 'Call', start: '2026-11-04T15:00:00.000Z', end: '2026-11-04T16:00:00.000Z', allDay: false, tz: 'America/Los_Angeles' },
        { summary: 'Threshold A', start: '2026-11-02T15:00:00.000Z', end: '2026-11-02T16:15:00.000Z', allDay: false, coach: true },
        { summary: 'Holiday', start: '2026-11-05T00:00:00.000Z', end: '2026-11-06T00:00:00.000Z', allDay: true },
      ],
    }],
  };
  assert.deepEqual(meetingsOf(context, W), [{ day: '2026-11-04', start: 420, end: 480 }]);
  const m = checkProposal(good(), { weekStart: W, context });
  assert.deepEqual(ids(m.issues), ['R7:warn']);
  assert.equal(m.issues[0].day, '2026-11-04');
});

test('R8: over the hours he has fails', () => {
  assert.ok(ids(checkProposal(good(), { weekStart: W, request: { hours: 5 } }).issues).includes('R8:fail'));
});

test('R17: a check-in never plans a past day', () => {
  const r = checkProposal(good(), { weekStart: W, request: { kind: 'checkin' }, today: '2026-11-04' });
  assert.equal(r.issues.filter((i) => i.id === 'R17').length, 3);
  assert.equal(todayOf({ generatedAt: '2026-11-04T05:00:00.000Z', home: { tz: 'America/Los_Angeles' } }), '2026-11-03');
});

test('a week in Coach (training_plan_activities rows) gets the same checks', () => {
  const rows = [
    { scheduled_date: '2026-11-03', start_time: '07:00', end_time: '07:20', duration: 20, title: 'Easy run', activity_type: 'run', workout_type: 'run-easy' },
    { scheduled_date: '2026-11-03', start_time: '17:00', end_time: '18:00', duration: 60, title: 'Heavy barbell', activity_type: 'strength', workout_type: 'strength-heavy', lift_template: 'Heavy barbell' },
    { scheduled_date: '2026-11-06', start_time: null, end_time: null, duration: 0, title: 'Rest day', activity_type: 'rest' },
  ];
  const s = sessionsFromRows(rows);
  assert.equal(s.length, 2);
  const r = checkRules(s, { weekStart: W });
  assert.deepEqual(ids(r).sort(), ['R1:fail', 'R4:warn', 'R6:fail']);
});

test('sessions keep the plan as written, before the import stacks the day', () => {
  const s = sessionsFromPlan({ events: [heavy('2026-11-03', '17:30', '18:30'), { title: 'Rest day', start: '2026-11-06' }] });
  assert.deepEqual(s.map((x) => [x.start, x.end, x.minutes]), [[1050, 1110, 60]]);
});
