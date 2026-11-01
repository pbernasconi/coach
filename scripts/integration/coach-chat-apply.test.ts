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

test('answering: true only while the last message is Paolo\'s, unanswered and recent', async () => {
  const { isAnswering } = await import('@/lib/coach-chat/server');
  const now = Date.parse('2026-10-27T05:00:00.000Z');
  const at = (s: number) => new Date(now - s * 1000).toISOString();
  assert.equal(isAnswering([], now), false);
  assert.equal(isAnswering([{ role: 'user', createdAt: at(20) }], now), true);
  assert.equal(isAnswering([{ role: 'user', createdAt: at(200) }], now), false);
  assert.equal(isAnswering([{ role: 'user', createdAt: at(30) }, { role: 'assistant', createdAt: at(5) }], now), false);
});

async function card(changes: unknown[], title = 'Card') {
  const { checkProposalInput: check } = await import('@/lib/coach-chat/changes.mjs');
  const rows = await planRows(user, today);
  const checked = check({ title, why: '', changes }, { rows, today, templates: ['Heavy barbell'] }, 2);
  assert.ok(checked.ok, JSON.stringify(checked));
  const id = `p${Math.random().toString(36).slice(2, 12)}`;
  const v = checked.value;
  await sql`
    INSERT INTO coach_proposals (id, thread_id, user_id, title, why, changes, items, warnings, status)
    VALUES (${id}, 'thread', ${user}, ${title}, null, ${JSON.stringify({ ops: v.changes, basis: v.basis, card: v.card })}::jsonb,
            ${JSON.stringify(v.items)}::jsonb, ${JSON.stringify(v.warnings)}::jsonb, 'open')`;
  return id;
}

async function withUser(run: () => Promise<void>) {
  await sql`DELETE FROM users WHERE id = ${user}`;
  await sql`INSERT INTO users (id, email) VALUES (${user}, 'coach-chat@example.com')`;
  try {
    await run();
  } finally {
    await sql`DELETE FROM coach_proposals WHERE user_id = ${user}`;
    await sql`DELETE FROM training_plan_activities a USING training_plans p WHERE p.id = a.plan_id AND p.user_id = ${user}`;
    await sql`DELETE FROM training_plans WHERE user_id = ${user}`;
    await sql`DELETE FROM users WHERE id = ${user}`;
  }
}

test('two taps on Apply apply the card once', () => withUser(async () => {
  const { applyProposal } = await import('@/lib/coach-chat/server');
  const id = await card([{ op: 'add', date: today, sport: 'run', startTime: '16:00', title: 'Easy run', duration: 45 }]);
  const [a, b] = await Promise.all([applyProposal(user, id, today), applyProposal(user, id, today)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal((await planRows(user, today)).filter((r) => r.title === 'Easy run').length, 1);
}));

test('Not now tapped while Apply runs leaves the card applied', () => withUser(async () => {
  const { applyProposal, dismissProposal } = await import('@/lib/coach-chat/server');
  const id = await card([{ op: 'add', date: today, sport: 'run', startTime: '16:00', title: 'Easy run', duration: 45 }]);
  const [applied, dismissed] = await Promise.all([applyProposal(user, id, today), dismissProposal(user, id)]);
  const [row] = (await sql`SELECT status FROM coach_proposals WHERE id = ${id}`) as { status: string }[];
  const added = (await planRows(user, today)).filter((r) => r.title === 'Easy run').length;
  // Exactly one wins, and the card says what the plan shows.
  assert.deepEqual([applied.status, dismissed.status].sort(), [200, 409]);
  assert.equal(row.status, applied.status === 200 ? 'applied' : 'dismissed');
  assert.equal(added, applied.status === 200 ? 1 : 0);
}));

test('Apply refuses a card once the plan has a copy of its lift, and changes nothing', () => withUser(async () => {
  const { applyProposal } = await import('@/lib/coach-chat/server');
  const id = await card([{ op: 'add', date: '2026-10-28', sport: 'strength', startTime: '17:00', title: 'Heavy barbell', duration: 60, liftTemplate: 'Heavy barbell' }]);
  const other = await add({ sport: 'strength', date: '2026-10-29', startTime: '17:00', title: 'Heavy barbell', duration: 60 });
  await sql`UPDATE training_plan_activities SET lift_template = 'Heavy barbell' WHERE id = ${other}`;
  const res = await applyProposal(user, id, today);
  assert.equal(res.status, 409);
  const body = res.body as { error: string; proposal: { status: string; result: string[] } };
  assert.equal(body.proposal.status, 'stale');
  assert.match(body.error, /^Nothing changed: .*already planned this week/);
  assert.equal((await planRows(user, today)).length, 1);
}));

test('Undo asks first when Paolo changed a workout since, then leaves it as he set it', () => withUser(async () => {
  const { applyProposal, undoProposal } = await import('@/lib/coach-chat/server');
  const heavy = await add({ sport: 'strength', date: today, startTime: '17:00', title: 'Heavy barbell', duration: 60 });
  const vo2 = await add({ sport: 'run', date: '2026-10-27', startTime: '09:00', title: 'VO2 B', duration: 50, intensity: 'Very hard' });
  const id = await card([
    { op: 'move', id: heavy, date: '2026-10-27', startTime: '09:00' },
    { op: 'skip', id: vo2, reason: 'busy' },
  ]);
  const applied = await applyProposal(user, id, today);
  assert.equal(applied.status, 200, JSON.stringify(applied.body));
  assert.deepEqual((applied.body as { proposal: { result: string[] } }).proposal.result, []);
  // Paolo moves the lift again on the Week tab.
  await sql`UPDATE training_plan_activities SET start_time = '18:00' WHERE id = ${heavy}`;
  const ask = await undoProposal(user, id, today);
  assert.equal(ask.status, 200);
  assert.equal((ask.body as { needsConfirm: boolean }).needsConfirm, true);
  assert.deepEqual((ask.body as { needsConfirm: boolean; kept: string[]; undoable: number }).kept, ['Heavy barbell']);
  assert.equal((ask.body as { undoable: number }).undoable, 1);
  const undone = await undoProposal(user, id, today, true);
  assert.equal(undone.status, 200);
  assert.match((undone.body as { proposal: { result: string[] } }).proposal.result[0], /Left Heavy barbell as you set it/);
  const by = Object.fromEntries((await planRows(user, today)).map((r) => [r.title, r]));
  assert.deepEqual([by['Heavy barbell'].date, by['Heavy barbell'].startTime?.slice(0, 5)], ['2026-10-27', '18:00']);
  assert.equal(by['VO2 B'].status, 'planned');
}));
