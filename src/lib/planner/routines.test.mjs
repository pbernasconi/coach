import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandRoutines, ROUTINES, routineLines, summaryOf } from './routines.mjs';
import { isPhysio, sessionsFromPlan } from '../plan/rules.mjs';

test('every routine has its lines in plan-structure.md', () => {
  for (const [key, r] of Object.entries(ROUTINES)) {
    const lines = routineLines(r.heading);
    assert.ok(lines && lines.length > 100, key);
    assert.ok(!lines.includes('**'), `${key} starts after its heading`);
  }
  assert.match(routineLines('Physio B — Knee & hip'), /^1\) Single-leg step down 3x8/);
  assert.match(routineLines('Arm finisher'), /^Supersets, 60 s rest/);
  assert.match(routineLines('Mobility'), /^After long rides/);
});

test('a routine event gets its lines, title and type; the coach note goes first', () => {
  const plan = { events: [
    { routine: 'physio-a', start: '2026-11-10T07:00:00', end: '2026-11-10T07:20:00', why: 'Day after the long run.' },
    { routine: 'back-hip-stretch', title: '🧘 Stretch after the ride', description: 'Gentle today.', start: '2026-11-10T18:00:00' },
    { title: '🚴 Ride', start: '2026-11-11T07:00:00' },
  ] };
  const { plan: out, problems } = expandRoutines(plan);
  assert.deepEqual(problems, []);
  assert.equal(out.events[0].title, '🩹 Physio A: Achilles & calf');
  assert.equal(out.events[0].workoutType, 'strength-home');
  assert.match(out.events[0].description, /^Calf foam roll[\s\S]*1\) Single-leg bent-knee calf raise 2x8/);
  assert.equal(out.events[1].title, '🧘 Stretch after the ride');
  assert.match(out.events[1].description, /^Gentle today\.\n1\) Cat-cow 1x10/);
  assert.equal(out.events[2], plan.events[2]);
  // The physio check (R9) still counts it.
  assert.ok(isPhysio(sessionsFromPlan(out)[0]));
});

test('an unknown routine is a problem; a description that has the lines is kept', () => {
  assert.match(expandRoutines({ events: [{ routine: 'yoga-flow', start: 'x' }] }).problems[0], /routine "yoga-flow"/);
  const once = expandRoutines({ events: [{ routine: 'knee-calf-mini', start: 'x' }] }).plan;
  assert.equal(expandRoutines(once).plan.events[0].description, once.events[0].description);
});

test('summary from the review', () => {
  const s = summaryOf({ review: { headline: 'H', reasoning: ['r'], decisions: [{ title: 'T', why: 'W', tradeoff: 'X' }], watch: ['w'] } });
  assert.equal(s, 'H\n- r\n- T: W (X)\n- Watch: w');
  assert.equal(summaryOf({}), null);
});
