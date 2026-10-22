// Uploaded DEXA files (src/lib/vitals/dexa-store.ts) on a real Postgres: a PDF with its text, the same bytes again,
// an image, reading the bytes back, a wrong type, moving and deleting, and the scan image inside a BodySpec report.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { UploadError, deleteFile, linkFile, loadFiles, readFile, saveFile, scanForName, setFileView } from '@/lib/vitals/dexa-store';

const user = 'user_dexa_files';

/** A one-page PDF with lines of text and, optionally, an RGB image of `image.width` × `image.height`. */
function tinyPdf(lines: string[] = ['Body fat 18.1%'], image?: { width: number; height: number }): Uint8Array {
  const xobject = image ? ' /XObject << /Im1 6 0 R >>' : '';
  const objs: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 600] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >>${xobject} >> >>`,
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const text = lines.map((l, i) => `BT /F1 12 Tf 20 ${560 - i * 20} Td (${l}) Tj ET`).join('\n');
  const stream = image ? `${text}\nq ${image.width} 0 0 ${image.height} 20 20 cm /Im1 Do Q` : text;
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  if (image) {
    // Grey pixels, written as hex so the file stays plain text.
    const hex = '80'.repeat(image.width * image.height * 3);
    objs.push(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length ${hex.length + 1} >>\nstream\n${hex}>\nendstream`);
  }
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

test('scan images take a view from the form or the file name, and a new image takes over its slot', async () => {
  await sql`DELETE FROM dexa_files WHERE user_id = ${user}`;
  await sql`DELETE FROM dexa_scans WHERE user_id = ${user}`;
  await sql`INSERT INTO dexa_scans (result_id, user_id, scanned_at, scan_date) VALUES ('files-r2', ${user}, now(), '2025-08-08')`;
  const png = (n: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, n]);
  const view = async (id: string) => (await loadFiles(user)).find((f) => f.id === id)!.view;

  const named = await saveFile(user, { name: 'Fat Tissue.png', contentType: 'image/png', data: png(1), resultId: 'files-r2', note: null });
  assert.equal(await view(named.id), 'fat');
  const chosen = await saveFile(user, { name: 'image.png', contentType: 'image/png', data: png(2), resultId: 'files-r2', note: null, view: 'fat' });
  assert.equal(await view(chosen.id), 'fat');
  assert.equal(await view(named.id), null, 'the replaced image keeps no view');

  const loose = await saveFile(user, { name: 'image.png', contentType: 'image/png', data: png(3), resultId: null, note: null });
  assert.equal(await view(loose.id), null);
  const again = await saveFile(user, { name: 'bone.png', contentType: 'image/png', data: png(3), resultId: 'files-r2', note: null });
  assert.equal(again.duplicate, true);
  assert.equal(await view(loose.id), 'bone', 'a re-upload fills in the view and scan it lacked');
  assert.equal((await loadFiles(user)).find((f) => f.id === loose.id)!.resultId, 'files-r2');

  await setFileView(user, named.id, 'bone');
  assert.equal(await view(named.id), 'bone');
  assert.equal(await view(loose.id), null);

  await sql`DELETE FROM dexa_files WHERE user_id = ${user}`;
  await sql`DELETE FROM dexa_scans WHERE user_id = ${user}`;
});

test('a BodySpec report PDF files itself under its scan by the date inside it, and gives that scan its composite image', async () => {
  await sql`DELETE FROM dexa_files WHERE user_id = ${user}`;
  await sql`DELETE FROM dexa_scans WHERE user_id = ${user}`;
  await sql`INSERT INTO dexa_scans (result_id, user_id, scanned_at, scan_date) VALUES ('files-r3', ${user}, now(), '2025-04-07'), ('files-r4', ${user}, now(), '2025-08-08')`;
  const pdf = tinyPdf(['Client Sex Birth Date Intake Height Intake Weight Measured Date', 'Doe, Sam Male 7/22/1993 70.0 in. 187.0 lbs. 4/7/2025'], { width: 90, height: 261 });

  const saved = await saveFile(user, { name: 'report.pdf', contentType: 'application/pdf', data: pdf, resultId: null, note: null });
  const files = await loadFiles(user);
  assert.equal(files.find((f) => f.id === saved.id)!.resultId, 'files-r3');
  const composite = files.find((f) => f.view === 'composite')!;
  assert.equal(composite.resultId, 'files-r3');
  assert.equal(composite.contentType, 'image/png');
  const back = await readFile(user, composite.id);
  assert.deepEqual([...back!.data.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.equal(back!.data.readUInt32BE(16), 90, 'PNG width');
  assert.equal(back!.data.readUInt32BE(20), 261, 'PNG height');

  const again = await saveFile(user, { name: 'report.pdf', contentType: 'application/pdf', data: pdf, resultId: null, note: null });
  assert.equal(again.duplicate, true);
  assert.equal((await loadFiles(user)).length, 2, 'the same report again adds nothing');

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
