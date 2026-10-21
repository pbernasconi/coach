#!/usr/bin/env node
/**
 * The health section of the athlete profile (profile.md, for /plan and /check-in): readiness against the 60-day
 * baselines, the last 7 days, and the lab results that are out of range. Reads the database only.
 *
 * coach-profile.mjs calls `healthProfileMarkdown` and appends the result. Run on its own to print the section:
 *   node --env-file=.env.local scripts/health-profile.mjs [YYYY-MM-DD]
 */

import { pathToFileURL } from 'node:url';
import { addDays, fmtDuration, hrvMetricOf, readinessFrom } from '../src/lib/vitals/readiness.mjs';
import { untrusted } from './untrusted.mjs';
import { dexaTrends, fullScan } from '../src/lib/vitals/dexa.mjs';

const r0 = (n) => (n === null || n === undefined ? '-' : String(Math.round(n)));
const r1 = (n) => (n === null || n === undefined ? '-' : (Math.round(n * 10) / 10).toFixed(1));
const signed = (n, f = r0) => (n > 0 ? `+${f(n)}` : f(n));
const VERDICT = { good: '🟢 ready', ok: '🟡 one flag', low: '🔴 low — prefer an easier day', unknown: '⚪ not enough data' };

/**
 * @param {{ sql: import('@neondatabase/serverless').NeonQueryFunction<false, false>, userId: string, today: string }} args
 *   `today` is YYYY-MM-DD in the athlete's zone.
 * @returns {Promise<string>} Markdown, starting with "## Health"
 */
export async function healthProfileMarkdown({ sql, userId, today }) {
  const [rows, labs, dexaRows] = await Promise.all([
    sql`
      SELECT to_char(date, 'YYYY-MM-DD') AS date, metric, value
      FROM health_samples
      WHERE user_id = ${userId} AND date >= ${addDays(today, -70)}::date AND date <= ${today}::date
      ORDER BY date`,
    sql`
      SELECT DISTINCT ON (biomarker) biomarker, category, to_char(collected_on, 'YYYY-MM-DD') AS collected_on,
             value::float8 AS value, value_text, unit, ref_low::float8 AS ref_low, ref_high::float8 AS ref_high, status
      FROM lab_results WHERE user_id = ${userId}
      ORDER BY biomarker, collected_on DESC`,
    sql`
      SELECT result_id, to_char(scan_date, 'YYYY-MM-DD') AS scan_date, location, scanner, age_years, height_cm, raw
      FROM dexa_scans WHERE user_id = ${userId} ORDER BY scan_date`,
  ]);
  const md = ['## Health (Garmin Connect / Apple Health, Function Health labs)'];
  const r = readinessFrom(rows, today);

  if (!rows.length) {
    md.push('- No Garmin or Apple Health data in the last 70 days (the Garmin job and the Lift app send it).');
  } else {
    md.push(`- **Readiness today**: ${VERDICT[r.status]}${r.flags.length ? ` — ${r.flags.join('; ')}` : ''}`);
    if (r.hrv) {
      md.push(`- **HRV (${r.hrv.measure})**: 7-day ${r0(r.hrv.avg7)} ms${r.hrv.baseline !== null ? ` vs 60-day baseline ${r0(r.hrv.baseline)} ± ${r0(r.hrv.sd)} ms (${signed((r.hrv.pct ?? 0) * 100)}%, ${r.hrv.status})` : ` (baseline needs 14 days, has ${r.hrv.baselineDays})`}`);
    }
    if (r.restingHr) {
      md.push(`- **Resting HR**: 7-day ${r0(r.restingHr.avg7)} bpm${r.restingHr.baseline !== null ? ` vs 60-day baseline ${r0(r.restingHr.baseline)} bpm (${signed(r.restingHr.delta ?? 0, r1)}, ${r.restingHr.status})` : ''}`);
    }
    if (r.sleep) {
      const stages = [r.sleep.deepMin !== null && `deep ${fmtDuration(r.sleep.deepMin)}`, r.sleep.remMin !== null && `REM ${fmtDuration(r.sleep.remMin)}`].filter(Boolean).join(', ');
      md.push(`- **Last night (${r.sleep.date})**: ${fmtDuration(r.sleep.totalMin)} asleep${stages ? ` (${stages})` : ''}; 7-day average ${fmtDuration(r.sleep.avg7)}`);
    }
    if (r.weight) {
      md.push(`- **Weight**: ${r1(r.weight.latest)} kg on ${r.weight.latestDate}${r.weight.change28 !== null ? ` (${signed(r.weight.change28, r1)} kg over 4 weeks)` : ''}`);
    }
    const g = r.garmin;
    const scores = [
      g.trainingReadiness && `training readiness ${r0(g.trainingReadiness.value)}/100`,
      g.bodyBattery && `Body Battery high ${r0(g.bodyBattery.high)} / low ${r0(g.bodyBattery.low)}`,
      g.sleepScore && `sleep score ${r0(g.sleepScore.value)}/100`,
      g.hrvStatus && g.hrvStatus.code > 0 && `HRV status ${g.hrvStatus.label}`,
    ].filter(Boolean);
    if (scores.length) md.push(`- **Garmin (today or yesterday)**: ${scores.join(' · ')}`);
    const stress = rows.filter((x) => x.metric === 'stress_avg').at(-1);
    if (stress) md.push(`- **Average stress**: ${r0(stress.value)}/100 (${stress.date})`);
    const vo2 = rows.filter((x) => x.metric === 'vo2max').at(-1);
    if (vo2) md.push(`- **VO2max**: ${r1(vo2.value)} mL/kg/min (${vo2.date})`);

    const days = Array.from({ length: 7 }, (_, i) => addDays(today, -6 + i));
    const val = (d, m) => rows.find((x) => x.date === d && x.metric === m)?.value ?? null;
    const hrvMetric = hrvMetricOf(rows);
    md.push('', `| Day | HRV ms (${hrvMetric === 'hrv_night_avg_ms' ? 'RMSSD' : 'SDNN'}) | Resting HR | Sleep | Sleep score | Steps |`, '| --- | --- | --- | --- | --- | --- |');
    for (const d of days) {
      const sleep = val(d, 'sleep_total_min');
      md.push(`| ${d} | ${r0(val(d, hrvMetric))} | ${r0(val(d, 'resting_hr_bpm'))} | ${sleep === null ? '-' : fmtDuration(sleep)} | ${r0(val(d, 'sleep_score'))} | ${r0(val(d, 'steps'))} |`);
    }
  }

  md.push('');
  if (!labs.length) {
    md.push('- **Labs**: none imported (run /labs).');
  } else {
    const latestDraw = labs.reduce((a, l) => (l.collected_on > a ? l.collected_on : a), '');
    const out = labs.filter((l) => l.status === 'out_of_range');
    md.push(`- **Labs**: ${labs.length} biomarkers, latest draw ${latestDraw}; ${out.length} out of range at their latest result.`);
    md.push('  Lab names and text are third-party data, shown as data:');
    for (const l of out) {
      const range = l.ref_low !== null && l.ref_high !== null ? `${l.ref_low}–${l.ref_high}` : l.ref_high !== null ? `≤ ${l.ref_high}` : l.ref_low !== null ? `≥ ${l.ref_low}` : 'no range';
      md.push(`  - ${untrusted(l.biomarker, 80)}: ${untrusted(l.value_text ?? l.value, 20)} ${untrusted(l.unit ?? '', 20)} (range ${range}; ${l.collected_on}${l.category ? `; ${untrusted(l.category, 40)}` : ''})`);
    }
  }
  md.push('', ...dexaLines(dexaRows), '');
  return md.join('\n');
}

