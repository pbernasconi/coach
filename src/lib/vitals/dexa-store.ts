/**
 * DEXA scans in full (dexa_scans.raw through dexa.mjs) and the uploaded scan files (dexa_files), for the
 * /health/dexa pages, the AI API (GET /api/vitals/dexa) and the BodySpec sync, which rebuilds each scan's stored
 * report here. The scan reads go through the data cache (tag `dexa`), cleared by the sync and by uploads.
 */

import { createHash } from 'node:crypto';
import { createId } from '@paralleldrive/cuid2';
import { sql } from '@/db';
import { cached, clearCache } from '@/lib/data-cache';
import { toDay, toIso } from '@/lib/db-time.mjs';
import { REPORT_VERSION, dexaTrends, fullScan, scanReport, storedDerived, type FullScan } from './dexa.mjs';
import { isImageView, viewForName, type ImageView } from './dexa-images.mjs';

type ScanRow = { result_id: string; scan_date: unknown; location: string | null; scanner: string | null; age_years: unknown; height_cm: unknown; raw: Record<string, unknown> | null };

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function toFull(r: ScanRow): FullScan | null {
  const scanDate = toDay(r.scan_date);
  if (!scanDate) return null;
  return fullScan({ resultId: r.result_id, scanDate, location: r.location, scanner: r.scanner, ageYears: n(r.age_years), heightCm: n(r.height_cm), raw: r.raw });
}

async function readScans(userId: string): Promise<ScanRow[]> {
  return (await sql`
    SELECT result_id, scan_date, location, scanner, age_years, height_cm, raw
    FROM dexa_scans WHERE user_id = ${userId} ORDER BY scan_date`) as ScanRow[];
}

const readScansCached = cached(readScans, 'dexa-scans-v1', 'dexa');

/** Every scan of the user, in full, oldest first. */
export async function loadScans(userId: string): Promise<FullScan[]> {
  return (await readScansCached(userId)).map(toFull).filter((s): s is FullScan => s !== null);
}

export type DexaTrends = ReturnType<typeof dexaTrends>;

/**
 * Rewrites `derived`, `report_md` and `report_version` of every scan from `raw` when one is missing, older than
 * REPORT_VERSION, or `force` (a scan changed, so the next scan's "change since" changes too). No BodySpec call.
 * Returns how many rows it wrote.
 */
export async function rebuildReports(userId: string, force = false): Promise<number> {
  if (!force) {
    const [stale] = (await sql`
      SELECT count(*)::int AS n FROM dexa_scans
      WHERE user_id = ${userId} AND (report_version IS NULL OR report_version <> ${REPORT_VERSION} OR report_md IS NULL)`) as { n: number }[];
    if (!stale?.n) return 0;
  }
  const scans = (await readScans(userId)).map(toFull).filter((s): s is FullScan => s !== null);
  for (let i = 0; i < scans.length; i++) {
    const s = scans[i];
    await sql`
      UPDATE dexa_scans SET derived = ${JSON.stringify(storedDerived(s))}::jsonb, report_md = ${scanReport(s, i > 0 ? scans[i - 1] : null)},
        report_version = ${REPORT_VERSION}
      WHERE user_id = ${userId} AND result_id = ${s.resultId}`;
  }
  clearCache('dexa');
  return scans.length;
}

// --- Files ---------------------------------------------------------------------------------------------------

export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const FILE_TYPES: Record<string, 'report' | 'image'> = {
  'application/pdf': 'report',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
};

export type DexaFile = {
  id: string;
  resultId: string | null;
  kind: 'report' | 'image' | 'other';
  name: string;
  contentType: string;
  sizeBytes: number;
  hasText: boolean;
  note: string | null;
  /** For a scan image: composite, fat, lean or bone. */
  view: ImageView | null;
  uploadedAt: string | null;
};

/** The user's files without their data, newest first. */
export async function loadFiles(userId: string): Promise<DexaFile[]> {
  const rows = (await sql`
    SELECT id, result_id, kind, name, content_type, size_bytes, text IS NOT NULL AND text <> '' AS has_text, note, view, uploaded_at
    FROM dexa_files WHERE user_id = ${userId} ORDER BY uploaded_at DESC`) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    resultId: (r.result_id as string | null) ?? null,
    kind: r.kind as DexaFile['kind'],
    name: String(r.name),
    contentType: String(r.content_type),
    sizeBytes: Number(r.size_bytes),
    hasText: Boolean(r.has_text),
    note: (r.note as string | null) ?? null,
    view: isImageView(r.view) ? r.view : null,
    uploadedAt: toIso(r.uploaded_at),
  }));
}

/** One file with its bytes, or null when it is not the user's. */
export async function readFile(userId: string, id: string): Promise<{ name: string; contentType: string; data: Buffer } | null> {
  const [r] = (await sql`
    SELECT name, content_type, encode(data, 'base64') AS b64 FROM dexa_files WHERE user_id = ${userId} AND id = ${id}`) as { name: string; content_type: string; b64: string }[];
  return r ? { name: r.name, contentType: r.content_type, data: Buffer.from(r.b64.replace(/\s/g, ''), 'base64') } : null;
}

/** The text of the user's files that have some, for the AI API. */
export async function loadFileTexts(userId: string): Promise<Map<string, string>> {
  const rows = (await sql`SELECT id, text FROM dexa_files WHERE user_id = ${userId} AND text IS NOT NULL`) as { id: string; text: string }[];
  return new Map(rows.map((r) => [r.id, r.text]));
}

