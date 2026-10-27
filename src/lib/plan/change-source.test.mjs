import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSource, withPlanSource } from './change-source.mjs';

test('planSource: the nearest withPlanSource, across awaits', async () => {
  assert.equal(planSource(), 'web');
  assert.equal(planSource('script'), 'script');
  await withPlanSource('app', async () => {
    await new Promise((r) => setTimeout(r, 1));
    assert.equal(planSource(), 'app');
    await withPlanSource('chat', async () => assert.equal(planSource(), 'chat'));
    assert.equal(planSource(), 'app');
  });
  assert.equal(planSource(), 'web');
});
