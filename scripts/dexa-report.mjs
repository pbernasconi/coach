#!/usr/bin/env node
/**
 * Prints every DEXA scan as one Markdown document (src/lib/vitals/dexa.mjs, `historyReport`): a table of the scans,
 * then each scan in full (regions, bone density, percentiles, RMR, change since the scan before), and the text of
 * uploaded report PDFs. For asking an AI about the scans. Reads the database only.
 *
 *   node --env-file=.env.local scripts/dexa-report.mjs [--no-files]
 */

import { fullScan, historyReport } from '../src/lib/vitals/dexa.mjs';

const { neon } = await import('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
const [owner] = await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`;
if (!owner) {
  console.log('No Coach user.');
  process.exit(0);
}
const rows = await sql`
  SELECT result_id, to_char(scan_date, 'YYYY-MM-DD') AS scan_date, location, scanner, age_years, height_cm, raw
  FROM dexa_scans WHERE user_id = ${owner.id} ORDER BY scan_date`;
const scans = rows.map((r) => fullScan({ resultId: r.result_id, scanDate: r.scan_date, location: r.location, scanner: r.scanner, ageYears: r.age_years, heightCm: r.height_cm, raw: r.raw }));
const dates = new Map(scans.map((s) => [s.resultId, s.scanDate]));
const files = process.argv.includes('--no-files')
  ? []
  : (await sql`SELECT id, name, kind, result_id, text FROM dexa_files WHERE user_id = ${owner.id} ORDER BY uploaded_at`).map((f) => ({
      name: f.name,
      kind: f.kind,
      scanDate: f.result_id ? dates.get(f.result_id) ?? null : null,
      url: `https://coach.paolobernasconi.com/api/dexa/files/${f.id}`,
      text: f.text,
    }));
console.log(historyReport(scans, files));
