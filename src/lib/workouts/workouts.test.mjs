import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANCHORS, flatten, targetText, totals, validate, zoneOf, zoneTarget } from './steps.mjs';
import { BANK, bankWorkout } from './bank.mjs';
import { durationText, stepLine, workoutText } from './intervals-text.mjs';
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

test('intervals.icu text: headings, repeats, % FTP for rides and % LTHR for runs; cues without digits', () => {
  assert.equal(durationText({ type: 'time', s: 330 }), '5m30s');
  assert.equal(durationText({ type: 'distance', m: 10000 }), '10km');
  const ride = workoutText(bankWorkout('threshold-a', 'ride', 0, 90));
  assert.match(ride, /^Warmup\n- Easy, building to zone two 30m 56-75%$/m);
  assert.match(ride, /^6x\n- Top of zone four\. Start reasonable, end with a little left 5m 96-104%\n- 2m 45-55%$/m);
  assert.doesNotMatch(ride, /Z\d/);
  const run = workoutText(bankWorkout('threshold-a', 'run', 0, 60));
  assert.match(run, /- .*5m 104-108% LTHR/);
  assert.equal(stepLine({ kind: 'work', duration: { type: 'time', s: 60 }, target: { type: 'open' }, notes: 'Go 5m hard at Z4' }), '- Go hard at 1m');
});

test('intervals.icu text writes the outer repeat of VO2 B out: 3 blocks of 6x', () => {
  const text = workoutText(bankWorkout('vo2-b', 'ride', 0, 60));
  assert.equal(text.match(/^6x$/gm).length, 3);
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

import { eventFor, eventType, hashOf, planSync } from './sync.mjs';
import { intervalsClient } from './intervals-api.mjs';

const row = (id, extra = {}) => ({ id, day: '2026-10-21', start_time: '07:00', title: '🚴 Threshold A — Zwift', workout_type: 'ride-threshold-a', status: 'planned', description: 'Rain, so Zwift.', steps: bankWorkout('threshold-a', 'ride', 0, 90), ...extra });

test('eventFor: an indoor ride for Zwift with the text, time, load and an external id; the emoji goes', () => {
  const e = eventFor(row('a'), row('a').steps);
  assert.equal(e.type, 'VirtualRide');
  assert.equal(e.name, 'Threshold A — Zwift');
  assert.equal(e.start_date_local, '2026-10-21T07:00:00');
  assert.equal(e.moving_time, 5400);
  assert.equal(e.external_id, 'coach-a');
  assert.match(e.description, /^Rain, so Zwift\.\n\nWarmup/);
  assert.equal(eventType({ title: 'Long ride' }, { sport: 'ride' }), null); // outdoor: Coach only
  assert.equal(eventType({ title: 'Easy run' }, { sport: 'run' }), 'Run');
});

test('planSync: create new, update changed, keep same, delete skipped and removed', () => {
  const same = row('same');
  const synced = [
    { activity_id: 'same', remote_id: '1', content_hash: hashOf(eventFor(same, same.steps)) },
    { activity_id: 'moved', remote_id: '2', content_hash: 'old' },
    { activity_id: 'skipped', remote_id: '3', content_hash: 'x' },
    { activity_id: 'gone', remote_id: '4', content_hash: 'x' },
  ];
  const outdoor = row('outdoor', { title: '🚴 Long ride', workout_type: 'ride-long' });
  const rows = [row('new'), same, row('moved', { day: '2026-10-22' }), row('skipped', { status: 'skipped' }), row('text-only', { steps: null }), outdoor];
  const ops = planSync(rows, synced, eventFor).map((o) => `${o.op}:${o.row?.id ?? o.prior.activity_id}`);
  assert.deepEqual(ops, ['create:new', 'keep:same', 'update:moved', 'delete:skipped', 'delete:gone']);
});

test('intervalsClient: Basic auth with API_KEY, and nothing without the env', async () => {
  assert.equal(intervalsClient({}), null);
  const calls = [];
  const c = intervalsClient({ INTERVALS_API_KEY: 'k', INTERVALS_ATHLETE_ID: 'i1' }, async (url, init) => {
    calls.push([url, init.method, init.headers.authorization]);
    return { ok: true, status: 200, text: async () => '{"id":42}' };
  });
  assert.deepEqual(await c.create({}), { id: 42 });
  assert.deepEqual(calls[0], ['https://intervals.icu/api/v1/athlete/i1/events', 'POST', `Basic ${Buffer.from('API_KEY:k').toString('base64')}`]);
});

import { stepsOf } from '../plan/import.mjs';

test('stepsOf: a bank reference becomes steps for the sport of the workout type; bad steps fail the import', () => {
  const s = stepsOf({ title: 'VO2 A run', workoutType: 'run-vo2-a', workout: { bank: 'vo2-a', level: 1 } }, 60);
  assert.equal(s.sport, 'run');
  assert.equal(s.steps[1].count, 5);
  assert.equal(stepsOf({ title: 'Easy' }, 45), null);
  assert.throws(() => stepsOf({ title: 'Bad', steps: { version: 1, sport: 'ride', steps: [] } }, 45), /no steps/);
});
