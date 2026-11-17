import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAdherence, plannedSteps } from './adherence.mjs';
import { bankWorkout } from '../workouts/bank.mjs';
import { fixture, LAPS } from './fixtures/vo2-run-2026-11-17.mjs';

const VO2 = bankWorkout('vo2-a', 'run', 1, 60); // 15:00 warm-up, 5 × (3:00 hard, 3:00 easy), 15:00 top of Z2
const anchors = { lthr: 168, paceS: 270 };

test('plannedSteps labels the reps and their recoveries', () => {
  const labels = plannedSteps(VO2).map((p) => p.label);
  assert.deepEqual(labels.slice(0, 4), ['Warm-up', 'Rep 1/5', 'Easy 1/5', 'Rep 2/5']);
  assert.equal(labels.at(-1), 'Lactate clearance');
  const vo2b = plannedSteps(bankWorkout('vo2-b', 'ride', 0, 75)).map((p) => p.label);
  assert.ok(vo2b.includes('Set 2/3 · rep 6/6'));
  assert.ok(vo2b.includes('Easy after set 1'));
});

test('the 2026-11-17 VO2 run: laps are the steps, rep 1 jogged, the clearance ran in zone three', () => {
  const { series, laps } = fixture();
  const r = analyzeAdherence({ workout: VO2, series, laps, anchors });
  assert.equal(r.alignment, 'laps');
  const by = Object.fromEntries(r.steps.map((s) => [s.label, s]));
  assert.equal(by['Warm-up'].end, 914);
  assert.equal(by['Rep 1/5'].verdict, 'easy');
  for (const k of [2, 3, 4, 5]) assert.equal(by[`Rep ${k}/5`].verdict, 'hit', `rep ${k}`);
  assert.equal(by['Rep 5/5'].actual.paceS, 271); // 663 m in 3:00
  assert.equal(by['Rep 5/5'].actual.maxHr, 181);
  assert.equal(by['Lactate clearance'].verdict, 'hard');
  assert.equal(by['Warm-up'].verdict, 'close'); // an easy jog in zone two
  const [set] = r.sets;
  assert.equal(set.hit, 4);
  assert.equal(set.total, 5);
  assert.ok(set.fadePct < 0, 'the last rep was the fastest');
  assert.ok(set.hrRecoveryBpm > 10);
  assert.ok(r.score >= 60 && r.score < 85, `score ${r.score}`);
  assert.equal(r.level, 'partial');
  assert.ok(r.totals.extraS > 250);
  assert.ok(r.flags.some((f) => /Rep 1\/5 was too easy/.test(f)));
  assert.ok(r.flags.some((f) => /Lactate clearance ran above/.test(f)));
});

test('the same run with 1 km auto-laps only: the interval pattern is found in the pace', () => {
  const { series } = fixture();
  // A watch that did not run the workout: laps every km, which never meet the steps' ends.
  const laps = [];
  let lastI = 0;
  let km = 1000;
  for (let i = 0; i < series.t.length; i++) {
    if (series.d[i] >= km) {
      laps.push({ elapsed: series.t[i] - series.t[lastI], moving: series.t[i] - series.t[lastI], distance: 1000, startIndex: lastI });
      lastI = i;
      km += 1000;
    }
  }
  const r = analyzeAdherence({ workout: VO2, series, laps, anchors });
  assert.equal(r.alignment, 'pattern');
  const rep5 = r.steps.find((s) => s.label === 'Rep 5/5');
  assert.ok(Math.abs(rep5.start - 2367) <= 30, `rep 5 starts at ${rep5.start}`);
  assert.equal(rep5.verdict, 'hit');
});

test('a run stopped early: the steps after the stop are not done', () => {
  const { series, laps } = fixture();
  const cut = series.t.findIndex((t) => t >= 1830);
  const short = {
    ...series, t: series.t.slice(0, cut), d: series.d.slice(0, cut), speed: series.speed.slice(0, cut), gap: series.gap.slice(0, cut),
    hr: series.hr.slice(0, cut), bucketStart: series.bucketStart.slice(0, cut),
  };
  const r = analyzeAdherence({ workout: VO2, series: short, laps: laps.slice(0, 8), anchors });
  const missed = r.steps.filter((s) => s.verdict === 'missed').map((s) => s.label);
  assert.ok(missed.includes('Lactate clearance'));
  assert.ok(missed.includes('Rep 5/5'));
  assert.ok(r.flags.some((f) => /Lactate clearance \(15:00\) was not done/.test(f)));
  assert.equal(r.level, 'off');
});

test('a ride judged by power: threshold reps at the target are hits, one well under is too easy', () => {
  const w = bankWorkout('threshold-a', 'ride', 0, 75); // 30:00 Z2, 6 × (5:00 Z4 top, 2:00 Z1), 15:00 Z2 top, easy
  const ftp = 265;
  const steps = plannedSteps(w);
  const t = [];
  const watts = [];
  const laps = [];
  let time = 0;
  for (const [i, p] of steps.entries()) {
    const s = p.step;
    const mid = s.target.type === 'power' ? ((s.target.low + s.target.high) / 200) * ftp : 150;
    const target = p.label === 'Rep 6/6' ? mid * 0.85 : mid;
    laps.push({ elapsed: s.duration.s, moving: s.duration.s, distance: 0, startIndex: t.length });
    for (let k = 0; k < s.duration.s; k += 5) {
      t.push(time + k);
      watts.push(Math.round(target));
    }
    time += s.duration.s;
    if (i === steps.length - 1) break;
  }
  const series = { full: t.length, bucketStart: t.map((_, i) => i), t, d: null, speed: null, gap: null, hr: null, watts };
  const r = analyzeAdherence({ workout: w, sport: 'ride', series, laps, anchors: { ftp, lthr: 168 } });
  assert.equal(r.alignment, 'laps');
  const reps = r.steps.filter((s) => s.kind === 'work' && s.block != null);
  assert.deepEqual(reps.map((s) => s.verdict), ['hit', 'hit', 'hit', 'hit', 'hit', 'easy']);
  assert.equal(r.sets[0].hit, 5);
  assert.ok(r.sets[0].avgWatts > 240);
  assert.equal(reps[0].inTargetPct, 100);
});

test('no steps, no analysis', () => {
  const { series, laps } = fixture();
  assert.equal(analyzeAdherence({ workout: { version: 1, sport: 'run', name: 'x', steps: [] }, series, laps }), null);
  assert.equal(LAPS.length, 17);
});
