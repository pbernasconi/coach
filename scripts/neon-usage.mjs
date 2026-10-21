#!/usr/bin/env node
// Neon usage against the project's hard quotas (compute and data transfer). At a quota Neon stops production until
// the next month, so neon-usage.yml runs this every day and opens an issue at 50% and 80%, or when the month's pace
// would pass a quota. It reads only the Neon API, so it never wakes the database.
//
//   NEON_API_KEY=… node scripts/neon-usage.mjs        # prints a table; writes level=0|50|80 and title= for Actions
//
// Pure maths in usageReport (neon-usage.test.mjs).
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const PROJECT_ID = 'falling-mud-04838480';

/**
 * @param {{ compute_time_seconds: number, data_transfer_bytes: number, consumption_period_start: string,
 *   consumption_period_end: string, settings?: { quota?: { compute_time_seconds?: number, data_transfer_bytes?: number } } }} p
 * @param {Date} now
 */
export function usageReport(p, now = new Date()) {
  const start = Date.parse(p.consumption_period_start);
  const end = Date.parse(p.consumption_period_end);
  const elapsed = Math.min(1, Math.max(0.01, (now.getTime() - start) / (end - start)));
  const quota = p.settings?.quota ?? {};
  const rows = [
    { name: 'Compute', used: p.compute_time_seconds / 3600, quota: (quota.compute_time_seconds ?? 0) / 3600, unit: 'CU-hours' },
    { name: 'Data transfer', used: p.data_transfer_bytes / 1e9, quota: (quota.data_transfer_bytes ?? 0) / 1e9, unit: 'GB' },
  ]
    .filter((r) => r.quota > 0)
    .map((r) => ({ ...r, share: r.used / r.quota, pace: r.used / elapsed / r.quota }));
  const worst = Math.max(0, ...rows.map((r) => r.share));
  const fastest = Math.max(0, ...rows.map((r) => r.pace));
  // A pace check only after the first 3 days: one busy day at the start of a month says little.
  const overPace = elapsed >= 0.1 && fastest > 1;
  const level = worst >= 0.8 ? 80 : worst >= 0.5 || overPace ? 50 : 0;
  return { rows, level, overPace, elapsed, periodEnd: p.consumption_period_end.slice(0, 10) };
}

/** @param {ReturnType<typeof usageReport>} r */
export function formatReport(r) {
  const pct = (x) => `${Math.round(x * 100)}%`;
  const lines = [
    `| | Used | Quota | Used so far | At this pace by ${r.periodEnd} |`,
    '| --- | --- | --- | --- | --- |',
    ...r.rows.map((x) => `| ${x.name} | ${x.used.toFixed(1)} ${x.unit} | ${x.quota.toFixed(0)} ${x.unit} | ${pct(x.share)} | ${pct(x.pace)} |`),
  ];
  return lines.join('\n');
}

async function main() {
  const key = process.env.NEON_API_KEY;
  if (!key) {
    console.error('NEON_API_KEY is not set.');
    process.exit(3);
  }
  const res = await fetch(`https://console.neon.tech/api/v2/projects/${PROJECT_ID}`, {
    headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Neon API: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const { project } = await res.json();
  const r = usageReport(project);
  const table = formatReport(r);
  console.log(table);
  const title = r.level === 80 ? 'Neon usage is over 80% of a quota'
    : r.overPace && r.rows.every((x) => x.share < 0.5) ? 'Neon usage: this pace passes a quota before the month ends'
    : 'Neon usage is over 50% of a quota';
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `level=${r.level}\ntitle=${title}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table}\n`);
  if (process.env.REPORT_FILE) appendFileSync(process.env.REPORT_FILE, `${table}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
