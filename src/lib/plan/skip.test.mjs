import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanReason, feelForSkip, isFatigue, skipText } from './skip.mjs';

test('cleanReason keeps known reasons only', () => {
  assert.equal(cleanReason(' Tired '), 'tired');
  assert.equal(cleanReason('bored'), null);
  assert.equal(cleanReason(null), null);
});

test('fatigue reasons', () => {
  assert.ok(isFatigue('tired') && isFatigue('sick') && isFatigue('sore'));
  assert.ok(!isFatigue('busy') && !isFatigue('travel') && !isFatigue(null));
});

test('feelForSkip: only today, only fatigue', () => {
  assert.equal(feelForSkip('tired', '2026-10-21', '2026-10-21'), 'tired');
  assert.equal(feelForSkip('sore', '2026-10-21', '2026-10-21'), 'tired');
  assert.equal(feelForSkip('sick', '2026-10-21', '2026-10-21'), 'wrecked');
  assert.equal(feelForSkip('busy', '2026-10-21', '2026-10-21'), null);
  assert.equal(feelForSkip('tired', '2026-10-20', '2026-10-21'), null);
  assert.equal(feelForSkip('tired', '2026-10-22', '2026-10-21'), null);
});

test('skipText', () => {
  assert.equal(skipText('tired'), 'Skipped · Tired');
  assert.equal(skipText(null), 'Skipped');
});
