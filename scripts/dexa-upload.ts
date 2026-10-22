// Uploads DEXA files (BodySpec PDF reports, scan images) for the owner straight to the database, as the upload
// button on /health/dexa does: a report files itself under its scan by the date inside it and gives that scan its
// composite image. Then clears the page cache.
//
//   node --env-file=.env.local --import tsx scripts/dexa-upload.ts ~/Downloads/bodyspec-results*.pdf
import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { sql } from '@/db';
import { loadFiles, loadScans, saveFile, scanForName } from '@/lib/vitals/dexa-store';

const TYPES: Record<string, string> = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

async function main() {
  const paths = process.argv.slice(2);
  if (!paths.length) throw new Error('Usage: dexa-upload.ts <file.pdf|png|jpg> …');
  const [owner] = (await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`) as { id: string }[];
  if (!owner) throw new Error('No owner in users.');
  const scans = await loadScans(owner.id);
  for (const path of paths) {
    const contentType = TYPES[extname(path).toLowerCase()];
    if (!contentType) {
      console.log(`skip ${path}: not a PDF or image`);
      continue;
    }
    const name = basename(path);
    const saved = await saveFile(owner.id, { name, contentType, data: readFileSync(path), resultId: scanForName(name, scans), note: null });
    console.log(`${saved.duplicate ? 'already stored' : 'stored'}: ${name}`);
  }
  const dates = new Map(scans.map((s) => [s.resultId, s.scanDate]));
  const images = (await loadFiles(owner.id)).filter((f) => f.kind === 'image' && f.view);
  console.log(`Scan images: ${images.map((f) => `${dates.get(f.resultId ?? '') ?? '?'} ${f.view}`).sort().join(', ') || 'none'}`);

  const secret = process.env.CRON_SECRET;
  const coach = process.env.COACH_URL ?? 'https://coach.paolobernasconi.com';
  if (secret) {
    const res = await fetch(`${coach}/api/cron/cache?tag=dexa`, { method: 'POST', headers: { authorization: `Bearer ${secret}` } }).catch(() => null);
    console.log(res?.ok ? 'Cleared the dexa cache.' : `Cache clear failed (${res?.status ?? 'no connection'}); the page updates within an hour.`);
  } else {
    console.log('No CRON_SECRET: the page updates within an hour.');
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
