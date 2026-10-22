import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeAt, profileAt, profileSeries } from './profile.mjs';

const t = Array.from({ length: 21 }, (_, i) => i * 10);
const d = t.map((x) => x * 3); // 3 m/s
const alt = d.map((x) => 50 + x * 0.05); // 5% grade
const s = { t, d, alt, speed: t.map(() => 3), hr: t.map(() => 150) };

test('gradeAt: rise over run around the point', () => {
  assert.equal(Math.round(gradeAt(alt, d, 10)), 5);
  assert.equal(gradeAt(alt, [null, ...d.slice(1)], 0), null);
});

test('profileAt: time title, then distance, elevation, grade, pace, HR', () => {
  const { speed } = profileSeries(s);
  const p = profileAt(s, speed, 10, true);
  assert.equal(p.title, '1:40');
  assert.deepEqual(p.rows.map((r) => r.value), ['0.30 km', '65 m', '5.0%', '5:33 /km', '150 bpm']);
  assert.equal(profileAt(s, speed, 10, false).rows[3].value, '10.8 km/h');
});
