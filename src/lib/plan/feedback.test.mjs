import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanFeedback, feedbackLine, rpeLabel } from './feedback.mjs';

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