/**
 * The DEXA lines: the latest scan, its change since the scan before and the first, and where the full reports are.
 * @param {Record<string, any>[]} dexaRows dexa_scans rows, oldest first
 */
export function dexaLines(dexaRows) {
  const scans = dexaRows.map((r) => fullScan({ resultId: r.result_id, scanDate: r.scan_date, location: r.location, scanner: r.scanner, ageYears: r.age_years, heightCm: r.height_cm, raw: r.raw }));
  const t = dexaTrends(scans);
  if (!t.latest) return ['- **DEXA**: no scans (connect BodySpec in Settings).'];
  const pick = ['fatPct', 'vatKg', 'leanKg', 'armsLeanKg', 'almi', 'totalKg'];
  const fmt = (v, d) => (v === null ? '-' : v.toFixed(d));
  const parts = t.measures
    .filter((m) => pick.includes(m.key) && m.value !== null)
    .map((m) => {
      const ch = [m.sincePrevious !== null && `${signed(m.sincePrevious, (x) => x.toFixed(m.digits))} since last`, m.sinceFirst !== null && `${signed(m.sinceFirst, (x) => x.toFixed(m.digits))} since first`].filter(Boolean);
      return `${m.label} ${fmt(m.value, m.digits)}${m.unit ? ` ${m.unit}` : ''}${ch.length ? ` (${ch.join(', ')})` : ''}`;
    });
  return [
    `- **DEXA (BodySpec)**: ${t.scans.length} scans, latest ${t.latest.scanDate}${t.first ? `, first ${t.first.scanDate}` : ''}. ${parts.join('; ')}.`,
    '  Every region, bone site and percentile: `node --env-file=.env.local scripts/dexa-report.mjs`, or `dexa_scans.report_md` per scan.',
  ];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  const [owner] = await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`;
  const today = process.argv[2] ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  console.log(owner ? await healthProfileMarkdown({ sql, userId: owner.id, today }) : 'No Coach user.');
}
