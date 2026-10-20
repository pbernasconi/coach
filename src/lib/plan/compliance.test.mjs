import { test } from 'node:test';
import assert from 'node:assert/strict';
import { complianceOf, levelForRatio } from './compliance.mjs';

test('ratio bands follow TrainingPeaks', () => {
  assert.equal(levelForRatio(1), 'good');
  assert.equal(levelForRatio(0.8), 'good');
  assert.equal(levelForRatio(1.2), 'good');
  assert.equal(levelForRatio(0.79), 'partial');
  assert.equal(levelForRatio(0.5), 'partial');
  assert.equal(levelForRatio(1.5), 'partial');
  assert.equal(levelForRatio(0.49), 'off');
  assert.equal(levelForRatio(1.51), 'off');
});

test('duration comes before TSS', () => {
  const c = complianceOf({ duration: 60, tss: 50 }, 'done', { min: 30, tss: 50 });
  assert.equal(c.basis, 'duration');
  assert.equal(c.level, 'partial');
  assert.equal(c.ratio, 0.5);
});

test('TSS when a duration is missing', () => {
  const c = complianceOf({ duration: null, tss: 80 }, 'done', { min: 60, tss: 40 });
  assert.equal(c.basis, 'tss');
  assert.equal(c.level, 'partial');
  assert.equal(complianceOf({ duration: 0, tss: 80 }, 'done', { min: 60, tss: 200 }).level, 'off');
});

test('done with nothing to compare (a Lift session) is done', () => {
  assert.equal(complianceOf({ duration: 45 }, 'done', { min: null, tss: null }).level, 'done');
  assert.equal(complianceOf({ duration: 45 }, 'done', null).level, 'done');
});

test('states with no match', () => {
  assert.equal(complianceOf({ duration: 45 }, 'missed', null).level, 'missed');
  assert.equal(complianceOf({ duration: 45 }, 'skipped', null).level, 'skipped');
  assert.equal(complianceOf({ duration: 45 }, 'planned', null).level, 'planned');
  assert.equal(complianceOf({ duration: 45 }, 'today', null).level, 'today');
  assert.equal(complianceOf({ duration: 0 }, 'done', null, { rest: true }).level, 'rest');
});

test('a skipped rest day reads skipped', () => {
  assert.equal(complianceOf({}, 'skipped', null, { rest: true }).level, 'skipped');
});

test('labels name the level', () => {
  assert.equal(complianceOf({ duration: 60 }, 'done', { min: 60 }).label, 'On target');
  assert.equal(complianceOf({ duration: 60 }, 'missed', null).label, 'Missed');
});
