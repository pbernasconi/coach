import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compass, pickHour, weatherLabel } from './weather.mjs';

const body = {
  hourly: {
    time: ['2026-10-13T21:00', '2026-10-13T22:00', '2026-10-13T23:00'],
    temperature_2m: [14.1, 14.9, 16],
    apparent_temperature: [13, 14, 15],
    relative_humidity_2m: [80, 75, 70],
    wind_speed_10m: [3, 4, 5],
    wind_direction_10m: [180, 200, 220],
    weather_code: [0, 1, 2],
    precipitation: [0, 0, 0],
  },
};

test('pickHour: the hour nearest the start', () => {
  const w = pickHour(body, '2026-10-13T21:34:25Z');
  assert.equal(w.time, '2026-10-13T22:00:00Z');
  assert.equal(w.tempC, 14.9);
  assert.equal(w.windDeg, 200);
});

test('pickHour: null when the hour is far or the values are missing', () => {
  assert.equal(pickHour(body, '2026-10-14T05:00:00Z'), null);
  assert.equal(pickHour({ hourly: { ...body.hourly, temperature_2m: [null, null, null] } }, '2026-10-13T22:00:00Z'), null);
  assert.equal(pickHour({}, '2026-10-13T22:00:00Z'), null);
});

test('weatherLabel and compass', () => {
  assert.equal(weatherLabel(0), 'Clear');
  assert.equal(weatherLabel(63), 'Rain');
  assert.equal(weatherLabel(null), 'Unknown');
  assert.equal(compass(0), 'N');
  assert.equal(compass(225), 'SW');
  assert.equal(compass(359), 'N');
});

test('placeName', async () => {
  const { placeName } = await import('./weather.mjs');
  assert.equal(placeName({ address: { city: 'Suwa', province: 'Nagano Prefecture', country: 'Japan' } }), 'Suwa, Japan');
  assert.equal(placeName({ address: { town: 'Bolinas', state: 'California', country: 'United States' } }), 'Bolinas, United States');
  assert.equal(placeName({}), null);
});
