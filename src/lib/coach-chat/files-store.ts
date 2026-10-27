/**
 * The photos and files on Coach messages, in Postgres (`coach_files`, lift/COACH-CHAT.md "Attachments"): an upload,
 * its bytes for the phone, and the bytes Claude reads with a message. What a file is and how Claude reads it is in
 * files.mjs.
 */

import { createHash } from 'node:crypto';
import { createId } from '@paralleldrive/cuid2';
import { sql } from '@/db';
import { cleanName, sniffFile, MAX_FILE_BYTES, type FileData, type FileRef } from './files.mjs';

type Row = Record<string, unknown>;

/** An upload no message took after this long is deleted. */
const ORPHAN_HOURS = 24;

export type UploadResult = { status: number; body: object };

function refOf(r: Row): FileRef {
  return {
    id: String(r.id), kind: r.kind as FileRef['kind'], name: String(r.name), contentType: String(r.content_type),
    sizeBytes: Number(r.size_bytes), width: r.width == null ? null : Number(r.width), height: r.height == null ? null : Number(r.height),
  };
}

/** A whole number in 1…20000 from a header or query value, else null. */
function dimension(raw: string | null): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= 20_000 ? n : null;
}

/**
 * POST /api/app/coach/files: stores one photo or file and answers its `FileRef`. 413 over 4 MB, 415 for a kind Coach
 * can't read. Clears uploads that no message took within a day.
 */
export async function uploadFile(
  userId: string,
  bytes: Uint8Array,
  meta: { contentType: string; name: string | null; width: string | null; height: string | null }
): Promise<UploadResult> {
  if (!bytes.byteLength) return { status: 400, body: { error: 'the file is empty' } };
  if (bytes.byteLength > MAX_FILE_BYTES) return { status: 413, body: { error: 'the file is over 4 MB' } };
  const what = sniffFile(bytes, meta.contentType);
  if (!what) return { status: 415, body: { error: 'Coach reads photos (JPEG, PNG, GIF, WebP), PDFs and text files' } };
  const id = createId();
  const name = cleanName(meta.name, what.kind);
  const isImage = what.kind === 'image';
  const width = isImage ? dimension(meta.width) : null;
  const height = isImage ? dimension(meta.height) : null;
  const sha = createHash('sha256').update(bytes).digest('hex');
  await sql`
    DELETE FROM coach_files
    WHERE user_id = ${userId} AND message_id IS NULL AND created_at < NOW() - make_interval(hours => ${ORPHAN_HOURS})`;
  await sql`
    INSERT INTO coach_files (id, user_id, kind, name, content_type, size_bytes, sha256, width, height, data)
    VALUES (${id}, ${userId}, ${what.kind}, ${name}, ${what.contentType}, ${bytes.byteLength}, ${sha}, ${width}, ${height},
            decode(${Buffer.from(bytes).toString('base64')}, 'base64'))`;
  const file: FileRef = { id, kind: what.kind, name, contentType: what.contentType, sizeBytes: bytes.byteLength, width, height };
  return { status: 201, body: { file } };
}

/** GET /api/app/coach/files/{id}: the file's bytes, or null. */
export async function readCoachFile(userId: string, id: string): Promise<{ name: string; contentType: string; data: Buffer } | null> {
  if (id.length > 40) return null;
  const [r] = (await sql`
    SELECT name, content_type, encode(data, 'base64') AS b64 FROM coach_files WHERE user_id = ${userId} AND id = ${id}`) as Row[];
  return r ? { name: String(r.name), contentType: String(r.content_type), data: Buffer.from(String(r.b64).replace(/\s/g, ''), 'base64') } : null;
}

/** The uploads a new message names, in its order: only this user's, and only ones no message took yet. */
export async function unclaimedFiles(userId: string, ids: string[]): Promise<FileRef[]> {
  if (!ids.length) return [];
  const rows = (await sql`
    SELECT id, kind, name, content_type, size_bytes, width, height FROM coach_files
    WHERE user_id = ${userId} AND message_id IS NULL AND id = ANY(${ids}::text[])`) as Row[];
  const byId = new Map(rows.map((r) => [String(r.id), refOf(r)]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** Links the uploads to the message that carries them. */
export async function claimFiles(userId: string, messageId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await sql`UPDATE coach_files SET message_id = ${messageId} WHERE user_id = ${userId} AND id = ANY(${ids}::text[])`;
}

/** The bytes (base64) of these files, for Claude. */
export async function fileData(userId: string, refs: FileRef[]): Promise<Map<string, FileData>> {
  if (!refs.length) return new Map();
  const ids = refs.map((f) => f.id);
  const rows = (await sql`
    SELECT id, encode(data, 'base64') AS b64 FROM coach_files WHERE user_id = ${userId} AND id = ANY(${ids}::text[])`) as Row[];
  const data = new Map(rows.map((r) => [String(r.id), String(r.b64).replace(/\s/g, '')]));
  return new Map(refs.flatMap((f) => (data.has(f.id) ? [[f.id, { ...f, data: data.get(f.id)! }] as const] : [])));
}
