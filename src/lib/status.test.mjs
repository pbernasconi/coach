import { test } from 'node:test';
import assert from 'node:assert/strict';

// status.ts is TypeScript with @/ imports; this checks the same rule iso() uses, on the shapes Postgres sends.
function iso(v) {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  const text = String(v).trim().replace(' ', 'T');
  const zoned = /(Z|[+-]\d{2}(:?\d{2})?)$/.test(text);
  const d = new Date(zoned ? text.replace(/([+-]\d{2})$/, '$1:00') : `${text}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

test('timestamp without a zone is UTC', () => assert.equal(iso('2026-10-20 03:00:41.123'), '2026-10-20T03:00:41.123Z'));
test('timestamptz with +00 works', () => assert.equal(iso('2026-10-20 03:00:41.123+00'), '2026-10-20T03:00:41.123Z'));
test('an offset like +09:00 works', () => assert.equal(iso('2026-10-20 12:00:41+09:00'), '2026-10-20T03:00:41.000Z'));
test('a Date passes through', () => assert.equal(iso(new Date('2026-10-20T03:00:41Z')), '2026-10-20T03:00:41.000Z'));
test('garbage is null, not an exception', () => assert.equal(iso('not a date'), null));
