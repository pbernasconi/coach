import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_FILES, cleanName, fileBlock, fileIds, fileNote, filesPhrase, filesToSend, sniffFile } from './files.mjs';
import { chatMessages } from './chat.mjs';

const bytes = (...xs) => new Uint8Array(xs);
const ascii = (s) => new TextEncoder().encode(s);

test('an upload is what its bytes say, not its header', () => {
  assert.deepEqual(sniffFile(bytes(0xff, 0xd8, 0xff, 0xe0), 'application/octet-stream'), { kind: 'image', contentType: 'image/jpeg' });
  assert.deepEqual(sniffFile(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 'image/jpeg'), { kind: 'image', contentType: 'image/png' });
  assert.deepEqual(sniffFile(ascii('RIFF0000WEBPVP8 '), ''), { kind: 'image', contentType: 'image/webp' });
  assert.deepEqual(sniffFile(ascii('%PDF-1.7\n'), 'text/plain'), { kind: 'pdf', contentType: 'application/pdf' });
  assert.deepEqual(sniffFile(ascii('date,km\n2026-10-27,5'), 'text/csv; charset=utf-8'), { kind: 'text', contentType: 'text/csv' });
  // HEIC, a zip, or text that isn't UTF-8: Coach can't read it.
  assert.equal(sniffFile(ascii('\0\0\0\x18ftypheic'), 'image/heic'), null);
  assert.equal(sniffFile(ascii('PK\x03\x04'), 'application/zip'), null);
  assert.equal(sniffFile(bytes(0xc3, 0x28), 'text/plain'), null);
});

test('names are cleaned, and a photo without one is a Photo', () => {
  assert.equal(cleanName('../../etc/passwd', 'text'), 'passwd');
  assert.equal(cleanName('scan\n.pdf', 'pdf'), 'scan.pdf');
  assert.equal(cleanName('', 'image'), 'Photo');
  assert.equal(cleanName(null, 'pdf'), 'Document.pdf');
  assert.equal(cleanName('x'.repeat(300), 'text').length, 120);
});

test('a message names at most six real ids', () => {
  assert.deepEqual(fileIds(undefined), { ids: [] });
  assert.deepEqual(fileIds(['abcdefgh1', 'abcdefgh1']), { ids: ['abcdefgh1'] });
  assert.ok('error' in fileIds('abc'));
  assert.ok('error' in fileIds(['../x']));
  assert.ok('error' in fileIds(Array.from({ length: MAX_FILES + 1 }, (_, i) => `abcdefgh${i}`)));
});

test('each kind reaches Claude as its own block', () => {
  const ref = { id: 'f', name: 'a', sizeBytes: 1, width: null, height: null };
  assert.deepEqual(fileBlock({ ...ref, kind: 'image', contentType: 'image/png', data: 'AAA' }),
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAA' } });
  assert.equal(fileBlock({ ...ref, kind: 'pdf', contentType: 'application/pdf', data: 'AAA' }).source.media_type, 'application/pdf');
  const text = fileBlock({ ...ref, kind: 'text', contentType: 'text/plain', data: Buffer.from('hello').toString('base64') });
  assert.deepEqual(text, { type: 'document', title: 'a', source: { type: 'text', media_type: 'text/plain', data: 'hello' } });
  assert.equal(fileNote({ kind: 'image', name: 'Photo' }), '[Paolo attached a photo]');
  assert.equal(filesPhrase([{ kind: 'image' }, { kind: 'image' }, { kind: 'pdf' }]), '2 photos and a file');
});

test('only the newest files go to Claude again', () => {
  const m = (...ids) => ({ files: ids.map((id) => ({ id })) });
  assert.deepEqual([...filesToSend([m('a', 'b'), m(), m('c', 'd'), m('e')], 3)], ['e', 'd', 'c']);
});

test('photos go before the words, in the history and on the new message', () => {
  const img = { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'X' } };
  const m = chatMessages(
    [{ role: 'user', text: 'look', blocks: [img] }, { role: 'assistant', text: 'nice' }],
    'CTX', 'and this', [img],
  );
  assert.deepEqual(m[0].content, [img, { type: 'text', text: 'look' }]);
  assert.equal(m[1].content, 'nice');
  assert.deepEqual(m[2].content.map((b) => b.type), ['text', 'image', 'text']);
  assert.ok(m[2].content[2].cache_control);
  // An unanswered message with a photo goes with the new one, photo and all.
  const open = chatMessages([{ role: 'user', text: '', blocks: [img] }], 'CTX', 'well?');
  assert.deepEqual(open[0].content.map((b) => b.type), ['image', 'text', 'text']);
});
