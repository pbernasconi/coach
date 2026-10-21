// Uploaded DEXA files (src/lib/vitals/dexa-store.ts) on a real Postgres: a PDF with its text, the same bytes again,
// an image, reading the bytes back, a wrong type, moving and deleting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { UploadError, deleteFile, linkFile, loadFiles, readFile, saveFile, scanForName } from '@/lib/vitals/dexa-store';

const user = 'user_dexa_files';

/** A one-page PDF whose text is "Body fat 18.1%". */
function tinyPdf(): Uint8Array {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = 'BT /F1 18 Tf 20 60 Td (Body fat 18.1%) Tj ET';
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

test('DEXA files are stored once, with a PDF text, and read back byte for byte', async () => {
  await sql`DELETE FROM dexa_files WHERE user_id = ${user}`;
  await sql`DELETE FROM dexa_scans WHERE user_id = ${user}`;
  await sql`INSERT INTO dexa_scans (result_id, user_id, scanned_at, scan_date) VALUES ('files-r1', ${user}, now(), '2025-08-08')`;

  const pdf = tinyPdf();
  const first = await saveFile(user, { name: 'report.pdf', contentType: 'application/pdf', data: pdf, resultId: 'files-r1', note: null });
  assert.equal(first.duplicate, false);
  const again = await saveFile(user, { name: 'copy.pdf', contentType: 'application/pdf', data: pdf, resultId: null, note: null });
  assert.deepEqual(again, { id: first.id, duplicate: true });

  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 255]);
  const image = await saveFile(user, { name: 'scan.png', contentType: 'image/png', data: png, resultId: null, note: 'colour map' });

  const files = await loadFiles(user);
  assert.equal(files.length, 2);
  const report = files.find((f) => f.id === first.id)!;
  assert.equal(report.kind, 'report');
  assert.equal(report.resultId, 'files-r1');
  assert.equal(report.hasText, true);
  const [{ text }] = await sql`SELECT text FROM dexa_files WHERE id = ${first.id}`;
  assert.match(String(text), /Body fat 18\.1%/);

  const back = await readFile(user, image.id);
  assert.deepEqual([...back!.data], [...png]);
  assert.equal(await readFile('someone_else', image.id), null);

  await assert.rejects(saveFile(user, { name: 'x.svg', contentType: 'image/svg+xml', data: png, resultId: null, note: null }), UploadError);
  await assert.rejects(saveFile(user, { name: 'x.png', contentType: 'image/png', data: new Uint8Array([1]), resultId: 'nope', note: null }), /does not exist/);

  await linkFile(user, image.id, 'files-r1');
  assert.equal((await loadFiles(user)).find((f) => f.id === image.id)!.resultId, 'files-r1');
  await deleteFile(user, image.id);
  assert.equal((await loadFiles(user)).length, 1);

  await sql`DELETE FROM dexa_files WHERE user_id = ${user}`;
  await sql`DELETE FROM dexa_scans WHERE user_id = ${user}`;
});

test('scanForName matches a date in the file name to the nearest scan', () => {
  const scans = [{ resultId: 'a', scanDate: '2025-04-07' }, { resultId: 'b', scanDate: '2025-08-08' }];
  assert.equal(scanForName('BodySpec_Report_2025-08-08.pdf', scans), 'b');
  assert.equal(scanForName('dexa 20250410.pdf', scans), 'a');
  assert.equal(scanForName('2024-01-01.pdf', scans), null);
  assert.equal(scanForName('report.pdf', scans), null);
});
