import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAdherence } from './adherence.mjs';
import { parseReview, REVIEW_SCHEMA, reviewInput, reviewKey } from './review.mjs';
import { reviewView } from './review-view.mjs';
import { bankWorkout } from '../workouts/bank.mjs';
import { fixture } from './fixtures/vo2-run-2026-11-17.mjs';

const workout = bankWorkout('vo2-a', 'run', 1, 60);
const { series, laps } = fixture();
const analysis = analyzeAdherence({ workout, series, laps, anchors: { lthr: 168, paceS: 270 } });

const activity = {
  name: 'Morning Run', day: '2026-11-17', startLocal: '2026-11-17T08:38:34', sportType: 'Run', place: 'Zurich, Switzerland', trainer: false,
  stats: { distance: 11854, moving: 3901, elapsed: 3934, avgSpeed: 3.039, avgGapSpeed: 3.05, avgHr: 158, maxHr: 181, elevGain: 36 },
  weather: { tempC: 4, windKmh: 9 },
  watch: { aerobicTe: 3.8, anaerobicTe: 2.4, teLabel: 'VO2 Max', load: 180 },
  effort: { tss: 87 },
};

test('reviewInput gives Claude the plan, every step, the set and the context', () => {
  const text = reviewInput({
    activity,
    planned: { title: 'VO2 A run', description: '5 × 3 min hard', steps: workout },
    analysis,
    feedback: { feel: 4, rpe: 8, comment: 'legs fine' },
    anchors: { lthr: 168, ftp: 265, maxHr: 182, paceS: 270 },
    load: { before: { ctl: 61.2, atl: 70.4, tsb: -9.2 }, after: { ctl: 62, atl: 72, tsb: -10 } },
    garmin: { sleep_total_min: 412, hrv_night_avg_ms: 48 },
    history: [{ day: '2026-11-03', title: 'VO2 A: 5×3 min hard', score: 90, sets: analysis.sets, headline: 'Even reps.', nextTime: ['Start rep 1 at 4:50.'] }],
    next: { date: '2026-11-24', title: 'VO2 A run', steps: bankWorkout('vo2-a', 'run', 2, 60) },
  });
  assert.match(text, /<planned_workout>\nVO2 A run \(bank vo2-a, level 1\)/);
  assert.match(text, /- Rep 1\/5: planned 3:00 at Hard \| done 2:59, .*5:41\/km.* \| Too easy/);
  assert.match(text, /- Lactate clearance: planned 15:00 at 144–153 bpm .* \| Too hard/);
  assert.match(text, /4 of 5 reps on target/);
  assert.match(text, /felt strong · RPE 8/);
  assert.match(text, /aligned_by="the watch's laps/);
  assert.match(text, /threshold pace 4:30\/km/);
  assert.match(text, /form \(TSB\) -9/);
  assert.match(text, /slept 6 h 52 min/);
  assert.match(text, /Your tips then: "Start rep 1 at 4:50."/);
  assert.match(text, /<next_time_in_the_plan>\n2026-11-24: VO2 A run/);
});

test('parseReview trims, caps the lists and rejects an empty answer', () => {
  const ok = parseReview(JSON.stringify({
    headline: '  Four strong reps.  ', rating: 'solid', training_effect: 'VO2 work.',
    went_well: ['a', 'b', 'c', 'd', 'e'], to_improve: [], next_time: ['Start at 4:50/km.'],
  }));
  assert.ok('review' in ok);
  assert.equal(ok.review.headline, 'Four strong reps.');
  assert.equal(ok.review.wentWell.length, 4);
  assert.deepEqual(ok.review.toImprove, []);
  assert.ok('error' in parseReview('not json'));
  assert.ok('error' in parseReview(JSON.stringify({ headline: 'x', rating: 'solid', went_well: [], next_time: [] })));
  assert.equal(parseReview(JSON.stringify({ headline: 'x', rating: 'great', next_time: ['y'] })).review.rating, 'mixed');
  assert.deepEqual(REVIEW_SCHEMA.required, ['headline', 'rating', 'training_effect', 'went_well', 'to_improve', 'next_time']);
});

test('reviewKey changes with a new feel, not with nothing', () => {
  const base = { promptVersion: 'p1', plannedId: 'w1', steps: workout, analysis, feedback: null };
  assert.equal(reviewKey(base), reviewKey({ ...base }));
  assert.notEqual(reviewKey(base), reviewKey({ ...base, feedback: { feel: 4, rpe: 8, comment: null } }));
  assert.notEqual(reviewKey(base), reviewKey({ ...base, promptVersion: 'p2' }));
});

test('reviewView: the score, the rows, the reps and the sections', () => {
  const v = reviewView(analysis, {
    status: 'ready',
    review: { headline: 'H', rating: 'solid', trainingEffect: 'E', wentWell: ['W'], toImprove: [], nextTime: ['N'] },
  });
  assert.equal(v.scoreWord, 'Partly on plan');
  assert.equal(v.steps[1].doneText, '2:59 · 5:41/km');
  assert.equal(v.steps[1].verdictLabel, 'Too easy');
  assert.equal(v.sets[0].reps.length, 5);
  assert.equal(v.sets[0].reps[4].text, '4:31');
  assert.ok(v.sets[0].stats.some((s) => s.label === 'HR drop per recovery'));
  assert.deepEqual(v.ai.sections.map((s) => s.key), ['effect', 'well', 'next']);
  assert.equal(v.ai.ratingLabel, 'Solid');
  assert.equal(reviewView(analysis, { status: 'pending', review: null }).ai.sections.length, 0);
  assert.equal(reviewView(null, null), null);
});
