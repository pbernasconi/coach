import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breakdownHref, shortDay, stepText, tintSwatch, workoutHref } from './coachText.mjs';

test('status words for each step, Thinking for an unknown one', () => {
  assert.equal(stepText('reading'), 'Reading your week');
  assert.equal(stepText('fixing'), 'Fixing a clash');
  assert.equal(stepText('nope'), 'Thinking');
});

test('a planned workout opens in the Plan calendar, an unplanned activity on its page', () => {
  assert.equal(workoutHref({ id: 'abc', date: '2026-10-27' }), '/plan?week=2026-10-27&open=w-abc');
  assert.equal(workoutHref({ id: 'activity-123', date: '2026-10-27', unplanned: true }), '/activities/123');
  assert.equal(workoutHref({ id: 'x', date: 'bad' }), '/plan');
});

test('breakdown links and colours', () => {
  assert.equal(breakdownHref('plan'), '/plan');
  assert.equal(breakdownHref('other'), null);
  assert.equal(tintSwatch('run'), 6);
  assert.equal(tintSwatch(undefined), 3);
});

test('short day', () => {
  assert.equal(shortDay('2026-10-26'), 'Mon 26 Oct');
});
