import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsResponse, targetsText } from './app-settings.mjs';

const NOW = Date.parse('2026-10-22T20:00:00Z');

test('targetsText: the week in one line', () => {
  assert.equal(targetsText({ runKm: 35, rideHours: 4, strength: 2 }), '35 km run · 4 h ride · 2 strength a week');
  assert.equal(targetsText({ runKm: 0, rideHours: 0, strength: 2 }), '2 strength a week');
  assert.equal(targetsText({ runKm: 0, rideHours: 0, strength: 0 }), 'No weekly targets');
});

test('settingsResponse: each section fails alone', () => {
  const body = settingsResponse({
    status: { ok: false },
    bodyspec: { ok: false },
    targets: { ok: true, value: { runKm: 35, rideHours: 4, strength: 2 } },
    events: { ok: true, value: [{ name: 'Harbour marathon', date: '2026-12-06', priority: 'A', countdown: { label: 'In 6 wk 3 d' } }] },
    now: NOW,
  });
  assert.deepEqual(body.connections, { ok: false });
  assert.deepEqual(body.coach, {
    ok: true,
    targetsText: '35 km run · 4 h ride · 2 strength a week',
    nextEvent: { name: 'Harbour marathon', dateText: 'Dec 6', countdownText: 'In 6 wk 3 d', priority: 'A' },
  });
  assert.equal(body.generatedAt, '2026-10-22T20:00:00.000Z');
  const none = settingsResponse({ status: { ok: false }, bodyspec: { ok: false }, targets: { ok: false }, events: { ok: false }, now: NOW });
  assert.deepEqual(none.coach, { ok: false });
});
