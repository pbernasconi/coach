import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canChangePlan, cleanLiftLink, cleanPlanDate, cleanPlanStatus } from './app-status.mjs';

test('a status is done, planned or skipped; only a skip keeps a reason', () => {
  assert.deepEqual(cleanPlanStatus({ status: 'done', reason: 'x' }), { status: 'done', reason: null });
  assert.deepEqual(cleanPlanStatus({ status: 'skipped', reason: ' sore ' }), { status: 'skipped', reason: 'sore' });
  assert.deepEqual(cleanPlanStatus({ status: 'planned' }), { status: 'planned', reason: null });
  assert.ok('error' in cleanPlanStatus({ status: 'missed' }));
  assert.ok('error' in cleanPlanStatus(undefined));
});

test('a Lift link is a UUID, kept in lower case', () => {
  assert.deepEqual(cleanLiftLink({ sessionId: 'A1B2C3D4-0000-4000-8000-00000000000F' }), {
    sessionId: 'a1b2c3d4-0000-4000-8000-00000000000f',
  });
  assert.ok('error' in cleanLiftLink({ sessionId: 'nope' }));
  assert.ok('error' in cleanLiftLink(null));
});

test('a move names a real day', () => {
  assert.deepEqual(cleanPlanDate({ date: '2026-10-24' }), { date: '2026-10-24' });
  assert.deepEqual(cleanPlanDate({ date: ' 2026-10-24 ' }), { date: '2026-10-24' });
  assert.ok('error' in cleanPlanDate({ date: '2026-02-30' }));
  assert.ok('error' in cleanPlanDate({ date: '24/10/2026' }));
  assert.ok('error' in cleanPlanDate({}));
  assert.ok('error' in cleanPlanDate(undefined));
});

test('only a workout not done yet can move or go', () => {
  assert.equal(canChangePlan({ state: 'planned' }), true);
  assert.equal(canChangePlan({ state: 'missed' }), true);
  assert.equal(canChangePlan({ state: 'skipped' }), true);
  assert.equal(canChangePlan({ state: 'done' }), false);
  assert.equal(canChangePlan(null), false);
});
