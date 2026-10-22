// The cloud plan on a real Postgres (src/lib/plan/proposals.ts): request → claim → a bad plan fails → a good plan is
// proposed → accept imports it (the same import as /plan) and closes older proposals for the week.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { acceptProposal, claimRequest, createRequest, openProposal, submitPlan } from '@/lib/plan/proposals';
import { loadOutlook, loadPlanningContext } from '@/lib/plan/planning-context';

const user = 'user_proposals';
const week = '2026-11-02';
const plan = {
  weekStart: week,
  weekEnd: '2026-11-08',
  events: [
    { title: '🚴 Threshold A', start: '2026-11-03T07:00:00', end: '2026-11-03T08:30:00', workoutType: 'ride-threshold-a', workout: { bank: 'threshold-a', level: 1 }, why: 'Rotation' },
    { title: '🏃 Easy run', start: '2026-11-04T07:00:00', end: '2026-11-04T07:45:00', workoutType: 'run-easy', workout: { bank: 'easy', reps: 4 }, why: 'Aerobic' },
  ],
};

test('request, claim, check, propose and accept a cloud plan', async () => {
  await sql`DELETE FROM users WHERE id = ${user}`;
  await sql`INSERT INTO users (id, email) VALUES (${user}, 'proposals@example.com')`;
  try {
    const id = await createRequest(user, { kind: 'weekly', weekStart: week, feel: 'fresh', focus: null, lock: 'keep Thursday' });
    assert.equal((await openProposal(user))?.status, 'requested');
    const claimed = await claimRequest(user, id);
    assert.equal(claimed?.request.lock, 'keep Thursday');

    const badRun = await claimRequest(user, await createRequest(user, { kind: 'weekly', weekStart: week, feel: null, focus: null, lock: null }));
    const bad = await submitPlan(user, badRun!.id, { ...plan, weekStart: '2026-11-09' }, null);
    assert.ok('error' in bad);
    const [failed] = await sql`SELECT status, error FROM plan_proposals WHERE id = ${badRun!.id}`;
    assert.equal(failed.status, 'failed');

    const review = { headline: 'Two quality days.', decisions: [{ title: 'Threshold first', tradeoff: 'No VO2 this week' }] };
    const ok = await submitPlan(user, id, { ...plan, review }, 'Fresh: two quality days.');
    assert.ok('events' in ok && ok.events === 2, JSON.stringify(ok));
    const open = await openProposal(user);
    assert.equal(open?.id, id, 'the newest open one is the proposed plan, not the older failure');
    assert.equal(open?.rows.length, 2);
    assert.equal(open?.review?.headline, 'Two quality days.');
    assert.equal(open?.review?.decisions[0].tradeoff, 'No VO2 this week');
    assert.equal((await loadOutlook(user, open!)).plannedTss > 0, true);
    const ctx = await loadPlanningContext(user, week, { strict: true });
    assert.ok(Array.isArray(ctx.facts) && ctx.suggested.feel);

    const accepted = await acceptProposal(user, id);
    assert.ok('counts' in accepted && accepted.counts.inserted === 2, JSON.stringify(accepted));
    const rows = await sql`
      SELECT a.title, a.workout_type FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
      WHERE p.user_id = ${user} ORDER BY a.scheduled_date`;
    assert.deepEqual(rows.map((r) => r.workout_type), ['ride-threshold-a', 'run-easy']);
    const [other] = await sql`SELECT status FROM plan_proposals WHERE id = ${badRun!.id}`;
    assert.equal(other.status, 'rejected', 'an accept closes the older failure for the same week');
    assert.ok('error' in (await acceptProposal(user, id)), 'a plan is accepted once');
    assert.equal(await openProposal(user), null);
  } finally {
    await sql`DELETE FROM training_plan_activities a USING training_plans p WHERE p.id = a.plan_id AND p.user_id = ${user}`;
    await sql`DELETE FROM training_plans WHERE user_id = ${user}`;
    await sql`DELETE FROM plan_proposals WHERE user_id = ${user}`;
    await sql`DELETE FROM users WHERE id = ${user}`;
  }
});
