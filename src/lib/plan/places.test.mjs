import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geocodeUrl, placeLabel, placesFrom } from './places.mjs';

test('geocodeUrl trims the query and asks for English JSON', () => {
  const u = new URL(geocodeUrl('  Lisbon '));
  assert.equal(u.hostname, 'geocoding-api.open-meteo.com');
  assert.equal(u.searchParams.get('name'), 'Lisbon');
  assert.equal(u.searchParams.get('language'), 'en');
});

test('placeLabel leaves out a region that repeats the name', () => {
  assert.equal(placeLabel({ name: 'San Francisco', admin1: 'California', country: 'United States' }), 'San Francisco, California, United States');
  assert.equal(placeLabel({ name: 'Lisbon', admin1: 'Lisbon', country: 'Portugal' }), 'Lisbon, Portugal');
  assert.equal(placeLabel({ name: 'Monaco', country_code: 'MC' }), 'Monaco, MC');
});

test('placesFrom keeps hits with coordinates', () => {
  const json = {
    results: [
      { name: 'Lisbon', admin1: 'Lisbon', country: 'Portugal', latitude: 38.71667, longitude: -9.13333, timezone: 'Europe/Lisbon' },
      { name: 'Broken', latitude: null, longitude: 2 },
    ],
  };
  assert.deepEqual(placesFrom(json), [{ name: 'Lisbon, Portugal', lat: 38.7167, lon: -9.1333, timezone: 'Europe/Lisbon' }]);
  assert.deepEqual(placesFrom({}), []);
  assert.deepEqual(placesFrom(null), []);
});
