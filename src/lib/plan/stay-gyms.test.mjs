import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceM, gymsNear, staysOf, walk } from './stay-gyms.mjs';

test('stays: calendar holds that name a stay and carry an address, one per address', () => {
  const stays = staysOf([
    { summary: 'Stay at Comfortable 1BR flat / great location - Baron 24', location: 'Münchhaldenstrasse 15, 8008 Zürich, Switzerland', start_time: '2026-11-13T00:00:00Z', end_time: '2026-11-18T00:00:00Z', is_all_day: true },
    { summary: 'Stay at Loft Style East London Flat', location: '491 Hackney Rd, London E2 9ED, UK', start_time: '2026-11-25T00:00:00Z', end_time: '2026-12-01T00:00:00Z', is_all_day: true },
    { summary: 'HOLD: Zurich + Zug', location: null, start_time: '2026-11-13T00:00:00Z', end_time: '2026-11-18T00:00:00Z' },
    { summary: 'Dinner w/ Erik', location: 'Some restaurant, Zürich', start_time: '2026-11-13T18:00:00Z' },
  ]);
  assert.deepEqual(stays.map((s) => [s.from, s.to, s.address.split(',')[0]]), [
    ['2026-11-13', '2026-11-18', 'Münchhaldenstrasse 15'],
    ['2026-11-25', '2026-12-01', '491 Hackney Rd'],
  ]);
});

test('gyms near a stay: fitness centres within 2 km, nearest first, named once', async () => {
  const calls = [];
  const fake = async (url) => {
    calls.push(String(url));
    const q = new URL(url).searchParams.get('q');
    const body = q !== 'Münchhaldenstrasse 15, 8008 Zürich'
      ? [
          { type: 'fitness_centre', name: 'ACTIV Fitness Kreuzplatz', lat: '47.3644', lon: '8.5542' },
          { type: 'fitness_centre', name: 'ACTIV Fitness Tiefenbrunnen', lat: '47.35146', lon: '8.56148', extratags: { website: 'https://www.activfitness.ch' } },
          { type: 'fitness_centre', name: 'ACTIV Fitness Tiefenbrunnen', lat: '47.3515', lon: '8.5615' },
          { type: 'sports_shop', name: 'Fitness shop', lat: '47.3544', lon: '8.5576' },
          { type: 'fitness_centre', name: 'Far gym', lat: '47.40', lon: '8.60' },
        ]
      : [{ lat: '47.3543', lon: '8.5575' }];
    return { ok: true, json: async () => body };
  };
  const r = await gymsNear('Münchhaldenstrasse 15, 8008 Zürich', { fetch: fake });
  assert.deepEqual(r.gyms.map((g) => [g.name, walk(g.m)]), [['ACTIV Fitness Tiefenbrunnen', '430 m'], ['ACTIV Fitness Kreuzplatz', '1.2 km']]);
  assert.equal(r.gyms[0].website, 'https://www.activfitness.ch');
  assert.equal(calls.length, 4);
  assert.match(calls[1], /bounded=1/);
});

test('distance', () => {
  assert.equal(distanceM({ lat: 51.53195, lon: -0.06109 }, { lat: 51.52519, lon: -0.05527 }), 853);
});
