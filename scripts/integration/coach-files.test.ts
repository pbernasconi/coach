// Photos and files on Coach messages (lift/COACH-CHAT.md, "Attachments") on a real Postgres: an upload is stored as
// its bytes say, a message claims it once, Claude gets its bytes back intact, and a day-old upload no message took is
// cleared by the next upload.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { claimFiles, fileData, readCoachFile, unclaimedFiles, uploadFile } from '@/lib/coach-chat/files-store';

const user = 'user_coach_files';
const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4a30000000049454e44ae426082', 'hex');
const meta = { contentType: 'image/png', name: 'IMG_0001.PNG', width: '1', height: '1' };

test('an upload is claimed once and reaches Claude intact', async () => {
  await sql`DELETE FROM coach_files WHERE user_id = ${user}`;
  try {
    const up = await uploadFile(user, png, meta);
    assert.equal(up.status, 201);
    const file = (up.body as { file: { id: string; kind: string; contentType: string; width: number } }).file;
    assert.equal(file.kind, 'image');
    assert.equal(file.width, 1);

    const refused = await uploadFile(user, Buffer.from('PK\x03\x04'), { ...meta, contentType: 'application/zip' });
    assert.equal(refused.status, 415);

    assert.deepEqual((await unclaimedFiles(user, [file.id, 'nosuchfile1'])).map((f) => f.id), [file.id]);
    assert.deepEqual(await unclaimedFiles('someone_else', [file.id]), []);
    await claimFiles(user, 'msg_1', [file.id]);
    assert.deepEqual(await unclaimedFiles(user, [file.id]), [], 'a claimed upload is not taken again');

    const ref = { ...file, kind: 'image' as const, name: 'IMG_0001.PNG', sizeBytes: png.length, height: 1 };
    const data = await fileData(user, [ref]);
    assert.equal(Buffer.from(data.get(file.id)!.data, 'base64').toString('hex'), png.toString('hex'));
    const read = await readCoachFile(user, file.id);
    assert.equal(read?.contentType, 'image/png');
    assert.equal(read?.data.toString('hex'), png.toString('hex'));
  } finally {
    await sql`DELETE FROM coach_files WHERE user_id = ${user}`;
  }
});

test('a day-old upload no message took is cleared', async () => {
  await sql`DELETE FROM coach_files WHERE user_id = ${user}`;
  try {
    const old = (await uploadFile(user, png, meta)).body as { file: { id: string } };
    await sql`UPDATE coach_files SET created_at = NOW() - interval '25 hours' WHERE id = ${old.file.id}`;
    await uploadFile(user, png, meta);
    assert.equal(await readCoachFile(user, old.file.id), null);
  } finally {
    await sql`DELETE FROM coach_files WHERE user_id = ${user}`;
  }
});
