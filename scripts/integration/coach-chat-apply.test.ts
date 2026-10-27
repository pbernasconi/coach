// The Coach tab's Apply and Undo on a real Postgres (lift/COACH-CHAT.md): the David day of Mon 26 Oct 2026. A card
// moves the heavy lift to Tuesday 09:00, skips VO2 B, adds an easy run and deletes the recovery spin through the
// plan's own writes; Undo puts every workout back as it was. A failing change puts back the ones before it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { checkProposalInput, fingerprint, isStale, type Change } from '@/lib/coach-chat/changes.mjs';
import { ApplyError, applyAll, planRows, undoAll } from '@/lib/coach-chat/writes';
import { cleanNewWorkout } from '@/lib/plan/create.mjs';
import { createWorkout } from '@/lib/plan/month';

const user = 'user_coach_chat_apply';
const today = '2026-10-26';
type Input = Parameters<typeof createWorkout>[1];
const add = (input: Record<string, unknown>) => createWorkout(user, (cleanNewWorkout(input) as { value: Input }).value);

async function snapshot() {
  const rows = await planRows(user, today);
  return Object.fromEntries(rows.map((r) => [r.title, fingerprint(r)]));
}

test('Apply runs a card through the plan writes and Undo puts it back', async () => {
  await sql`DELETE FROM users WHERE id = ${user}`;
  await sql`INSERT INTO users (id, email, settings) VALUES (${user}, 'coach-chat@example.com', ${JSON.stringify({ coachingNotes: '# Week\n- Bike club Thu\n' })}::jsonb)`;
  const notes = async () => String(((await sql`SELECT settings ->> 'coachingNotes' AS n FROM users WHERE id = ${user}`) as { n: string }[])[0]?.n);
  try {
    const spin = await add({ sport: 'ride', date: today, startTime: '07:00', title: 'Recovery spin', duration: 40, intensity: 'Recovery' });
    const heavy = await add({ sport: 'strength', date: today, startTime: '17:00', title: 'Heavy barbell', duration: 60 });
    const vo2 = await add({ sport: 'run', date: '2026-10-27', startTime: '09:00', title: 'VO2 B', duration: 50, intensity: 'Very hard' });
    const before = await snapshot();

    const rows = await planRows(user, today);
    assert.equal(rows.length, 3);
    const checked = checkProposalInput({
      title: 'Lift Tuesday, run with David today',
      why: 'Based on your message',
      changes: [
        { op: 'move', id: heavy, date: '2026-10-27', startTime: '09:00' },
        { op: 'skip', id: vo2, reason: 'busy' },
        { op: 'add', date: today, sport: 'run', startTime: '16:00', title: 'Easy run with David', duration: 45 },
        { op: 'remove', id: spin },
        { op: 'remember', text: 'David runs Mondays at 16:00' },
      ],
    }, { rows, today }, 2);
    assert.ok(checked.ok, JSON.stringify(checked));

    const { undo, dates } = await applyAll(user, checked.value.changes, rows, today);
    assert.deepEqual([...new Set(dates)].sort(), ['2026-10-26', '2026-10-27']);
    const after = await planRows(user, today);
    const by = Object.fromEntries(after.map((r) => [r.title, r]));
    assert.deepEqual([by['Heavy barbell'].date, by['Heavy barbell'].startTime?.slice(0, 5)], ['2026-10-27', '09:00']);
    assert.deepEqual([by['VO2 B'].status, by['VO2 B'].skipReason], ['skipped', 'busy']);
    assert.deepEqual([by['Easy run with David'].date, by['Easy run with David'].intensity, by['Easy run with David'].duration], [today, 'Easy', 45]);
    assert.equal(by['Recovery spin'], undefined);
    assert.ok(isStale(checked.value.basis, after), 'the card is stale once applied');
    assert.match(await notes(), /# Week\n- Bike club Thu\n\n## From Coach chat\n- David runs Mondays at 16:00\n$/);

    await undoAll(user, undo, today);
    assert.deepEqual(await snapshot(), before);
    assert.equal((await notes()).trim(), '# Week\n- Bike club Thu');
  } finally {
    await sql`DELETE FROM training_plan_activities a USING training_plans p WHERE p.id = a.plan_id AND p.user_id = ${user}`;
    await sql`DELETE FROM training_plans WHERE user_id = ${user}`;
    await sql`DELETE FROM users WHERE id = ${user}`;
  }
});

test('a change that fails puts back the ones before it', async () => {
  await sql`DELETE FROM users WHERE id = ${user}`;
  await sql`INSERT INTO users (id, email) VALUES (${user}, 'coach-chat@example.com')`;
  try {
    const heavy = await add({ sport: 'strength', date: today, startTime: '17:00', title: 'Heavy barbell', duration: 60 });
    const before = await snapshot();
    const rows = await planRows(user, today);
    const ops: Change[] = [
      { op: 'move', id: heavy, date: '2026-10-28', startTime: '08:00' },
      { op: 'remove', id: 'gone-meanwhile' },
    ];
    await assert.rejects(applyAll(user, ops, [...rows, { ...rows[0], id: 'gone-meanwhile' }], today), ApplyError);
    assert.deepEqual(await snapshot(), before);
  } finally {
    await sql`DELETE FROM training_plan_activities a USING training_plans p WHERE p.id = a.plan_id AND p.user_id = ${user}`;
    await sql`DELETE FROM training_plans WHERE user_id = ${user}`;
    await sql`DELETE FROM users WHERE id = ${user}`;
  }
});
