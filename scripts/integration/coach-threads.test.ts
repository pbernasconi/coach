// Coach chats on a real Postgres (lift/APP-API.md, "Coach"): New chat opens an empty one (and doesn't pile up empty
// ones), the history lists chats with messages titled by their first, a past chat reopens, the thumbs land in the
// reply's meta, and a reply's thought and question cards come back from its meta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { listThreads, loadCoach, reopenThread, setFeedback, startThread } from '@/lib/coach-chat/server';

const user = 'user_coach_threads';

async function clear() {
  await sql`DELETE FROM coach_messages WHERE user_id = ${user}`;
  await sql`DELETE FROM coach_threads WHERE user_id = ${user}`;
}

test('new chat, history, reopen, thumbs', async () => {
  await clear();
  try {
    await sql`INSERT INTO coach_threads (id, user_id, updated_at) VALUES ('t1coach', ${user}, NOW() - interval '2 hours')`;
    await sql`INSERT INTO coach_messages (id, thread_id, user_id, role, text, created_at) VALUES
      ('m1coach', 't1coach', ${user}, 'user', 'Move   today''s lift to Thursday please', NOW() - interval '2 hours')`;
    await sql`INSERT INTO coach_messages (id, thread_id, user_id, role, text, meta, created_at) VALUES
      ('m2coach', 't1coach', ${user}, 'assistant', 'Two quick ones.',
       ${JSON.stringify({ thought: 'He travels.', questions: [{ id: 'q1', title: 'Which days?', kind: 'multi', options: ['Mon', 'Tue'] }] })}::jsonb,
       NOW() - interval '2 hours' + interval '5 seconds')`;

    const open = await loadCoach(user);
    assert.equal(open.threadId, 't1coach');
    const reply = open.messages[1];
    assert.equal(reply.thought, 'He travels.');
    assert.equal(reply.questions[0].title, 'Which days?');
    assert.equal(reply.feedback, null);
    assert.equal(open.messages[0].thought, null);
    assert.ok(open.prompts.length >= 3);

    const fresh = await startThread(user);
    assert.notEqual(fresh.threadId, 't1coach');
    assert.deepEqual(fresh.messages, []);
    const again = await startThread(user);
    assert.equal(again.threadId, fresh.threadId, 'an empty open chat is kept, not doubled');

    const { threads } = await listThreads(user);
    assert.deepEqual(threads.map((t) => [t.id, t.title, t.messageCount]), [['t1coach', "Move today's lift to Thursday please", 2]]);

    const back = await reopenThread(user, 't1coach');
    assert.equal(back?.threadId, 't1coach');
    assert.equal(await reopenThread(user, 'nosuchchat'), null);
    assert.equal(await reopenThread('someone_else', 't1coach'), null);

    assert.equal(await setFeedback(user, 'm2coach', 'up'), true);
    assert.equal((await loadCoach(user)).messages[1].feedback, 'up');
    assert.equal(await setFeedback(user, 'm2coach', null), true);
    assert.equal((await loadCoach(user)).messages[1].feedback, null);
    assert.equal((await loadCoach(user)).messages[1].thought, 'He travels.', 'clearing thumbs keeps the rest of meta');
    assert.equal(await setFeedback(user, 'm1coach', 'down'), false, 'only replies take thumbs');
  } finally {
    await clear();
  }
});

test('a breakdown card adds up the month by sport', async () => {
  const { resolveCards } = await import('@/lib/coach-chat/cards');
  await sql`DELETE FROM strava_activities WHERE user_id = ${user}`;
  await sql`INSERT INTO users (id, email) VALUES (${user}, 'coach-threads@example.com') ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO strava_connections (id, user_id, athlete_id, access_token, refresh_token, expires_at, scope)
    VALUES ('conn_ct', ${user}, 2, 'a', 'r', 0, 'read') ON CONFLICT DO NOTHING`;
  try {
    const rows: [string, string, string, number][] = [
      ['a1ct', 'Run', '2026-10-03 07:00', 2700], ['a2ct', 'Ride', '2026-10-05 08:00', 5400],
      ['a3ct', 'Run', '2026-10-20 07:00', 1800], ['a4ct', 'Run', '2026-09-30 07:00', 3600],
    ];
    for (const [id, sport, at, secs] of rows) {
      await sql`INSERT INTO strava_activities (id, user_id, connection_id, strava_activity_id, name, sport_type, start_date, start_date_local, moving_time)
        VALUES (${id}, ${user}, 'conn_ct', ${Math.floor(Math.random() * 1e9)}, ${sport}, ${sport}, ${at}::timestamp, ${at}::timestamp, ${secs})`;
    }
    const [card] = await resolveCards(user, [{ kind: 'breakdown', ref: 'month:2026-10' }], [], '2026-10-29', 'America/Los_Angeles');
    assert.equal(card?.kind, 'breakdown');
    assert.equal(card?.caption, 'October 2026');
    assert.equal(card?.total, '2 h 45 m');
    assert.deepEqual((card?.rows as { label: string; value: number }[]).map((r) => [r.label, r.value]), [['Ride', 90], ['Run', 75]]);
  } finally {
    await sql`DELETE FROM strava_activities WHERE user_id = ${user}`;
    await sql`DELETE FROM strava_connections WHERE id = 'conn_ct'`;
    await sql`DELETE FROM users WHERE id = ${user}`;
  }
});
