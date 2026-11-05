// Plan changes reach Google Calendar exactly (src/lib/calendar-sync/push.mjs), on a real Postgres and a fake Google
// Calendar: each workout has one event, a change rewrites only that event, a move to another week carries the event
// along whichever week is pushed first, a skip or delete removes it, and events Coach did not write are never touched.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { pushWeek, eventIdFor } from '@/lib/calendar-sync/push.mjs';
import { createWorkout, removeWorkout, updateWorkout, type WorkoutInput } from '@/lib/plan/month';
import { moveWorkout, setSkipped } from '@/lib/plan/queries';

const user = 'user_calendar_push';
const env = { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' } as unknown as NodeJS.ProcessEnv;
const WEEK = '2026-11-09';
const NEXT = '2026-11-16';

type Ev = Record<string, any>;
/** The fake calendar: event id → event, deleted events kept as cancelled (as Google does). */
let store = new Map<string, Ev>();
let refuse: (body: Ev) => boolean = () => false;
let calls: string[] = [];
const realFetch = globalThis.fetch;
let n = 0;

function fakeGoogle(url: string, init: RequestInit = {}): Response {
  const method = init.method ?? 'GET';
  const json = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (url.startsWith('https://oauth2.googleapis.com/token')) return json(200, { access_token: 'token', expires_in: 3600 });
  const u = new URL(url);
  const id = decodeURIComponent(u.pathname.split('/events')[1]?.replace(/^\//, '') ?? '');
  calls.push(`${method} ${id}`);
  const stamp = () => new Date(Date.now() + n++).toISOString();
  if (method === 'GET' && !id) {
    const [k, v] = (u.searchParams.get('privateExtendedProperty') ?? '').split('=');
    const items = [...store.values()].filter((e) => e.status !== 'cancelled' && e.extendedProperties?.private?.[k] === v);
    return json(200, { items: structuredClone(items) });
  }
  const body = init.body ? JSON.parse(String(init.body)) : {};
  if (method === 'POST') {
    if (refuse(body)) return json(400, { error: 'refused' });
    const eid = body.id ?? `random${n++}`;
    if (store.has(eid)) return json(409, { error: 'duplicate' });
    store.set(eid, { ...body, id: eid, status: 'confirmed', updated: stamp() });
    return json(200, store.get(eid));
  }
  if (method === 'PUT') {
    if (!store.has(id)) return json(404, { error: 'not found' });
    if (refuse(body)) return json(400, { error: 'refused' });
    store.set(id, { ...body, id, status: body.status ?? 'confirmed', updated: stamp() });
    return json(200, store.get(id));
  }
  if (method === 'DELETE') {
    const e = store.get(id);
    if (!e || e.status === 'cancelled') return json(410, { error: 'gone' });
    store.set(id, { ...e, status: 'cancelled', updated: stamp() });
    return new Response(null, { status: 204 });
  }
  return json(400, { error: `unexpected ${method} ${url}` });
}

const live = () => [...store.values()].filter((e) => e.status !== 'cancelled' && e.extendedProperties?.private?.coachManaged);
const eventOf = (workoutId: string) => live().filter((e) => e.extendedProperties.private.coachWorkoutId === workoutId);
const push = (week: string) => pushWeek(sql, user, week, { env }) as Promise<Record<string, any>>;

const input = (w: Partial<WorkoutInput> & { date: string }): WorkoutInput => ({
  sport: 'run', startTime: '07:00', title: 'Easy run', duration: 45, distance: null, tss: null, intensity: 'Easy',
  description: null, steps: null, workoutType: null, ...w,
});

before(async () => {
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => fakeGoogle(String(url), init)) as typeof fetch;
});
after(async () => {
  globalThis.fetch = realFetch;
  await clean();
});

async function clean() {
  await sql`DELETE FROM training_plan_activities a USING training_plans p WHERE p.id = a.plan_id AND p.user_id = ${user}`;
  await sql`DELETE FROM training_plans WHERE user_id = ${user}`;
  await sql`DELETE FROM calendar_connections WHERE user_id = ${user}`;
  await sql`DELETE FROM users WHERE id = ${user}`;
}

beforeEach(async () => {
  store = new Map();
  refuse = () => false;
  calls = [];
  await clean();
  await sql`INSERT INTO users (id, email) VALUES (${user}, 'calendar-push@example.com')`;
  await sql`
    INSERT INTO calendar_connections (id, user_id, google_email, access_token, refresh_token, token_expires_at, google_account_id, scope)
    VALUES ('conn_calendar_push', ${user}, 'me@example.com', 'a', 'r', NOW(), 'acct_calendar_push', 'calendar')`;
  // An event Paolo made himself, on a week day: no push may ever touch it.
  store.set('mine', { id: 'mine', summary: 'Dentist', start: { dateTime: '2026-11-10T07:00:00-08:00' }, status: 'confirmed' });
});

test('a new week: one event per workout under its fixed id; a second push changes nothing', async () => {
  const run = await createWorkout(user, input({ date: '2026-11-10' }));
  const ride = await createWorkout(user, input({ date: '2026-11-12', sport: 'ride', title: 'Zwift', startTime: null }));
  const r1 = await push(WEEK);
  assert.deepEqual([r1.created, r1.updated, r1.deleted, r1.errors.length], [2, 0, 0, 0]);
  assert.equal(eventOf(run)[0].id, eventIdFor(run));
  assert.deepEqual(eventOf(run)[0].start, { dateTime: '2026-11-10T07:00:00', timeZone: 'America/Los_Angeles' });
  assert.deepEqual(eventOf(run)[0].end, { dateTime: '2026-11-10T07:45:00', timeZone: 'America/Los_Angeles' });
  assert.deepEqual(eventOf(ride)[0].start, { date: '2026-11-12' });
  calls = [];
  const r2 = await push(WEEK);
  assert.deepEqual([r2.created, r2.updated, r2.deleted, r2.unchanged], [0, 0, 0, 2]);
  assert.deepEqual(calls, ['GET '], 'only the list: nothing written');
  assert.equal(store.get('mine')!.summary, 'Dentist');
});

test('an edit of time or length moves the event and drops the old end (no end before start)', async () => {
  const id = await createWorkout(user, input({ date: '2026-11-10' }));
  // As after a calendar move or a planner import: a stored end time.
  await sql`UPDATE training_plan_activities SET end_time = '07:45' WHERE id = ${id}`;
  await push(WEEK);
  const before = eventOf(id)[0];

  await updateWorkout(user, id, input({ date: '2026-11-10', startTime: '10:40', title: 'Easy run to the gym' }));
  const [row] = await sql`SELECT start_time, end_time FROM training_plan_activities WHERE id = ${id}`;
  assert.deepEqual([row.start_time, row.end_time], ['10:40', null]);
  const r = await push(WEEK);
  assert.deepEqual([r.created, r.updated, r.deleted, r.errors.length], [0, 1, 0, 0]);
  const e = eventOf(id);
  assert.equal(e.length, 1);
  assert.equal(e[0].id, before.id, 'the same event, changed in place');
  assert.equal(e[0].summary, 'Easy run to the gym');
  assert.equal(e[0].start.dateTime, '2026-11-10T10:40:00');
  assert.equal(e[0].end.dateTime, '2026-11-10T11:25:00');

  // Only the title: the end stays as stored.
  await sql`UPDATE training_plan_activities SET end_time = '11:30' WHERE id = ${id}`;
  await updateWorkout(user, id, input({ date: '2026-11-10', startTime: '10:40', title: 'Run to the gym' }));
  const [kept] = await sql`SELECT end_time FROM training_plan_activities WHERE id = ${id}`;
  assert.equal(kept.end_time, '11:30');
});

for (const first of ['new', 'old'] as const) {
  test(`a move to another week carries the event along when the ${first} week is pushed first`, async () => {
    const id = await createWorkout(user, input({ date: '2026-11-13' }));
    const stay = await createWorkout(user, input({ date: '2026-11-11', title: 'Stays' }));
    await push(WEEK);
    const eventId = eventOf(id)[0].id;

    await moveWorkout(user, id, '2026-11-17');
    for (const week of first === 'new' ? [NEXT, WEEK] : [WEEK, NEXT]) {
      const r = await push(week);
      assert.equal(r.errors.length, 0);
      assert.equal(r.deleted, 0, 'nothing deleted');
      assert.equal(r.created, 0, 'nothing created');
    }
    const e = eventOf(id);
    assert.equal(e.length, 1);
    assert.equal(e[0].id, eventId);
    assert.equal(e[0].start.dateTime, '2026-11-17T07:00:00');
    assert.equal(e[0].extendedProperties.private.coachPlanDate, NEXT);
    assert.match(e[0].description, /week=2026-11-16&open=w-/);
    assert.equal(eventOf(stay).length, 1);
    assert.equal(live().length, 2);
  });
}

test('an event from before fixed ids moves along too, never doubled', async () => {
  const id = await createWorkout(user, input({ date: '2026-11-13' }));
  await push(WEEK);
  // Make it an old-style event with a random id.
  const old = store.get(eventIdFor(id))!;
  store.delete(eventIdFor(id));
  store.set('legacy1', { ...old, id: 'legacy1' });

  await moveWorkout(user, id, '2026-11-18');
  await push(NEXT);
  await push(WEEK);
  const e = eventOf(id);
  assert.deepEqual(e.map((x) => [x.id, x.start.dateTime]), [['legacy1', '2026-11-18T07:00:00']]);
});

test('a skip removes the event, putting it back brings it back; a delete removes it', async () => {
  const id = await createWorkout(user, input({ date: '2026-11-10' }));
  await push(WEEK);
  await setSkipped(user, id, true, 'tired');
  assert.equal((await push(WEEK)).deleted, 1);
  assert.equal(eventOf(id).length, 0);

  await setSkipped(user, id, false);
  const r = await push(WEEK);
  assert.deepEqual([r.created, r.errors.length], [1, 0]);
  assert.equal(eventOf(id).length, 1, 'the cancelled event is restored under its id');

  await removeWorkout(user, id);
  assert.equal((await push(WEEK)).deleted, 1);
  assert.equal(eventOf(id).length, 0);
  assert.equal(store.get('mine')!.status, 'confirmed');
});

test('two pushes at once never make two events', async () => {
  const id = await createWorkout(user, input({ date: '2026-11-10' }));
  const results = await Promise.all([push(WEEK), push(WEEK), push(WEEK)]);
  assert.deepEqual(results.map((r) => r.errors), [[], [], []]);
  assert.equal(eventOf(id).length, 1);
});

test('a second event for one workout goes', async () => {
  const id = await createWorkout(user, input({ date: '2026-11-10' }));
  await push(WEEK);
  store.set('copy', { ...store.get(eventIdFor(id))!, id: 'copy' });
  const r = await push(WEEK);
  assert.equal(r.deleted, 1);
  assert.deepEqual(eventOf(id).map((e) => e.id), [eventIdFor(id)]);
});

test('Google refusing one event never stops the rest of the week', async () => {
  const bad = await createWorkout(user, input({ date: '2026-11-10', title: 'Bad' }));
  const good = await createWorkout(user, input({ date: '2026-11-11', title: 'Good' }));
  refuse = (b) => b.summary === 'Bad';
  const r = await push(WEEK);
  assert.equal(r.created, 1);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /create Bad/);
  assert.equal(eventOf(good).length, 1);
  assert.equal(eventOf(bad).length, 0);
});

test('a move on the calendar still goes into Coach', async () => {
  const id = await createWorkout(user, input({ date: '2026-11-10' }));
  await push(WEEK);
  const e = store.get(eventIdFor(id))!;
  store.set(e.id, {
    ...e,
    start: { dateTime: '2026-11-11T18:00:00-08:00', timeZone: 'America/Los_Angeles' },
    end: { dateTime: '2026-11-11T18:45:00-08:00', timeZone: 'America/Los_Angeles' },
    updated: new Date(Date.now() + 60_000).toISOString(),
  });
  const r = await push(WEEK);
  assert.deepEqual(r.moved.map((m: { to: string }) => m.to), ['2026-11-11']);
  const [row] = await sql`SELECT to_char(scheduled_date, 'YYYY-MM-DD') AS d, start_time FROM training_plan_activities WHERE id = ${id}`;
  assert.deepEqual([row.d, row.start_time], ['2026-11-11', '18:00']);
  assert.equal(eventOf(id).length, 1);
});
