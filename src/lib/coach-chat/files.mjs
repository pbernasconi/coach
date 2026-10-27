// @ts-check
// Photos and files Paolo attaches to a Coach message (lift/COACH-CHAT.md, "Attachments"): which ones Coach takes, how
// an upload is checked, and how each one reaches Claude (an image block, a PDF document, or a text document). Pure: the
// route stores the bytes (server.ts), this decides what they are and how Claude reads them.

/** The largest file the phone uploads (Vercel's request limit is 4.5 MB). The phone shrinks photos well under it. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
/** Files on one message. */
export const MAX_FILES = 6;
/** Files from earlier messages Claude sees again in full; older ones become a line ("[Paolo attached a photo]"). */
export const HISTORY_FILES = 6;
/** A text file's characters Claude reads. */
export const MAX_TEXT_CHARS = 100_000;

/** @typedef {'image' | 'pdf' | 'text'} FileKind */
/**
 * @typedef {{ id: string, kind: FileKind, name: string, contentType: string, sizeBytes: number,
 *   width: number | null, height: number | null }} FileRef  a file as a message lists it
 * @typedef {FileRef & { data: string }} FileData  with its bytes, base64
 */

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const TEXT_TYPES = ['text/plain', 'text/csv', 'text/markdown', 'application/json'];

/**
 * What an upload is, from its bytes (never only the header the phone sent): an image by its magic number, a PDF by
 * `%PDF`, text when the header says text and the bytes are UTF-8. Null when Coach can't read it.
 * @param {Uint8Array} bytes @param {string} declared  the Content-Type the phone sent
 * @returns {{ kind: FileKind, contentType: string } | null}
 */
export function sniffFile(bytes, declared) {
  const type = String(declared || '').split(';')[0].trim().toLowerCase();
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: 'image', contentType: 'image/jpeg' };
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { kind: 'image', contentType: 'image/png' };
  if (b.length >= 6 && ascii(b, 0, 4) === 'GIF8') return { kind: 'image', contentType: 'image/gif' };
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return { kind: 'image', contentType: 'image/webp' };
  if (b.length >= 5 && ascii(b, 0, 5) === '%PDF-') return { kind: 'pdf', contentType: 'application/pdf' };
  if (TEXT_TYPES.includes(type) || type.startsWith('text/')) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(b);
      return { kind: 'text', contentType: TEXT_TYPES.includes(type) ? type : 'text/plain' };
    } catch {
      return null;
    }
  }
  return null;
}

/** @param {Uint8Array} b @param {number} from @param {number} to */
function ascii(b, from, to) {
  return String.fromCharCode(...b.subarray(from, to));
}

/** Whether a content type is one an image block takes. */
export const isImageType = (/** @type {string} */ t) => IMAGE_TYPES.includes(t);

/**
 * A file's name as stored and shown: the last path part, no control characters, at most 120 characters. A photo
 * without a name gets "Photo".
 * @param {string | null | undefined} raw @param {FileKind} kind
 */
export function cleanName(raw, kind) {
  const base = String(raw ?? '').split(/[\\/]/).pop() ?? '';
  const name = base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120);
  return name || (kind === 'image' ? 'Photo' : kind === 'pdf' ? 'Document.pdf' : 'Note.txt');
}

/**
 * The ids a message names, in order, without repeats; an error for a list that isn't one.
 * @param {unknown} raw @returns {{ ids: string[] } | { error: string }}
 */
export function fileIds(raw) {
  if (raw === undefined || raw === null) return { ids: [] };
  if (!Array.isArray(raw)) return { error: 'files must be a list of ids' };
  if (!raw.every((x) => typeof x === 'string' && /^[a-z0-9]{8,40}$/.test(x))) return { error: 'files has an id that is not one' };
  const ids = [...new Set(raw)];
  if (ids.length > MAX_FILES) return { error: `at most ${MAX_FILES} files per message` };
  return { ids };
}

/** "a photo", "2 photos", "a PDF", "a photo and a file". @param {Pick<FileRef, 'kind'>[]} files */
export function filesPhrase(files) {
  const photos = files.filter((f) => f.kind === 'image').length;
  const others = files.length - photos;
  const parts = [];
  if (photos) parts.push(photos === 1 ? 'a photo' : `${photos} photos`);
  if (others) parts.push(others === 1 ? 'a file' : `${others} files`);
  return parts.join(' and ');
}

/**
 * How Claude reads one file: an image block, a PDF document, or a plain-text document with its name as the title.
 * @param {FileData} f
 */
export function fileBlock(f) {
  if (f.kind === 'image') return { type: 'image', source: { type: 'base64', media_type: f.contentType, data: f.data } };
  if (f.kind === 'pdf') {
    return { type: 'document', title: f.name, source: { type: 'base64', media_type: 'application/pdf', data: f.data } };
  }
  const text = Buffer.from(f.data, 'base64').toString('utf8').slice(0, MAX_TEXT_CHARS);
  return { type: 'document', title: f.name, source: { type: 'text', media_type: 'text/plain', data: text } };
}

/** The line that stands for a file Claude doesn't see again (an older one). @param {Pick<FileRef, 'kind' | 'name'>} f */
export function fileNote(f) {
  return f.kind === 'image' ? '[Paolo attached a photo]' : `[Paolo attached a file: ${f.name}]`;
}

/**
 * Which files of the thread Claude sees in full: the newest `limit`, counted from the end. The rest are notes.
 * @param {{ files?: FileRef[] }[]} messages  oldest first @param {number} [limit]
 * @returns {Set<string>}
 */
export function filesToSend(messages, limit = HISTORY_FILES) {
  const ids = new Set();
  for (let i = messages.length - 1; i >= 0 && ids.size < limit; i--) {
    const files = messages[i].files ?? [];
    for (let j = files.length - 1; j >= 0 && ids.size < limit; j--) ids.add(files[j].id);
  }
  return ids;
}
