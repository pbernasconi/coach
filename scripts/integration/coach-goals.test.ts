// The Coach chat's races, goals and week planning on a real Postgres (src/lib/coach-chat/goal-tools.ts): a card adds
// a race, changes a milestone goal and asks the planner for a week; Apply writes Settings → Events, Settings → Goals
// and a plan request, and Undo puts each back. A second week plan revises the open draft, and its Undo brings the
// draft before it back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { checkProposalInput } from '@/lib/coach-chat/changes.mjs';
import { loadGoalContext, runGoalTool } from '@/lib/coach-chat/goal-tools';
import { applyAll, undoAll } from '@/lib/coach-chat/writes';
import { loadGoals } from '@/lib/goals/goals.mjs';

const user = 'user_coach_goals';
const today = '2026-11-03';
const goal = { id: 'g1', kind: 'vo2max', target: 55, baseline: 50, start: '2026-10-01', deadline: '2027-06-01' };

const statuses = async () =>
  (await sql`SELECT status FROM plan_proposals WHERE user_id = ${user} ORDER BY created_at`) as { status: string }[];

test('Apply adds a race, changes a goal and asks for a week; Undo puts them back', async () => {
  await sql`DELETE FROM plan_proposals WHERE user_id = ${user}`;
  await sql`DELETE FROM events WHERE user_id = ${user}`;
  await sql`DELETE FROM users WHERE id = ${user}`;
  await sql`INSERT INTO users (id, email, settings) VALUES (${user}, 'coach-goals@example.com', ${JSON.stringify({ goals: [goal] })}::jsonb)`;
  await sql`INSERT INTO events (id, user_id, name, date, priority, sport) VALUES ('ev_old', ${user}, 'Marin Century', '2027-05-02', 'B', 'ride')`;
  try {
    const goals = await loadGoalContext(user);
    assert.deepEqual(goals.events.map((e) => e.name), ['Marin Century']);
    assert.match((await runGoalTool(user, today)).text, /id ev_old: Marin Century/);

    const card = (changes: unknown[]) => checkProposalInput({ title: 'T', why: 'W', changes }, { rows: [], today, goals }, 2);
    const checked = card([
      { op: 'event', name: 'Oakland Half', date: '2027-03-21', priority: 'A', sport: 'run', target: 'sub 1:45' },
      { op: 'event', id: 'ev_old', action: 'remove' },
      { op: 'goal', id: 'g1', target: 57 },
      { op: 'plan_week', week: '2026-11-09', away: ['2026-11-10', '2026-11-11'], note: 'NYC, hotel gym' },
    ]);
    assert.ok(checked.ok, JSON.stringify(checked));
    const { undo } = await applyAll(user, checked.value.changes, [], today);

    const events = (await sql`SELECT name, priority, target FROM events WHERE user_id = ${user} ORDER BY name`) as Record<string, unknown>[];
    assert.deepEqual(events, [{ name: 'Oakland Half', priority: 'A', target: 'sub 1:45' }]);
    assert.equal((await loadGoals(sql, user))[0].target, 57);
    const [req] = (await sql`SELECT status, week_start::text AS week, request FROM plan_proposals WHERE user_id = ${user}`) as { status: string; week: string; request: Record<string, unknown> }[];
    assert.equal(req.status, 'requested');
    assert.equal(req.week, '2026-11-09');
    assert.deepEqual([req.request.kind, req.request.away, req.request.lock], ['weekly', ['2026-11-10', '2026-11-11'], 'NYC, hotel gym']);
    assert.ok(undo.some((u) => u.op === 'plan_week'));

    await undoAll(user, undo, today);
    const back = (await sql`SELECT id, name FROM events WHERE user_id = ${user}`) as Record<string, unknown>[];
    assert.deepEqual(back, [{ id: 'ev_old', name: 'Marin Century' }]);
    assert.deepEqual(await loadGoals(sql, user), [goal]);
    assert.deepEqual((await statuses()).map((s) => s.status), ['rejected']);

    // An open draft for the week: a plan_week from the chat is a new version of it, and Undo opens the old one again.
    await sql`DELETE FROM plan_proposals WHERE user_id = ${user}`;
    await sql`
      INSERT INTO plan_proposals (id, user_id, kind, week_start, status, request)
      VALUES ('draft_1', ${user}, 'weekly', '2026-11-09', 'proposed', ${JSON.stringify({ kind: 'weekly', weekStart: '2026-11-09' })}::jsonb)`;
    const again = card([{ op: 'plan_week', week: '2026-11-09', sick: ['2026-11-09'], note: 'Cold, easy start' }]);
    assert.ok(again.ok);
    const second = await applyAll(user, again.value.changes, [], today);
    const rows = (await sql`SELECT id, status, request FROM plan_proposals WHERE user_id = ${user} ORDER BY created_at`) as { id: string; status: string; request: Record<string, any> }[];
    assert.deepEqual(rows.map((r) => r.status), ['rejected', 'requested']);
    assert.equal(rows[1].request.revise.fromId, 'draft_1');
    assert.deepEqual(rows[1].request.sick, ['2026-11-09']);
    await undoAll(user, second.undo, today);
    assert.deepEqual(
      ((await sql`SELECT id, status FROM plan_proposals WHERE user_id = ${user} ORDER BY created_at`) as Record<string, unknown>[]).map((r) => r.status),
      ['proposed', 'rejected'],
    );
  } finally {
    await sql`DELETE FROM plan_proposals WHERE user_id = ${user}`;
    await sql`DELETE FROM events WHERE user_id = ${user}`;
    await sql`DELETE FROM users WHERE id = ${user}`;
  }
});

test('a reminder goes into his settings on Apply, the phone lists it, and Undo takes it out', async () => {
  const { loadReminders } = await import('@/lib/coach-chat/reminders');
  const id = 'user_coach_reminders';
  await sql`DELETE FROM users WHERE id = ${id}`;
  await sql`INSERT INTO users (id, email, settings) VALUES (${id}, 'coach-reminders@example.com', '{}'::jsonb)`;
  try {
    const nowMs = Date.parse('2026-11-03T23:00:00Z');
    const checked = checkProposalInput(
      { title: 'T', why: 'W', changes: [{ op: 'reminder', at: '2026-11-04T18:00', text: 'Physio A' }] },
      { rows: [], today, timeZone: 'America/Los_Angeles', nowMs }, 1,
    );
    assert.ok(checked.ok);
    const { undo } = await applyAll(id, checked.value.changes, [], today);
    assert.deepEqual((await loadReminders(id, nowMs)).map((r) => [r.at, r.text]), [['2026-11-05T02:00:00Z', 'Physio A']]);
    await undoAll(id, undo, today);
    assert.deepEqual(await loadReminders(id, nowMs), []);
  } finally {
    await sql`DELETE FROM users WHERE id = ${id}`;
  }
});
