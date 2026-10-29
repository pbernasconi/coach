import test from 'node:test';
import assert from 'node:assert/strict';
import { scaleWarning } from './scale.mjs';

test('scaleWarning: nothing before the first weigh-in or within 3 days', () => {
  assert.equal(scaleWarning(null, '2026-10-22'), null);
  assert.equal(scaleWarning('2026-10-22', '2026-10-22'), null);
  assert.equal(scaleWarning('2026-10-19', '2026-10-22'), null);
});

test('scaleWarning: info from 4 days, a banner from 10', () => {
  assert.equal(scaleWarning('2026-10-18', '2026-10-22')?.level, 'info');
  assert.match(scaleWarning('2026-10-18', '2026-10-22')?.text ?? '', /for 4 days/);
  assert.equal(scaleWarning('2026-10-12', '2026-10-22')?.level, 'warn');
});

import { bridgeWarning, heartbeatFrom } from './scale.mjs';

const NOW = new Date('2026-10-29T05:00:00Z');

test('heartbeatFrom keeps known fields, caps them and drops the rest', () => {
  const h = heartbeatFrom({
    firmware: 'abc1234', uptimeS: 900, bootCount: 7, resetReason: 'software', rssi: -61, ip: '192.168.50.7',
    scaleMac: 'a4:c1:38:f8:46:39', pending: 0, secret: 'x',
    lastSession: { at: 1793245098, result: 'live reading, 0 stored record(s), weigh-in queued', log: ['a', 5, 'b'.repeat(500)] },
    lastPost: { at: 1793245100, code: 200 },
  }, NOW);
  assert.equal(h?.receivedAt, NOW.toISOString());
  assert.equal(h?.rssi, -61);
  assert.equal(h?.lastSession?.result, 'live reading, 0 stored record(s), weigh-in queued');
  assert.equal(h?.lastSession?.at, new Date(1793245098 * 1000).toISOString());
  assert.deepEqual(h?.lastSession?.log.map((l) => l.length), [1, 200]);
  assert.equal(h?.lastPost?.code, 200);
  assert.equal('secret' in (h ?? {}), false);
});

test('heartbeatFrom rejects junk without throwing', () => {
  assert.equal(heartbeatFrom(null, NOW), null);
  assert.equal(heartbeatFrom([1], NOW), null);
  const h = heartbeatFrom({ rssi: 20, uptimeS: 'x', lastSession: { result: 42, log: 'no' } }, NOW);
  assert.equal(h?.rssi, null);
  assert.equal(h?.uptimeS, null);
  assert.equal(h?.lastSession?.result, null);
  assert.deepEqual(h?.lastSession?.log, []);
});

test('bridgeWarning: quiet under 2 hours, info then a banner after a day', () => {
  const at = (h) => ({ receivedAt: new Date(NOW.getTime() - h * 36e5).toISOString() });
  assert.equal(bridgeWarning(null, NOW.getTime()), null);
  assert.equal(bridgeWarning(at(1.5), NOW.getTime()), null);
  assert.equal(bridgeWarning(at(3), NOW.getTime())?.level, 'info');
  assert.match(bridgeWarning(at(3), NOW.getTime())?.text ?? '', /3 hours/);
  assert.equal(bridgeWarning(at(30), NOW.getTime())?.level, 'warn');
  assert.match(bridgeWarning(at(72), NOW.getTime())?.text ?? '', /3 days/);
});
