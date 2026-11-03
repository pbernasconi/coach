import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freeSlots, hm, plannerApp, weekLabel } from './planner-app.mjs';

const ev = (index, date, start, minutes, extra = {}) => ({
  index, title: `S${index}`, date, start, minutes, sport: 'ride', hard: false, why: null, description: null, tss: 50, ...extra,
});

const week = (over = {}) => ({
  weekStart: '2026-11-09',
  today: '2026-11-02',
  proposal: {
    id: 'p1', status: 'proposed', version: 2, error: null, summary: 'x',
    request: { weekStart: '2026-11-09', kind: 'weekly', hours: 7, gym: 2, daysOff: ['2026-11-13'], lock: 'Geneva Thu' },
    review: { headline: 'Steady', reasoning: [], decisions: [], watch: [] },
    checks: { fails: 1, warns: 0, issues: [{ level: 'fail', message: 'Two rides on Wed', rule: 'R1' }] },
  },
  events: [
    ev(0, '2026-11-09', '07:00', 60, { title: 'Heavy barbell', sport: 'strength' }),
    ev(1, '2026-11-11', '12:15', 60, { title: 'Threshold A', hard: true }),
    ev(2, '2026-11-14', '07:30', 90, { title: 'Long run', sport: 'run' }),
  ],
  change: { changed: [{ what: 'Long run', how: 'Sat 7:30' }], gaveUp: null, note: 'Move the long run' },
  calendar: [{ date: '2026-11-11', title: 'OB appointment', allDay: false, start: '09:00', minutes: 60 }],
  context: { facts: [{ id: 'ctl', label: 'Fitness', value: '84 CTL' }, { id: 'calendar', label: 'Calendar', value: 'x' }], days: {}, suggested: { feel: 'normal', feelWhy: null, hours: 8 } },
  lastWeek: {
    monday: '2026-11-02', ongoing: true, doneMin: 43, plannedMin: 625, planned: 8, done: 1, missed: 0, skipped: 0,
    lifts: { planned: 2, done: 0 }, hard: { planned: 3, done: 0 },
    days: [{ date: '2026-11-02', items: [{ title: 'Easy run', sport: 'run', level: 'done' }, { title: 'Lower', sport: 'strength', level: 'missed' }] }],
  },
  ...over,
});

test('labels', () => {
  assert.equal(hm(75), '1h15');
  assert.equal(hm(40), '40 min');
  assert.equal(weekLabel('2026-11-09'), 'Nov 9–15');
  assert.equal(weekLabel('2026-10-26'), 'Oct 26 – Nov 1');
});

test('a proposed draft: totals, checks, days, change and last week', () => {
  const a = plannerApp(week());
  assert.equal(a.state, 'proposed');
  assert.equal(a.titleText, 'Plan Nov 9–15');
  assert.equal(a.totalsText, '3h30 of 7h · 1 lift · 1 hard');
  assert.deepEqual(a.checks, { tone: 'bad', text: '1 check failed' });
  assert.equal(a.days[0].totalText, '1h');
  assert.equal(a.days[1].totalText, 'Off');
  assert.equal(a.days[1].off, true);
  assert.equal(a.days[2].sessions[0].timeText, '12:15');
  assert.equal(a.days[5].sessions[0].changed, true);
  assert.equal(a.days[2].calendar[0].timeText, '9:00');
  assert.deepEqual(a.facts.map((f) => f.id), ['ctl']);
  assert.equal(a.lastWeek.days[0].tone, 'bad');
  assert.equal(a.answers.lock, 'Geneva Thu');
  assert.equal(a.issues.length, 1);
  assert.equal(a.days[2].freeText, 'Free 6:00–9:00, 10:00–21:00');
  assert.equal(a.lastWeek.titleText, 'This week so far');
  assert.deepEqual(a.suggested.away, []);
  assert.equal(a.lastWeek.days[0].missedText, 'Missed: Lower');
  assert.deepEqual(a.versus[0], { label: 'Time', beforeText: '43 min', afterText: '3h30' });
  assert.deepEqual(a.keepers.map((k) => `${k.title} ${k.dayText}`), ['Heavy barbell Mon', 'Threshold A Wed', 'Long run Sat']);
});

test('no draft and drafting show no sessions or off days', () => {
  for (const status of [null, 'running']) {
    const a = plannerApp(week({ proposal: status ? { ...week().proposal, status } : null }));
    assert.equal(a.state, status ? 'drafting' : 'none');
    assert.equal(a.totalsText, null);
    assert.ok(a.days.every((d) => d.sessions.length === 0 && !d.off && d.totalText == null));
    assert.equal(a.days[2].calendar.length, 1);
  }
});

test('free slots avoid the calendar and keep one block a day', () => {
  const w = week();
  const slots = freeSlots(w, w.events[1]);
  // Wed first: the OB appointment 9-10 is busy, so 6:30 fits.
  assert.deepEqual(slots[0], { date: '2026-11-11', time: '06:30' });
  // Mon has the lift at 7:00: the ride goes straight before or after it.
  const mon = slots.find((s) => s.date === '2026-11-09');
  assert.ok(mon && (mon.time === '06:00' || mon.time === '08:00'));
});
