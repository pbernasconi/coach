import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkoutRef, workoutResponse } from './unified.mjs';

test('parseWorkoutRef: a plan workout or a Strava activity', () => {
  assert.deepEqual(parseWorkoutRef('plan-6f1c2a9e-0000-4000-8000-000000000001'), { kind: 'plan', id: '6f1c2a9e-0000-4000-8000-000000000001' });
  assert.deepEqual(parseWorkoutRef('strava-16234567890'), { kind: 'strava', id: '16234567890' });
  assert.equal(parseWorkoutRef('lift-1'), null);
  assert.equal(parseWorkoutRef('plan-'), null);
  assert.equal(parseWorkoutRef('plan-1;drop'), null);
});

test('workoutResponse: planned, not done yet', () => {
  const body = workoutResponse({ plan: { id: 'p1', title: 'Threshold A', done: null, feedback: { item: 'plan:p1' } }, activity: null });
  assert.equal(body.ref, 'plan-p1');
  assert.equal(body.state, 'planned');
  assert.equal(body.activity, null);
  assert.equal(body.plan.feedback, undefined, 'one feedback, at the top');
  assert.deepEqual(body.feedback, { item: 'plan:p1' });
});

test('workoutResponse: planned and done, as one', () => {
  const body = workoutResponse({
    plan: { id: 'p1', title: 'Easy run + strides', done: { activityId: '42', name: 'Lunch Run' }, feedback: { item: 'plan:p1' } },
    activity: { activityId: '42', header: { name: 'Lunch Run' }, feedback: { item: 'strava:42' } },
  });
  assert.equal(body.ref, 'plan-p1');
  assert.equal(body.state, 'done');
  assert.equal(body.title, 'Easy run + strides');
  assert.equal(body.activity.activityId, '42');
  assert.deepEqual(body.feedback, { item: 'strava:42' });
});

test('workoutResponse: done without a plan', () => {
  const body = workoutResponse({ plan: null, activity: { activityId: '42', header: { name: 'Lunch Run' }, feedback: null } });
  assert.equal(body.ref, 'strava-42');
  assert.equal(body.title, 'Lunch Run');
  assert.equal(body.plan, null);
  assert.equal(body.feedback, null);
});
