import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockWeek, liftConsistency } from './consistency.mjs';

test('liftConsistency: counts lift days in the last 28, before today', () => {
  const c = liftConsistency(['2026-09-20', '2026-10-06', '2026-10-20', '2026-10-20', '2026-10-24'], '2026-10-24');
  assert.equal(c.last28, 2);
  assert.equal(c.target28, 8);
  assert.equal(c.lastDay, '2026-10-20');
  assert.equal(c.daysSince, 4);
  assert.equal(c.liftFirst, false);
});

test('liftConsistency: 6+ days since the last lift puts a lift first', () => {
  assert.equal(liftConsistency(['2026-10-18'], '2026-10-25').liftFirst, true);
  assert.equal(liftConsistency([], '2026-10-25').liftFirst, true);
});

test('blockWeek: 4-week blocks from the anchor, week 4 is the lighter one', () => {
  assert.equal(blockWeek('2026-10-19'), 1);
  assert.equal(blockWeek('2026-10-26'), 2);
  assert.equal(blockWeek('2026-11-09'), 4);
  assert.equal(blockWeek('2026-11-16'), 1);
  assert.equal(blockWeek('2026-10-12'), 4);
});
