import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysInRange, isPmcRange, pmcAxis, PMC_RANGES } from './pmc-range.mjs';

const series = (from, n, projectedFrom = Infinity) =>
  Array.from({ length: n }, (_, k) => ({ date: new Date(Date.parse(`${from}T00:00:00Z`) + k * 86400000).toISOString().slice(0, 10), projected: k >= projectedFrom }));

test('daysInRange keeps the last N days and the whole projection', () => {
  const days = series('2025-01-01', 700, 669);
  const today = days[668].date;
  const d90 = daysInRange(days, today, '90');
  assert.equal(d90.filter((d) => !d.projected).length, 91, '90 days back plus today');
  assert.equal(d90.filter((d) => d.projected).length, 31);
  assert.equal(daysInRange(days, today, 'all').length, 700);
  assert.equal(daysInRange(days, today, 'nope').length, 700);
  assert.equal(daysInRange(days, today, '365').filter((d) => !d.projected).length, 366);
});

test('isPmcRange', () => {
  assert.ok(PMC_RANGES.every((r) => isPmcRange(r.id)));
  assert.equal(isPmcRange('30'), false);
  assert.equal(isPmcRange(90), false);
});

test('pmcAxis: Mondays and every month on short spans', () => {
  const days = series('2026-08-01', 120);
  const { grid, labels } = pmcAxis(days, 1000);
  assert.ok(grid.length >= 16 && grid.length <= 18, 'weekly lines');
  assert.deepEqual(labels.map((l) => l.text), ['Aug', 'Sep', 'Oct', 'Nov']);
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
