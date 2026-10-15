/**
 * Tests for the database driver switch (src/db/driver.mjs): production keeps Neon's HTTP driver unless
 * DATABASE_DRIVER=pg is set explicitly.
 *
 * Run: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databaseDriver } from '../src/db/driver.mjs';

test('unset or empty DATABASE_DRIVER keeps the Neon HTTP driver', () => {
  assert.equal(databaseDriver({}), 'neon-http');
  assert.equal(databaseDriver({ DATABASE_DRIVER: '' }), 'neon-http');
  assert.equal(databaseDriver({ DATABASE_DRIVER: '  ' }), 'neon-http');
  assert.equal(databaseDriver({ DATABASE_DRIVER: 'neon-http' }), 'neon-http');
});

test('a Neon-looking or local DATABASE_URL alone never switches the driver', () => {
  assert.equal(databaseDriver({ DATABASE_URL: 'postgresql://lift@127.0.0.1:54329/coach' }), 'neon-http');
});

test('DATABASE_DRIVER=pg selects node-postgres', () => {
  assert.equal(databaseDriver({ DATABASE_DRIVER: 'pg' }), 'pg');
  assert.equal(databaseDriver({ DATABASE_DRIVER: ' pg ' }), 'pg');
});

test('an unknown DATABASE_DRIVER fails loudly instead of guessing', () => {
  assert.throws(() => databaseDriver({ DATABASE_DRIVER: 'postgres' }), /DATABASE_DRIVER/);
});
