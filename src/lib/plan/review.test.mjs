import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanReview, summaryBlocks, weekOutlook } from './review.mjs';

test('the review is cleaned: decisions need a title, long text is clipped, an empty review is null', () => {
  const r = cleanReview({
    headline: '  Test week:   fresh legs Friday ',
    reasoning: ['CTL −2/wk', '', 3],
    decisions: [{ title: 'Test on Friday', why: 'Fresh after Thu', tradeoff: 'Threshold B slips' }, { why: 'no title' }],
    watch: ['x'.repeat(400)],
  });
  assert.equal(r.headline, 'Test week: fresh legs Friday');
  assert.deepEqual(r.reasoning, ['CTL −2/wk']);
  assert.equal(r.decisions.length, 1);
  assert.equal(r.watch[0].length, 160);
  assert.equal(cleanReview({}), null);
  assert.equal(cleanReview(null), null);
});

test('an older markdown summary becomes titled blocks', () => {
  const b = summaryBlocks('**Fitness:** CTL 52.\n**Rotation changes:**\n- The test takes B.\n- Thu is easy.\nloose line');
  assert.deepEqual(b, [
    { title: 'Fitness', lines: ['CTL 52.'] },
    { title: 'Rotation changes', lines: ['The test takes B.', 'Thu is easy.', 'Loose line'] },
  ]);
  assert.deepEqual(summaryBlocks(null), []);
});

test('the outlook projects fitness and form through the week and compares TSS with the last 4 weeks', () => {
  // 35 days of 50 TSS at a steady CTL/ATL of 50, up to Thursday 2026-10-22.
  const history = [];
  for (let d = new Date('2026-09-18T12:00:00Z'); d <= new Date('2026-10-22T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    history.push({ date: d.toISOString().slice(0, 10), ctl: 50, atl: 50, tsb: 0, tss: 50 });
  }
  const rows = [
    { date: '2026-10-27', tss: 100, duration: 60, activityType: 'ride' },
    { date: '2026-10-31', tss: 200, duration: 180, activityType: 'ride' },
    { date: '2026-10-26', tss: 0, duration: 0, activityType: 'rest' },
  ];
  const o = weekOutlook(history, [], rows, { today: '2026-10-22', weekStart: '2026-10-26' });
  assert.equal(o.plannedTss, 300);
  assert.equal(o.plannedMin, 240);
  assert.equal(o.sessions, 2);
  assert.equal(o.avgTss, 350);
  // Fri–Sun before the week have no plan: fitness drops, form rises.
  assert.ok(o.start.ctl < 50 && o.start.tsb > 0);
  assert.ok(o.end.ctl < o.start.ctl);
  assert.deepEqual(weekOutlook([], [], rows, { today: '2026-10-22', weekStart: '2026-10-26' }).start, null);
});
