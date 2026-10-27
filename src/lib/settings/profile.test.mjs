import test from 'node:test';
import assert from 'node:assert/strict';
import { ageOn, profileFrom } from './profile.mjs';

const TODAY = '2026-10-27';

test('profileFrom keeps a valid profile and rounds height to 0.5 cm', () => {
  assert.deepEqual(profileFrom({ birthDate: '1993-07-22', heightCm: '173.3', sex: 'male' }, TODAY), { birthDate: '1993-07-22', heightCm: 173.5, sex: 'male' });
});

test('profileFrom drops impossible values', () => {
  assert.deepEqual(profileFrom({ birthDate: '1993-02-30', heightCm: 40, sex: 'x' }, TODAY), { birthDate: null, heightCm: null, sex: null });
  assert.equal(profileFrom({ birthDate: '2030-01-01' }, TODAY).birthDate, null);
  assert.equal(profileFrom({ birthDate: '1850-01-01' }, TODAY).birthDate, null);
  assert.equal(profileFrom({ heightCm: '' }, TODAY).heightCm, null);
  assert.deepEqual(profileFrom(null, TODAY), { birthDate: null, heightCm: null, sex: null });
});

test('ageOn counts whole years, turning on the birthday', () => {
  assert.equal(ageOn('1993-07-22', '2026-07-21'), 32);
  assert.equal(ageOn('1993-07-22', '2026-07-22'), 33);
  assert.equal(ageOn('1993-07-22', TODAY), 33);
  assert.equal(ageOn(null, TODAY), null);
});
