import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANCHORS, flatten, targetText, totals, validate, zoneOf, zoneTarget } from './steps.mjs';
import { BANK, bankWorkout } from './bank.mjs';
import { toZwo } from './zwo.mjs';

test('zones match the PLAN-STRUCTURE table at FTP 280 W and LTHR 168', () => {
  assert.equal(targetText(zoneTarget('Z4top', 'ride')), '269–291 W');
  assert.equal(targetText(zoneTarget('Z4top', 'run')), '175–181 bpm');
  assert.equal(targetText(zoneTarget('Z2top', 'ride')), '196–210 W');
  assert.equal(targetText(zoneTarget('Z2', 'run')), '123–153 bpm');
  assert.equal(zoneOf(zoneTarget('Z3', 'ride'), 'ride'), 'Z3');
  assert.equal(ANCHORS.ftp, 280);
});

test('every bank workout is valid at every level, for both sports', () => {
  for (const [name, b] of Object.entries(BANK)) {
    for (const sport of name === 'test-10k' ? ['run'] : ['ride', 'run']) {
      for (let level = 0; level < b.levels; level++) {
        const w = bankWorkout(name, sport, level, 90);
        assert.deepEqual(validate(w), [], `${name} ${sport} ${level}`);
      }
    }
  }
});

test('Threshold A: 6×5 then +1 set per level up to 10, filled with easy riding to the planned time', () => {
  const w = bankWorkout('threshold-a', 'ride', 0, 90);
  assert.equal(w.name, 'Threshold A: 6×5 min top of Z4');
  assert.equal(w.steps[1].count, 6);
  assert.equal(totals(w).minutes, 90);
  assert.equal(bankWorkout('threshold-a', 'ride', 9, 90).steps[1].count, 10); // clamped
  const run = bankWorkout('threshold-a', 'run', 0, 120);
  assert.equal(run.steps[0].duration.s, 600); // run: 10 min warm-up
  assert.ok(totals(run).minutes <= 90); // run: 90 min cap
});

test('VO2 A progression: 4×3 → 5×3 → +30 s up to 5×5', () => {
  const sets = (l) => bankWorkout('vo2-a', 'ride', l, 75).steps[1];
  assert.deepEqual([sets(0).count, sets(0).steps[0].duration.s], [4, 180]);
  assert.deepEqual([sets(1).count, sets(1).steps[0].duration.s], [5, 180]);
  assert.deepEqual([sets(2).count, sets(2).steps[0].duration.s], [5, 210]);
  assert.deepEqual([sets(5).count, sets(5).steps[0].duration.s], [5, 300]);
});

test('VO2 B on the bike nests 3 × [6 × 30/30] and flattens to 39 steps', () => {
  const w = bankWorkout('vo2-b', 'ride', 0, 60);
  assert.equal(w.steps[1].count, 3);
  assert.equal(w.steps[1].steps[0].count, 6);
  const work = flatten(w.steps).filter((s) => s.kind === 'work' && s.duration.s === 30);
  assert.equal(work.length, 18);
});

test('totals: TSS and IF from the targets', () => {
  const w = { version: 1, sport: 'ride', name: 't', steps: [{ kind: 'work', duration: { type: 'time', s: 3600 }, target: { type: 'power', unit: 'pct_ftp', low: 100, high: 100 } }] };
  assert.deepEqual(totals(w), { seconds: 3600, minutes: 60, tss: 100, if: 1 });
});

test('validate finds bad steps', () => {
  assert.ok(validate({ version: 1, sport: 'swim', steps: [] }).length >= 2);
  assert.match(validate({ version: 1, sport: 'run', steps: [{ kind: 'work', duration: { type: 'time', s: 0 }, target: { type: 'open' } }] })[0], /bad duration/);
});

test('.zwo: warm-up ramp, IntervalsT for a two-step repeat, VO2 B written out', () => {
  const zwo = toZwo(bankWorkout('threshold-a', 'ride', 0, 90));
  assert.match(zwo, /<Warmup Duration="1800" PowerLow="0.560" PowerHigh="0.750">/);
  assert.match(zwo, /<IntervalsT Repeat="6" OnDuration="300" OffDuration="120" OnPower="1.000" OffPower="0.500">/);
  assert.match(zwo, /<sportType>bike<\/sportType>/);
  const vo2b = toZwo(bankWorkout('vo2-b', 'ride', 0, 60));
  assert.equal(vo2b.match(/<IntervalsT Repeat="6"/g).length, 3);
  assert.throws(() => toZwo(bankWorkout('vo2-a', 'run', 0, 60)));
});

