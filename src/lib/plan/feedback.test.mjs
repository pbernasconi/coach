import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanFeedback, feedbackBlock, feedbackLine, rpeLabel } from './feedback.mjs';

test('cleanFeedback keeps a good save', () => {
  const r = cleanFeedback({ item: 'plan:abc-1', date: '2026-10-21', feel: 4, rpe: '8', comment: '  legs heavy ', planActivityId: 'abc-1' });
  assert.deepEqual(r, { item: 'plan:abc-1', date: '2026-10-21', feel: 4, rpe: 8, comment: 'legs heavy', title: null, planActivityId: 'abc-1' });
});

test('cleanFeedback clears empty values', () => {
  const r = cleanFeedback({ item: 'strava:123', date: '2026-10-21', feel: null, rpe: '', comment: ' ' });
  assert.equal(r.feel, null);
  assert.equal(r.rpe, null);
  assert.equal(r.comment, null);
});

test('cleanFeedback refuses bad values', () => {
  assert.ok(cleanFeedback({ item: 'x:1', date: '2026-10-21' }).error);
  assert.ok(cleanFeedback({ item: 'lift:1', date: 'today' }).error);
  assert.ok(cleanFeedback({ item: 'lift:1', date: '2026-10-21', rpe: 11 }).error);
  assert.ok(cleanFeedback({ item: 'lift:1', date: '2026-10-21', feel: 2.5 }).error);
});

test('feedbackLine and rpeLabel', () => {
  assert.equal(rpeLabel(8), 'Extremely hard');
  assert.equal(feedbackLine({ feel: 2, rpe: 7, comment: 'tired\nlegs' }), 'felt weak · RPE 7 (very hard) · "tired legs"');
  assert.equal(feedbackLine({ feel: null, rpe: null, comment: null }), '');
});

test('feedbackBlock saves under the row it found, with the scales', () => {
  const empty = feedbackBlock({ item: 'lift:abc', date: '2026-10-21', title: 'Workout A', planActivityId: null, row: null });
  assert.equal(empty.item, 'lift:abc');
  assert.equal(empty.feel, null);
  assert.equal(empty.feelLabels.length, 5);
  assert.deepEqual(empty.rpeScale[6], { value: 7, label: 'Very hard', detail: 'A few words at a time.' });
  const found = feedbackBlock({ item: 'lift:abc', date: '2026-10-21', title: null, planActivityId: 'p1', row: { item: 'plan:p1', feel: 4, rpe: 7, comment: 'ok' } });
  assert.equal(found.item, 'plan:p1');
  assert.equal(found.rpe, 7);
  assert.equal(found.comment, 'ok');
});
