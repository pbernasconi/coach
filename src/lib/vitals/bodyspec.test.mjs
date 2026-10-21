import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armsLeanKg, dayOf, dexaView, rmrOf, toScanRow } from './bodyspec.mjs';

const region = (fat, lean) => ({ fat_mass_kg: fat, lean_mass_kg: lean, bone_mass_kg: 0.2, total_mass_kg: fat + lean + 0.2, region_fat_pct: 20, tissue_fat_pct: 21 });

const sections = {
  'scan-info': { result_id: 'r1', scanner_model: 'GE Lunar iDXA', acquire_time: '2026-03-02T08:10:00', patient_intake: { age_years: 38.4, height_cm: 180, weight_kg: 84 } },
  composition: {
    result_id: 'r1',
    total: { fat_mass_kg: 15.2, lean_mass_kg: 64.1, bone_mass_kg: 3.4, total_mass_kg: 82.7, region_fat_pct: 18.4, tissue_fat_pct: 19.2 },
    regions: { left_arm: region(1, 4.1), right_arm: region(1.1, 4.3), android: region(1.5, 4) },
    android_gynoid_ratio: 1.02,
  },
  'visceral-fat': { result_id: 'r1', vat_mass_kg: 0.61, vat_volume_cm3: 650 },
  'bone-density': { result_id: 'r1', total: { bone_mineral_density: 1.31 }, regions: { left_arm: { bone_mineral_density: 0.95 } } },
  percentiles: { result_id: 'r1', metrics: { vat_mass_kg: { value: 0.61, percentile: 40 } } },
  rmr: { result_id: 'r1', estimates: [{ formula: 'a', kcal_per_day: 1800 }, { formula: 'b', kcal_per_day: 1901 }] },
};

test('dayOf takes the local date of a BodySpec time', () => {
  assert.equal(dayOf('2026-03-02T08:10:00-08:00'), '2026-03-02');
  assert.equal(dayOf('2026-03-02'), '2026-03-02');
  assert.equal(dayOf(null), null);
  assert.equal(dayOf('soon'), null);
});

test('rmrOf averages the formula estimates', () => {
  assert.equal(rmrOf([{ kcal_per_day: 1800 }, { kcal_per_day: 1901 }]), 1851);
  assert.equal(rmrOf([]), null);
  assert.equal(rmrOf(undefined), null);
});

test('toScanRow maps every section', () => {
  const row = toScanRow('u1', { result_id: 'r1', start_time: '2026-03-02T08:10:00', update_time: '2026-03-02T10:00:00', location: { name: 'SF Mission' } }, sections);
  assert.equal(row.scanDate, '2026-03-02');
  assert.equal(row.scannedAt.toISOString(), '2026-03-02T08:10:00.000Z');
  assert.equal(row.location, 'SF Mission');
  assert.equal(row.scanner, 'GE Lunar iDXA');
  assert.equal(row.bodyFatPct, 18.4);
  assert.equal(row.fatMassKg, 15.2);
  assert.equal(row.leanMassKg, 64.1);
  assert.equal(row.vatMassKg, 0.61);
  assert.equal(row.androidGynoidRatio, 1.02);
  assert.equal(row.boneDensity, 1.31);
  assert.equal(row.rmrKcal, 1851);
  assert.equal(row.heightCm, 180);
  assert.equal(row.regions.left_arm.lean_mass_kg, 4.1);
  assert.equal(row.percentiles.vat_mass_kg.percentile, 40);
  assert.equal(row.resultUpdatedAt, '2026-03-02T10:00:00');
});

test('toScanRow keeps an offset and leaves missing sections null', () => {
  const row = toScanRow('u1', { result_id: 'r2', start_time: '2026-05-01T09:00:00-07:00' }, {});
  assert.equal(row.scannedAt.toISOString(), '2026-05-01T16:00:00.000Z');
  assert.equal(row.bodyFatPct, null);
  assert.equal(row.vatMassKg, null);
  assert.equal(row.regions, null);
  assert.equal(row.rmrKcal, null);
});

test('toScanRow refuses a result without a date', () => {
  assert.throws(() => toScanRow('u1', { result_id: 'r3' }, {}), /no date/);
});

test('armsLeanKg needs both arms', () => {
  assert.ok(Math.abs(armsLeanKg({ left_arm: region(1, 4.1), right_arm: region(1, 4.3) }) - 8.4) < 1e-9);
  assert.equal(armsLeanKg({ left_arm: region(1, 4.1) }), null);
  assert.equal(armsLeanKg(null), null);
});

test('dexaView orders scans and gives changes since the previous and first scan', () => {
  const scan = (d, fat, vat, lean) => ({
    resultId: d, scanDate: d, location: null, totalMassKg: 80, fatMassKg: fat, leanMassKg: lean, bodyFatPct: fat, vatMassKg: vat,
    androidGynoidRatio: 1, boneDensity: 1.3, rmrKcal: 1800, regions: { left_arm: region(1, lean / 16), right_arm: region(1, lean / 16) }, percentiles: null,
  });
  const v = dexaView([scan('2026-06-01', 17, 0.5, 64), scan('2025-12-01', 20, 0.8, 62), scan('2026-03-01', 18, 0.6, 63)]);
  assert.deepEqual(v.scans.map((s) => s.scanDate), ['2025-12-01', '2026-03-01', '2026-06-01']);
  const fat = v.measures.find((m) => m.key === 'bodyFatPct');
  assert.equal(fat.value, 17);
  assert.equal(fat.sincePrevious, -1);
  assert.equal(fat.sinceFirst, -3);
  assert.deepEqual(fat.series.map((p) => p.value), [20, 18, 17]);
  const arms = v.measures.find((m) => m.key === 'armsLeanKg');
  assert.equal(arms.value, 8);
  assert.equal(arms.sinceFirst, 64 / 8 - 62 / 8);
});

test('dexaView with one scan or none has no changes', () => {
  assert.equal(dexaView([]).latest, null);
  const one = dexaView([{ resultId: 'a', scanDate: '2026-01-01', location: null, totalMassKg: 80, fatMassKg: 15, leanMassKg: 62, bodyFatPct: 18, vatMassKg: 0.5, androidGynoidRatio: 1, boneDensity: 1.2, rmrKcal: 1800, regions: null, percentiles: null }]);
  const fat = one.measures.find((m) => m.key === 'bodyFatPct');
  assert.equal(fat.value, 18);
  assert.equal(fat.sincePrevious, null);
  assert.equal(fat.sinceFirst, null);
});
