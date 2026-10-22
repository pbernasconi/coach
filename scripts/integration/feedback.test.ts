// How a workout felt on a real Postgres (src/lib/plan/feedback.ts): save, update, find it from another view of the
// same planned workout, and clear it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { cleanFeedback } from '@/lib/plan/feedback.mjs';
import { loadFeedback, saveFeedback } from '@/lib/plan/feedback';

const user = 'user_feedback';

test('save, update, find and clear workout feedback', async () => {
  await sql`DELETE FROM workout_feedback WHERE user_id = ${user}`;
  try {
    const row = cleanFeedback({ item: 'plan:w1', date: '2026-10-21', title: 'Threshold A', feel: 4, rpe: 8, comment: 'legs heavy', planActivityId: 'w1' });
    assert.ok(!('error' in row));
    const saved = await saveFeedback(user, row as Parameters<typeof saveFeedback>[1]);
    assert.equal(saved.rpe, 8);
    assert.equal(saved.date, '2026-10-21');

    await saveFeedback(user, { ...(row as Parameters<typeof saveFeedback>[1]), rpe: 9 });
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM workout_feedback WHERE user_id = ${user}`;
    assert.equal(n, 1, 'one row per item');

    // The Strava view of the same planned workout finds it through plan_activity_id.
    const found = await loadFeedback(user, ['strava:123'], 'w1');
    assert.equal(found?.item, 'plan:w1');
    assert.equal(found?.rpe, 9);
    assert.equal(await loadFeedback(user, ['strava:999'], null), null);

    await saveFeedback(user, { item: 'plan:w1', date: '2026-10-21', feel: null, rpe: null, comment: null, title: null, planActivityId: 'w1' });
    assert.equal(await loadFeedback(user, ['plan:w1'], null), null, 'an empty save clears the row');
  } finally {
    await sql`DELETE FROM workout_feedback WHERE user_id = ${user}`;
  }
});