import { deviceOf, hashOf, payloadFor, planSync } from './sync.mjs';
import { garminStepCount, garminTarget, toGarmin } from './garmin.mjs';
import { handleGarminWorkoutsGet, handleGarminWorkoutsPost, parseRemote } from './garmin-api.mjs';

const row = (id, extra = {}) => ({ id, day: '2026-10-21', title: '🚴 Threshold A — Zwift', workout_type: 'ride-threshold-a', status: 'planned', description: 'Rain, so Zwift.', steps: bankWorkout('threshold-a', 'ride', 0, 90), ...extra });
const run = (id, extra = {}) => row(id, { title: '🏃 VO2 A run', workout_type: 'run-vo2-a', steps: bankWorkout('vo2-a', 'run', 0, 60), ...extra });

test('deviceOf: runs to Garmin, indoor rides to Zwift, outdoor rides and skipped workouts to none', () => {
  assert.equal(deviceOf(run('r')), 'garmin');
  assert.equal(deviceOf(row('z')), 'zwift');
  assert.equal(deviceOf(row('o', { title: '🚴 Long ride', workout_type: 'ride-long' })), null);
  assert.equal(deviceOf(run('s', { status: 'skipped' })), null);
  assert.equal(deviceOf(run('t', { steps: null })), null);
});

test('toGarmin: HR in bpm from LTHR, a repeat group, open hard steps, run sport; step count matches Coach', () => {
  const w = bankWorkout('vo2-a', 'run', 0, 60);
  const g = toGarmin(w, { name: 'Coach · VO2 A run', description: 'note' });
  assert.equal(g.sportType.sportTypeKey, 'running');
  const [warm, rep] = g.workoutSegments[0].workoutSteps;
  assert.deepEqual([warm.stepType.stepTypeKey, warm.endConditionValue, warm.targetType.workoutTargetTypeId, warm.targetValueOne, warm.targetValueTwo], ['warmup', 900, 4, 101, 121]);
  assert.equal(rep.type, 'RepeatGroupDTO');
  assert.equal(rep.numberOfIterations, 4);
  assert.equal(rep.workoutSteps[0].targetType.workoutTargetTypeKey, 'no.target'); // hard: by effort
  assert.equal(garminStepCount(g.workoutSegments[0].workoutSteps), 11);
  // Step orders run through the repeat's children.
  assert.deepEqual(g.workoutSegments[0].workoutSteps.flatMap((s) => [s.stepOrder, ...(s.workoutSteps ?? []).map((c) => c.stepOrder)]), [1, 2, 3, 4, 5, 6]);
});