/** The text of a PDF, or null when it has none (a scan of paper) or cannot be read. At most 200,000 characters. */
export async function pdfText(data: Uint8Array): Promise<string | null> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { text } = await extractText(pdf, { mergePages: false });
    const pages = (Array.isArray(text) ? text : [text]).map((t, i) => `--- Page ${i + 1} ---\n${t.trim()}`);
    const all = pages.join('\n\n').trim();
    return all.replace(/--- Page \d+ ---/g, '').trim() ? all.slice(0, 200_000) : null;
  } catch (e) {
    console.error('DEXA PDF text failed:', (e as Error).message);
    return null;
  }
}

export class UploadError extends Error {}

/**
 * Stores an uploaded file. A file already stored (same bytes) is not stored twice: its id comes back, and a scan or
 * view it lacked is filled in. `resultId` must be one of the user's scans. `view` (images only) defaults to the one in
 * the file name; a new image for a scan's view takes that slot, and the image it replaces keeps no view.
 */
export async function saveFile(
  userId: string,
  file: { name: string; contentType: string; data: Uint8Array; resultId: string | null; note: string | null; view?: ImageView | null }
): Promise<{ id: string; duplicate: boolean }> {
  const kind = FILE_TYPES[file.contentType];
  if (!kind) throw new UploadError('Upload a PDF or an image (PNG, JPEG, WebP).');
  if (!file.data.byteLength) throw new UploadError('The file is empty.');
  if (file.data.byteLength > MAX_FILE_BYTES) throw new UploadError('The file is over 4 MB.');
  if (file.resultId) {
    const [scan] = (await sql`SELECT 1 FROM dexa_scans WHERE user_id = ${userId} AND result_id = ${file.resultId}`) as unknown[];
    if (!scan) throw new UploadError('That scan does not exist.');
  }
  const view = kind === 'image' ? (file.view ?? viewForName(file.name)) : null;
  const sha = createHash('sha256').update(file.data).digest('hex');
  const [existing] = (await sql`SELECT id FROM dexa_files WHERE user_id = ${userId} AND sha256 = ${sha}`) as { id: string }[];
  if (existing) {
    await sql`UPDATE dexa_files SET result_id = COALESCE(result_id, ${file.resultId}), view = COALESCE(view, ${view})
      WHERE user_id = ${userId} AND id = ${existing.id}`;
    return { id: existing.id, duplicate: true };
  }
  if (view && file.resultId) {
    await sql`UPDATE dexa_files SET view = NULL WHERE user_id = ${userId} AND result_id = ${file.resultId} AND view = ${view}`;
  }
  const text = kind === 'report' ? await pdfText(file.data) : null;
  const id = createId();
  const name = file.name.replace(/[\u0000-\u001f]/g, '').slice(0, 200) || 'scan';
  await sql`
    INSERT INTO dexa_files (id, user_id, result_id, kind, name, content_type, size_bytes, sha256, data, text, note, view)
    VALUES (${id}, ${userId}, ${file.resultId}, ${kind}, ${name}, ${file.contentType}, ${file.data.byteLength}, ${sha},
      decode(${Buffer.from(file.data).toString('base64')}, 'base64'), ${text}, ${file.note?.slice(0, 500) || null}, ${view})`;
  return { id, duplicate: false };
}

/** Moves a file to another scan (or none). */
export async function linkFile(userId: string, id: string, resultId: string | null) {
  await sql`UPDATE dexa_files SET result_id = ${resultId} WHERE user_id = ${userId} AND id = ${id}`;
}

/** Sets which view an image shows (or none). The image it replaces on the same scan keeps no view. */
export async function setFileView(userId: string, id: string, view: ImageView | null) {
  if (view) {
    await sql`UPDATE dexa_files SET view = NULL WHERE user_id = ${userId} AND view = ${view} AND id <> ${id}
      AND result_id = (SELECT result_id FROM dexa_files WHERE user_id = ${userId} AND id = ${id})`;
  }
  await sql`UPDATE dexa_files SET view = ${view} WHERE user_id = ${userId} AND id = ${id} AND kind = 'image'`;
}

export async function deleteFile(userId: string, id: string) {
  await sql`DELETE FROM dexa_files WHERE user_id = ${userId} AND id = ${id}`;
}

/** The scan whose date is closest to a file's date in its name (BodySpec names reports by scan date), within 10 days. */
export function scanForName(name: string, scans: { resultId: string; scanDate: string }[]): string | null {
  const m = /(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})/.exec(name) ?? null;
  if (!m) return null;
  const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  let best: { id: string; d: number } | null = null;
  for (const s of scans) {
    const d = Math.abs(Date.parse(`${s.scanDate}T00:00:00Z`) - t) / 864e5;
    if (d <= 10 && (!best || d < best.d)) best = { id: s.resultId, d };
  }
  return best?.id ?? null;
}

// --- Pages ---------------------------------------------------------------------------------------------------

export type DexaPage = { trends: DexaTrends; files: DexaFile[] };

/** /health/dexa and /health/dexa/[scan]: every scan in full with the trends, and the uploaded files. */
export async function loadDexaPage(userId: string): Promise<DexaPage> {
  const [scans, files] = await Promise.all([loadScans(userId), loadFiles(userId)]);
  return { trends: dexaTrends(scans), files };
}

/** The scan a /health/dexa/[scan] URL names: `latest`, a date (YYYY-MM-DD) or a result id. */
export function findScan(scans: FullScan[], key: string): FullScan | null {
  if (key === 'latest') return scans.at(-1) ?? null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return [...scans].reverse().find((s) => s.scanDate === key) ?? null;
  return scans.find((s) => s.resultId === key) ?? null;
}
