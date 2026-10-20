#!/usr/bin/env node --test
/**
 * Tests for rotation.mjs: the PDF's workout order (Threshold A → VO2 A → VO2 B → Threshold B → Threshold A → VO2 A),
 * the last result of each bank workout, and when a 10k test is due.
 *
 * Run: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextIndex, ORDER, parseType, rotationFromPlans } from './rotation.mjs';

const ev = (workoutType, start, extra = {}) => ({ workoutType, start, ...extra });

test('no history starts at Threshold A', () => {
  const r = rotationFromPlans([], '2026-10-26');
  assert.deepEqual(r.next, ['threshold-a', 'vo2-a', 'vo2-b']);
  assert.equal(r.test10kDue, true);
  assert.equal(r.lastTest10k, null);
});

test('the order goes on across weeks and sports', () => {
  const plans = [
    { weekStart: '2026-10-12', events: [ev('ride-threshold-a', '2026-10-12T07:00'), ev('run-vo2-a', '2026-10-14T07:00')] },
    { weekStart: '2026-10-19', events: [ev('ride-vo2-b', '2026-10-21T07:00'), ev('run-easy', '2026-10-22T07:00')] },
  ];
  assert.deepEqual(rotationFromPlans(plans, '2026-10-26').next, ['threshold-b', 'threshold-a', 'vo2-a']);
});

test('repeated names are told apart by the longer history', () => {
  // TA VA VB TB TA VA → the cycle ends, next is TA (place 0).
  assert.equal(nextIndex(ORDER), 0);
  // TA VA → place 2 (VB), not place 0.
  assert.equal(nextIndex(['threshold-a', 'vo2-a']), 2);
  // TB TA VA → the second TA VA of the cycle, so next is TA again.
  assert.equal(nextIndex(['threshold-b', 'threshold-a', 'vo2-a']), 0);
  // TB TA → next is VO2 A (place 5).
  assert.equal(nextIndex(['threshold-b', 'threshold-a']), 5);
});

test('old types, tempo and tests are outside the order', () => {
  const plans = [{ weekStart: '2026-10-12', events: [
    ev('ride-threshold-a', '2026-10-12T07:00'),
    ev('ride-vo2', '2026-10-13T07:00'),
    ev('run-tempo', '2026-10-14T07:00'),
    ev('run-test-10k', '2026-10-17T07:00'),
  ] }];
  const r = rotationFromPlans(plans, '2026-10-19');
  assert.equal(r.next[0], 'vo2-a');
  assert.equal(r.lastTest10k, '2026-10-17');
  assert.equal(r.weeksSinceTest10k, 0);
  assert.equal(r.test10kDue, false);
  assert.ok(r.last.tempo);
});

test('the last of each bank workout keeps its prescription and whether it was done', () => {
  const plans = [
    { weekStart: '2026-10-05', events: [ev('ride-threshold-a', '2026-10-05T07:00', { intensity: '6×5 min Z4 top', done: true })] },
    { weekStart: '2026-10-12', events: [ev('run-threshold-a', '2026-10-16T07:00', { intensity: '7×5 min Z4 top', done: false })] },
  ];
  assert.deepEqual(rotationFromPlans(plans, '2026-10-19').last['threshold-a'], {
    date: '2026-10-16', sport: 'run', intensity: '7×5 min Z4 top', done: false,
  });
});

test('plans on or after the target week are ignored', () => {
  const plans = [{ weekStart: '2026-10-19', events: [ev('ride-threshold-a', '2026-10-19T07:00')] }];
  assert.equal(rotationFromPlans(plans, '2026-10-19').next[0], 'threshold-a');
});

test('a 10k test is due after 6 weeks', () => {
  const plans = [{ weekStart: '2026-09-07', events: [ev('run-test-10k', '2026-09-12T07:00')] }];
  assert.equal(rotationFromPlans(plans, '2026-10-19').weeksSinceTest10k, 5);
  assert.equal(rotationFromPlans(plans, '2026-10-19').test10kDue, false);
  assert.equal(rotationFromPlans(plans, '2026-10-26').test10kDue, true);
});

test('parseType', () => {
  assert.deepEqual(parseType('run-vo2-b'), { sport: 'run', bank: 'vo2-b' });
  assert.equal(parseType('ride-vo2'), null);
  assert.equal(parseType(null), null);
});