test('garminTarget: pace in m/s with the slower pace as the lower value; distance end', () => {
  assert.deepEqual(garminTarget({ type: 'pace', low: 240, high: 250 }), { targetType: { workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone' }, targetValueOne: 4, targetValueTwo: 4.167 });
  const test10k = toGarmin(bankWorkout('test-10k', 'run'), { name: 't' });
  const tenK = test10k.workoutSegments[0].workoutSteps.find((s) => s.endCondition?.conditionTypeKey === 'distance');
  assert.equal(tenK.endConditionValue, 10000);
});

test('toGarmin writes a nested repeat out (VO2 B on the bike): no group inside a group', () => {
  const g = toGarmin(bankWorkout('vo2-b', 'ride', 0, 60), { name: 't' });
  const groups = g.workoutSegments[0].workoutSteps.filter((s) => s.type === 'RepeatGroupDTO');
  assert.equal(groups.length, 3);
  assert.ok(groups.every((x) => x.workoutSteps.every((c) => c.type === 'ExecutableStepDTO')));
});

test('payloadFor: a .zwo file named by day for Zwift; nothing for the other device', () => {
  const p = payloadFor('zwift', row('z'));
  assert.equal(p.file, 'Coach - 2026-10-21 Threshold A  Zwift.zwo'.replace('  ', ' '));
  assert.match(p.xml, /<name>10-21 Threshold A — Zwift<\/name>/);
  assert.equal(payloadFor('garmin', row('z')), null);
  assert.equal(payloadFor('garmin', run('r')).workout.workoutName, 'Coach · VO2 A run');
});

test('planSync: create new, update changed, keep same, delete skipped, moved to another device and removed', () => {
  const same = run('same');
  const synced = [
    { activity_id: 'same', remote_id: '{}', content_hash: hashOf(payloadFor('garmin', same)) },
    { activity_id: 'moved', remote_id: '{}', content_hash: 'old' },
    { activity_id: 'skipped', remote_id: '{}', content_hash: 'x' },
    { activity_id: 'now-a-ride', remote_id: '{}', content_hash: 'x' },
    { activity_id: 'gone', remote_id: '{}', content_hash: 'x' },
  ];
  const rows = [run('new'), same, run('moved', { day: '2026-10-22' }), run('skipped', { status: 'skipped' }), row('now-a-ride')];
  const ops = planSync('garmin', rows, synced).map((o) => `${o.op}:${o.activityId}`);
  assert.deepEqual(ops, ['create:new', 'keep:same', 'update:moved', 'delete:skipped', 'delete:now-a-ride', 'delete:gone']);
});

test('the Garmin API: bearer only; ops without the unchanged; results stored with the remote ids', async () => {
  const synced = [{ activity_id: 'same', remote_id: JSON.stringify({ workoutId: 5, scheduleId: 7, date: '2026-10-21' }), content_hash: hashOf(payloadFor('garmin', run('same'))) }];
  const recorded = [];
  const repo = { load: async () => ({ rows: [run('same'), run('new')], synced, from: 'a', to: 'b' }), record: async (r) => recorded.push(r) };
  const tokens = { cron: 's' };
  assert.equal((await handleGarminWorkoutsGet({ authorization: 'Bearer x', tokens }, repo)).status, 401);
  const got = await handleGarminWorkoutsGet({ authorization: 'Bearer s', tokens }, repo);
  assert.deepEqual(got.body.ops.map((o) => [o.op, o.activityId]), [['create', 'new']]);
  assert.equal(got.body.ops[0].workout.workoutName, 'Coach · VO2 A run');
  const rawBody = JSON.stringify({ results: [{ activityId: 'new', op: 'create', ok: true, hash: 'h', remote: { workoutId: 9, scheduleId: 3, date: '2026-10-21' } }, { op: 'nope' }] });
  const post = await handleGarminWorkoutsPost({ authorization: 'Bearer s', tokens, rawBody }, repo);
  assert.deepEqual(post.body, { stored: 1 });
  assert.deepEqual(parseRemote(recorded[0].remoteId), { workoutId: 9, scheduleId: 3, date: '2026-10-21' });
  assert.deepEqual(parseRemote('not json'), {});
});

import { stepsOf } from '../plan/import.mjs';

test('stepsOf: a bank reference becomes steps for the sport of the workout type; bad steps fail the import', () => {
  const s = stepsOf({ title: 'VO2 A run', workoutType: 'run-vo2-a', workout: { bank: 'vo2-a', level: 1 } }, 60);
  assert.equal(s.sport, 'run');
  assert.equal(s.steps[1].count, 5);
  assert.equal(stepsOf({ title: 'Easy' }, 45), null);
  assert.throws(() => stepsOf({ title: 'Bad', steps: { version: 1, sport: 'ride', steps: [] } }, 45), /no steps/);
});

import { intervalsEvent } from './sync.mjs';
import { connectionProblems, intervalsClient } from './intervals.mjs';

test('intervalsEvent: a VirtualRide with our .zwo, a stable uid and a dated unique name', () => {
  const e = intervalsEvent({ ...row('a1'), start_time: '07:00' });
  assert.equal(e.type, 'VirtualRide');
  assert.equal(e.uid, 'coach:a1');
  assert.equal(e.name, '10-21 Threshold A — Zwift');
  assert.equal(e.start_date_local, '2026-10-21T07:00:00');
  assert.equal(e.filename, '10-21 Threshold A  Zwift.zwo');
  assert.match(e.file_contents, /<IntervalsT Repeat="6"/);
  assert.equal(payloadFor('intervals', run('r')), null); // runs go to Garmin
  assert.equal(payloadFor('intervals', row('z')).event.uid, 'coach:z');
});

test('connectionProblems and the client: Zwift link checks; create and update by id', async () => {
  assert.equal(connectionProblems({ zwift_user_id: 1 }).length, 0);
  assert.match(connectionProblems({})[0], /not connected/);
  assert.match(connectionProblems({ zwift_user_id: 1, zwift_upload_workouts: false })[0], /does not upload/);
  const calls = [];
  const c = intervalsClient({ INTERVALS_API_KEY: 'k', INTERVALS_ATHLETE_ID: 'i1' }, async (url, init) => {
    calls.push([url, init.method]);
    return { ok: true, status: 200, text: async () => '{"id":7}' };
  });
  assert.deepEqual(await c.create({}), { id: 7 });
  await c.update('7', {});
  assert.deepEqual(calls, [['https://intervals.icu/api/v1/athlete/i1/events', 'POST'], ['https://intervals.icu/api/v1/athlete/i1/events/7', 'PUT']]);
  assert.equal(intervalsClient({}), null);
});
