import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEnrollmentCode, redeemEnrollmentCode } from './enroll.mjs';

// A tiny stand-in for the neon tagged template: it understands the three statements enroll.mjs runs.
function fakeSql() {
  const rows = new Map();
  const sql = async (strings, ...values) => {
    const q = strings.join('?');
    if (q.startsWith('DELETE')) {
      const [now] = values;
      for (const [k, r] of rows) if (r.expiresAt < now || r.usedAt) rows.delete(k);
      return [];
    }
    if (q.startsWith('INSERT')) {
      rows.set(values[0], { expiresAt: values[1], usedAt: null });
      return [];
    }
    const [now, hash, now2] = values;
    const r = rows.get(hash);
    if (!r || r.usedAt || !(r.expiresAt > now2)) return [];
    r.usedAt = now;
    return [{ code_hash: hash }];
  };
  return { sql, rows };
}

test('a code works once', async () => {
  const { sql } = fakeSql();
  const { code } = await createEnrollmentCode(sql);
  assert.ok(await redeemEnrollmentCode(sql, code));
  assert.equal(await redeemEnrollmentCode(sql, code), false);
});

test('an expired, unknown or malformed code does not work', async () => {
  const { sql } = fakeSql();
  const t0 = new Date('2026-10-20T00:00:00Z');
  const { code } = await createEnrollmentCode(sql, t0);
  assert.equal(await redeemEnrollmentCode(sql, code, new Date(t0.getTime() + 16 * 60_000)), false);
  assert.equal(await redeemEnrollmentCode(sql, 'x'.repeat(32)), false);
  assert.equal(await redeemEnrollmentCode(sql, 'short'), false);
  assert.equal(await redeemEnrollmentCode(sql, undefined), false);
});

test('only a hash of the code is stored', async () => {
  const { sql, rows } = fakeSql();
  const { code } = await createEnrollmentCode(sql);
  assert.ok(![...rows.keys()].includes(code));
  assert.match([...rows.keys()][0], /^[0-9a-f]{64}$/);
});
