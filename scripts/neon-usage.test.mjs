import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usageReport, formatReport } from './neon-usage.mjs';

// Synthetic values only.
const quota = { compute_time_seconds: 360000, data_transfer_bytes: 20e9 };
const project = (computeH, transferGb) => ({
  compute_time_seconds: computeH * 3600,
  data_transfer_bytes: transferGb * 1e9,
  consumption_period_start: '2026-11-01T00:00:00Z',
  consumption_period_end: '2026-12-01T00:00:00Z',
  settings: { quota },
});

test('level 0 when usage and pace are low', () => {
  const r = usageReport(project(10, 2), new Date('2026-11-15T00:00:00Z'));
  assert.equal(r.level, 0);
  assert.equal(r.overPace, false);
});

test('level 50 and 80 from the share of the worst quota', () => {
  assert.equal(usageReport(project(55, 2), new Date('2026-11-29T00:00:00Z')).level, 50);
  assert.equal(usageReport(project(10, 17), new Date('2026-11-29T00:00:00Z')).level, 80);
});

test('a pace that passes a quota warns, but not in the first 3 days', () => {
  const early = usageReport(project(5, 1), new Date('2026-11-02T00:00:00Z'));
  assert.equal(early.level, 0);
  const r = usageReport(project(20, 1), new Date('2026-11-05T00:00:00Z'));
  assert.equal(r.overPace, true);
  assert.equal(r.level, 50);
});

test('formatReport has one row for each quota', () => {
  const t = formatReport(usageReport(project(25, 5), new Date('2026-11-16T00:00:00Z')));
  assert.match(t, /\| Compute \| 25\.0 CU-hours \| 100 CU-hours \| 25% \|/);
  assert.match(t, /\| Data transfer \| 5\.0 GB \| 20 GB \| 25% \|/);
});
