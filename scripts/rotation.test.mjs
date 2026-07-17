#!/usr/bin/env node --test
/**
 * Tests for rotation.mjs — the bike VO2 <-> run intervals alternation.
 *
 * Uses a temp plans dir so the real plans/ is never touched.
 *
 * Run: npm test
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rotationState } from './rotation.mjs';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'coach-rotation-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const plan = (key, events) => writeFileSync(join(dir, `${key}.json`), JSON.stringify({ weekStart: key, events }));
const q = (type, start) => ({ title: type, start, end: start, workoutType: type });

test('last quality was bike => next is run', () => {
  plan('2026-07-06', [q('ride-vo2', '2026-07-10T08:00:00')]);
  const r = rotationState(dir, '2026-07-13');
  assert.deepEqual(r, { lastQuality: 'ride-vo2', lastQualityWeek: '2026-07-06', nextQuality: 'run-intervals' });
});

test('last quality was run => next is bike', () => {
  plan('2026-07-06', [q('run-intervals', '2026-07-08T08:00:00')]);
  assert.equal(rotationState(dir, '2026-07-13').nextQuality, 'ride-vo2');
});

test('ride-sst also counts as bike quality', () => {
  plan('2026-07-06', [q('ride-sst', '2026-07-08T08:00:00')]);
  assert.equal(rotationState(dir, '2026-07-13').nextQuality, 'run-intervals');
});

test('run-tempo counts as run quality', () => {
  plan('2026-07-06', [q('run-tempo', '2026-07-08T08:00:00')]);
  assert.equal(rotationState(dir, '2026-07-13').nextQuality, 'ride-vo2');
});

test('ignores the week being planned, so re-running /plan does not flip rotation', () => {
  // THE ACTUAL BUG THIS GUARDS: if rotation read the target week's own output, a
  // second /plan run for the same week would see its own ride-vo2 and flip to
  // run-intervals, quietly rewriting the plan on every re-run.
  plan('2026-07-06', [q('ride-vo2', '2026-07-10T08:00:00')]);
  plan('2026-07-13', [q('ride-vo2', '2026-07-17T08:00:00')]); // the week we're planning
  const r = rotationState(dir, '2026-07-13');
  assert.equal(r.lastQualityWeek, '2026-07-06', 'must not read its own week');
  assert.equal(r.nextQuality, 'run-intervals');
});

test('walks backwards past weeks with no quality session', () => {
  plan('2026-06-22', [q('run-intervals', '2026-06-24T08:00:00')]);
  plan('2026-06-29', [{ title: 'easy', start: '2026-07-01T08:00:00', workoutType: 'run-easy' }]);
  plan('2026-07-06', [{ title: 'rest', start: '2026-07-08T08:00:00', workoutType: 'recovery' }]);
  const r = rotationState(dir, '2026-07-13');
  assert.equal(r.lastQualityWeek, '2026-06-22');
  assert.equal(r.nextQuality, 'ride-vo2');
});

test('picks the LAST quality session within a week, by start time', () => {
  plan('2026-07-06', [
    q('ride-vo2', '2026-07-07T08:00:00'),
    q('run-intervals', '2026-07-10T08:00:00'), // later => this one wins
  ]);
  const r = rotationState(dir, '2026-07-13');
  assert.equal(r.lastQuality, 'run-intervals');
  assert.equal(r.nextQuality, 'ride-vo2');
});

test('no prior plans => defaults to ride-vo2', () => {
  assert.deepEqual(rotationState(dir, '2026-07-13'), { lastQuality: null, lastQualityWeek: null, nextQuality: 'ride-vo2' });
});

test('malformed JSON is skipped, not fatal', () => {
  plan('2026-06-29', [q('run-intervals', '2026-07-01T08:00:00')]);
  writeFileSync(join(dir, '2026-07-06.json'), '{ this is not json');
  const r = rotationState(dir, '2026-07-13');
  assert.equal(r.lastQualityWeek, '2026-06-29', 'skipped the broken file and kept looking');
});

test('plan with no events key is skipped safely', () => {
  writeFileSync(join(dir, '2026-07-06.json'), JSON.stringify({ weekStart: '2026-07-06' }));
  assert.equal(rotationState(dir, '2026-07-13').nextQuality, 'ride-vo2');
});

test('missing plans dir => defaults rather than throwing', () => {
  assert.equal(rotationState(join(dir, 'does-not-exist'), '2026-07-13').nextQuality, 'ride-vo2');
});

test('ignores non-plan files in the dir', () => {
  plan('2026-07-06', [q('ride-vo2', '2026-07-10T08:00:00')]);
  writeFileSync(join(dir, 'PLAN-STRUCTURE.md'), '# not a plan');
  writeFileSync(join(dir, '.gitkeep'), '');
  assert.equal(rotationState(dir, '2026-07-13').lastQualityWeek, '2026-07-06');
});
