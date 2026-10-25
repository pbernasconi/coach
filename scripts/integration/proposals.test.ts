// Plans waiting for Paolo on a real Postgres (src/lib/plan/proposals.ts): request → claim → a bad plan fails → a good
// plan is proposed → accept imports it and closes older proposals for the week → a check-in keeps the days before it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { acceptProposal, claimRequest, createRequest, openProposal, submitPlan } from '@/lib/plan/proposals';
import { loadOutlook, loadPlanningContext } from '@/lib/plan/planning-context';
import { currentWeekText } from '@/lib/planner/current-week.mjs';

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
  await sql`DELETE FROM calendar_connections WHERE user_id = ${user}`;
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
    const context = { generatedAt: '2026-11-01T15:00:00Z', weekStart: week, calendarByWeek: [], consistency: { lifts: { liftFirst: false } } };
    const ok = await submitPlan(user, id, { ...plan, review }, 'Fresh: two quality days.', context);
    assert.ok('events' in ok && ok.events === 2, JSON.stringify(ok));
    // The rules report (no lift, no long run) and don't block; the profile is kept for the evals.
    assert.ok('fails' in ok && ok.fails === 2, JSON.stringify(ok));
    const [stored] = await sql`SELECT context, checks FROM plan_proposals WHERE id = ${id}`;
    assert.equal(stored.context.weekStart, week);
    assert.deepEqual(stored.checks.issues.map((i: { id: string }) => i.id).sort(), ['R4', 'R6', 'R9']);
    const open = await openProposal(user);
    assert.equal(open?.id, id, 'the newest open one is the proposed plan, not the older failure');
    assert.equal(open?.rows.length, 2);
    assert.equal(open?.review?.headline, 'Two quality days.');
    assert.equal(open?.review?.decisions[0].tradeoff, 'No VO2 this week');
    assert.equal(open?.checks?.fails, 2);
    assert.equal('context' in (open as object), false, 'the page reads never carry the profile');
    assert.equal((await loadOutlook(user, open!)).plannedTss > 0, true);
    // Calendar: Coach's own workout events and declined events are not busy time; times are Paolo's wall clock.
    await sql`
      INSERT INTO calendar_connections (id, user_id, google_email, access_token, refresh_token, token_expires_at, google_account_id, scope)
      VALUES ('cc_proposals', ${user}, 'p@example.com', 'x', 'x', NOW(), 'gacct_proposals', 'calendar')`;
    const event = (id: string, summary: string, start: string, end: string, description: string | null, attendees: unknown = null) => sql`
      INSERT INTO calendar_events (id, connection_id, google_event_id, google_calendar_id, summary, description, start_time, end_time, is_all_day, status, attendees, timezone)
      VALUES (${id}, 'cc_proposals', ${id}, 'primary', ${summary}, ${description}, ${start}, ${end}, false, 'confirmed', ${attendees ? JSON.stringify(attendees) : null}, 'UTC')`;
    await event('ev_hh', 'Alum HH', '2026-11-05T01:30:00Z', '2026-11-05T03:30:00Z', null);
    await event('ev_coach', 'Recovery spin', '2026-11-03T15:00:00Z', '2026-11-03T16:00:00Z', 'Easy.\n\nOpen in Coach: https://coach.example/plan');
    await event('ev_no', 'Declined sync', '2026-11-06T17:00:00Z', '2026-11-06T18:00:00Z', null, [{ self: true, responseStatus: 'declined' }]);
    const ctx = await loadPlanningContext(user, week, { strict: true });
    assert.ok(Array.isArray(ctx.facts) && ctx.suggested.feel);
    assert.deepEqual(ctx.days, { '2026-11-04': '17:30 Alum HH' });

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

    // A check-in on Wednesday 4 Nov: the planner sees the week as it is, and the accept keeps Tuesday (the past) even
    // though the check-in plan leaves it out, while Wednesday's easy run (today, dropped) goes.
    const week1 = await currentWeekText(sql, user, week);
    assert.match(week1, /2026-11-03 07:00 {2}🚴 Threshold A/);
    const ciId = await createRequest(user, { kind: 'checkin', weekStart: week, feel: 'fatigued', focus: null, lock: null });
    assert.ok(await claimRequest(user, ciId));
    const checkin = {
      weekStart: week, weekEnd: '2026-11-08',
      completed: [{ day: '2026-11-03', session: '🚴 Threshold A', tss: 90 }],
      events: [{ title: '🚴 Easy spin', start: '2026-11-05T07:00:00', end: '2026-11-05T07:45:00', workoutType: 'ride-z2', workout: { bank: 'easy', reps: 0, zone: 'Z1' }, why: 'Tired: easy day' }],
    };
    const ciContext = { ...context, generatedAt: '2026-11-04T18:00:00Z' };
    assert.ok('events' in (await submitPlan(user, ciId, checkin, 'Eased the week.', ciContext)));
    const ci = await acceptProposal(user, ciId);
    assert.ok('counts' in ci && ci.counts.deleted === 1, JSON.stringify(ci));
    const after = await sql`
      SELECT a.title FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
      WHERE p.user_id = ${user} ORDER BY a.scheduled_date`;
    assert.deepEqual(after.map((r) => r.title), ['🚴 Threshold A', '🚴 Easy spin']);
  } finally {
    await sql`DELETE FROM training_plan_activities a USING training_plans p WHERE p.id = a.plan_id AND p.user_id = ${user}`;
    await sql`DELETE FROM training_plans WHERE user_id = ${user}`;
    await sql`DELETE FROM plan_proposals WHERE user_id = ${user}`;
    await sql`DELETE FROM calendar_connections WHERE user_id = ${user}`;
    await sql`DELETE FROM users WHERE id = ${user}`;
  }
});
