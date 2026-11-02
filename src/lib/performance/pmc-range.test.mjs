import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysInRange, isPmcRange, packPmcDays, pmcAxis, PMC_RANGES, unpackPmcDays } from './pmc-range.mjs';

const series = (from, n, projectedFrom = Infinity) =>
  Array.from({ length: n }, (_, k) => ({ date: new Date(Date.parse(`${from}T00:00:00Z`) + k * 86400000).toISOString().slice(0, 10), projected: k >= projectedFrom }));

test('daysInRange keeps the last N days and the whole projection', () => {
  const days = series('2025-01-01', 700, 669);
  const today = days[668].date;
  const d90 = daysInRange(days, today, '90');
  assert.equal(d90.filter((d) => !d.projected).length, 91, '90 days back plus today');
  assert.equal(d90.filter((d) => d.projected).length, 31);
  assert.equal(daysInRange(days, today, '30').filter((d) => !d.projected).length, 31);
  assert.equal(daysInRange(days, today, 'all').length, 700);
  assert.equal(daysInRange(days, today, 'nope').length, 700);
  assert.equal(daysInRange(days, today, '365').filter((d) => !d.projected).length, 366);
});

test('isPmcRange', () => {
  assert.ok(PMC_RANGES.every((r) => isPmcRange(r.id)));
  assert.equal(isPmcRange('60'), false);
  assert.equal(isPmcRange(90), false);
});

test('pmcAxis: Mondays and every month on short spans', () => {
  const days = series('2026-08-01', 120);
  const { grid, labels } = pmcAxis(days, 1000);
  assert.ok(grid.length >= 16 && grid.length <= 18, 'weekly lines');
  assert.deepEqual(labels.map((l) => l.text), ['Aug', 'Sep', 'Oct', 'Nov']);
});

test('pmcAxis: dated Mondays when zoomed in', () => {
  const { labels } = pmcAxis(series('2026-10-01', 60), 1000);
  assert.deepEqual(labels.slice(0, 2).map((l) => l.text), ['Oct 5', 'Oct 12']);
});

test('pmcAxis: month lines, quarters and years on long spans', () => {
  const days = series('2021-03-15', 2000);
  const { grid, labels } = pmcAxis(days, 1000);
  assert.ok(grid.every((i) => days[i].date.endsWith('-01')), 'grid on month starts');
  assert.deepEqual(labels.slice(0, 4).map((l) => l.text), ['Apr', 'Jul', 'Oct', '2022'], 'quarters');
  const decade = pmcAxis(series('2016-03-15', 4000), 1000).labels;
  assert.ok(decade.every((l) => /^\d{4}$/.test(l.text)), `years only: ${decade.map((l) => l.text)}`);
  const year = pmcAxis(series('2025-10-01', 400), 1000);
  assert.ok(year.labels.some((l) => l.text === '2026'), 'January reads as the year');
  assert.ok(year.labels.some((l) => l.text === 'Nov'));
});

test('packPmcDays round-trips daily days with a projected tail, and is much smaller', () => {
  const days = series('2014-03-01', 4500, 4400).map((d, k) => ({ ...d, ctl: 40 + (k % 13) / 3, atl: 50 - (k % 7) / 3, tsb: -10 + (k % 5) / 3, tss: (k * 37) % 180 }));
  const packed = packPmcDays(days);
  assert.equal(packed.dates, undefined, 'consecutive days need no dates');
  assert.equal(packed.projectedFrom, 4400);
  const back = unpackPmcDays(packed);
  assert.equal(back.length, 4500);
  assert.deepEqual(back[0], { date: '2014-03-01', ctl: 40, atl: 50, tsb: -10, tss: 0, projected: false });
  assert.equal(back[4399].projected, false);
  assert.equal(back[4400].projected, true);
  assert.equal(back[4499].date, days[4499].date);
  assert.equal(back[17].ctl, Math.round(days[17].ctl * 10) / 10);
  const objects = JSON.stringify(days.map((d) => ({ ...d, ctl: Math.round(d.ctl * 10) / 10, atl: Math.round(d.atl * 10) / 10, tsb: Math.round(d.tsb * 10) / 10 }))).length;
  assert.ok(JSON.stringify(packed).length < objects / 3, 'under a third of the objects');
});

test('packPmcDays keeps dates and flags when days skip or projections interleave', () => {
  const days = [
    { date: '2026-01-01', ctl: 1, atl: 2, tsb: -1, tss: 10, projected: false },
    { date: '2026-01-03', ctl: 1.26, atl: 2, tsb: -0.74, tss: 0, projected: true },
    { date: '2026-01-04', ctl: 1, atl: 2, tsb: -1, tss: 0, projected: false },
  ];
  const back = unpackPmcDays(packPmcDays(days));
  assert.deepEqual(back.map((d) => [d.date, d.projected, d.ctl]), [['2026-01-01', false, 1], ['2026-01-03', true, 1.3], ['2026-01-04', false, 1]]);
  assert.deepEqual(unpackPmcDays(packPmcDays([])), []);
});
