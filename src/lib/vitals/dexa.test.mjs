import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balancePct, dexaTrends, fullScan, historyReport, neighbours, scanReport, storedDerived } from './dexa.mjs';

const region = (fat, lean, bone = 0.2) => ({ fat_mass_kg: fat, lean_mass_kg: lean, bone_mass_kg: bone, total_mass_kg: fat + lean + bone, region_fat_pct: (fat / (fat + lean + bone)) * 100, tissue_fat_pct: 20 });

/** A scan as BodySpec sends it: every section, the shape of https://app.bodyspec.com/openapi.json. */
const raw = (fatPct, armLean = 4) => ({
  'scan-info': { scanner_model: 'GE Lunar iDXA', acquire_time: '2025-08-08T09:40:00', analyze_time: '2025-08-08T09:52:00', patient_intake: { age_years: 38.2, height_cm: 180, weight_kg: 83.5 } },
  composition: {
    total: { fat_mass_kg: 16, lean_mass_kg: 63, bone_mass_kg: 3.5, total_mass_kg: 82.5, region_fat_pct: fatPct, tissue_fat_pct: fatPct + 0.8 },
    regions: {
      left_arm: region(0.9, armLean), right_arm: region(0.95, armLean + 0.2), trunk: region(8, 30, 1),
      left_leg: region(2.5, 10.5, 0.6), right_leg: region(2.6, 10.9, 0.6), android: region(1.4, 3.6, 0.06), gynoid: region(2.4, 8.5, 0.3),
      head: region(1, 4, 0.6),
    },
    android_gynoid_ratio: 0.98,
  },
  'visceral-fat': { vat_mass_kg: 0.52, vat_volume_cm3: 551 },
  'bone-density': {
    total: { bone_mineral_density: 1.31, bone_area_cm2: 2400, bone_mineral_content_g: 3150, age_sex_z_percentile: 70, peak_sex_t_percentile: 66 },
    regions: { trunk: { bone_mineral_density: 1.1 }, left_arm: { bone_mineral_density: 0.95 } },
  },
  percentiles: {
    params: { gender: 'male', reference_age_range: { min_years: 35, max_years: 41 }, reference_dataset_size: 12000 },
    metrics: { vat_mass_kg: { value: 0.52, percentile: 30 }, total_body_fat_pct: { value: fatPct, percentile: 22 }, mystery_score: { value: 3, percentile: 51 } },
  },
  rmr: { estimates: [{ formula: 'ten Haaf (2014)', kcal_per_day: 1850 }, { formula: 'Cunningham (1980)', kcal_per_day: 1901 }] },
});

const row = (date, fatPct, armLean) => ({ resultId: `r-${date}`, scanDate: date, location: 'SF Marina', raw: raw(fatPct, armLean) });

test('fullScan reads every section', () => {
  const s = fullScan(row('2025-08-08', 19.4, 4));
  assert.equal(s.scanner, 'GE Lunar iDXA');
  assert.equal(s.heightCm, 180);
  assert.equal(s.weightKg, 83.5);
  assert.equal(s.totals.fatPct, 19.4);
  assert.equal(s.vat.massKg, 0.52);
  assert.deepEqual(s.regions.map((r) => r.key), ['right_arm', 'left_arm', 'trunk', 'android', 'gynoid', 'right_leg', 'left_leg', 'head']);
  assert.equal(s.regions.at(-1).label, 'Head');
  assert.equal(s.bone.total.zPercentile, 70);
  assert.deepEqual(s.bone.sites.map((b) => b.key), ['left_arm', 'trunk']);
  assert.equal(s.percentiles.gender, 'male');
  assert.equal(s.percentiles.minAge, 35);
  assert.deepEqual(s.percentiles.metrics.map((m) => m.key), ['total_body_fat_pct', 'vat_mass_kg', 'mystery_score']);
  assert.equal(s.percentiles.metrics[2].label, 'Mystery score');
  assert.equal(s.rmr.meanKcal, 1876);
});

test('the derived measures use the intake height', () => {
  const d = fullScan(row('2025-08-08', 19.4, 4)).derived;
  assert.ok(Math.abs(d.ffmi - 66.5 / 3.24) < 1e-9);
  assert.ok(Math.abs(d.armsLeanKg - 8.2) < 1e-9);
  assert.ok(Math.abs(d.almi - (8.2 + 21.4) / 3.24) < 1e-9);
  assert.ok(Math.abs(d.armLeanBalancePct - (0.2 / 4.1) * 100) < 1e-9);
  assert.ok(Math.abs(d.trunkToLimbFat - 8 / 6.95) < 1e-9);
  assert.equal(storedDerived(fullScan(row('2025-08-08', 19.4, 4))).ffmi, 20.525);
});

test('a scan with missing sections still reads', () => {
  const s = fullScan({ resultId: 'x', scanDate: '2024-01-01', raw: { composition: { total: { fat_mass_kg: 10 } } } });
  assert.equal(s.totals.fatKg, 10);
  assert.equal(s.derived.ffmi, null);
  assert.equal(s.bone.total, null);
  assert.deepEqual(s.regions, []);
  assert.equal(s.rmr.meanKcal, null);
  assert.match(scanReport(s, null), /Body fat: n\/a/);
  assert.equal(fullScan({ resultId: 'y', scanDate: '2024-01-01', raw: null }).totals.fatKg, null);
});

test('balancePct is right minus left over their mean', () => {
  assert.ok(Math.abs(balancePct(4.2, 4) - (0.2 / 4.1) * 100) < 1e-9);
  assert.equal(balancePct(null, 4), null);
  assert.equal(balancePct(0, 0), null);
});

test('dexaTrends orders scans and gives changes', () => {
  const t = dexaTrends([fullScan(row('2025-08-08', 18, 4.3)), fullScan(row('2024-12-11', 21, 4)), fullScan(row('2025-04-07', 19, 4.1))]);
  assert.deepEqual(t.scans.map((s) => s.scanDate), ['2024-12-11', '2025-04-07', '2025-08-08']);
  const fat = t.measures.find((m) => m.key === 'fatPct');
  assert.equal(fat.value, 18);
  assert.equal(fat.sincePrevious, -1);
  assert.equal(fat.sinceFirst, -3);
  const arms = t.measures.find((m) => m.key === 'armsLeanKg');
  assert.ok(Math.abs(arms.sinceFirst - 0.6) < 1e-9);
  const n = neighbours(t.scans, 'r-2025-04-07');
  assert.equal(n.previous.scanDate, '2024-12-11');
  assert.equal(n.next.scanDate, '2025-08-08');
  assert.equal(neighbours(t.scans, 'nope').index, -1);
});

test('scanReport has every section and the change since the scan before', () => {
  const prev = fullScan(row('2025-04-07', 20, 4));
  const s = fullScan(row('2025-08-08', 19, 4.2));
  const md = scanReport(s, prev);
  assert.match(md, /^# DEXA scan 2025-08-08/);
  assert.match(md, /SF Marina; scanner GE Lunar iDXA/);
  assert.match(md, /\| Right arm \| 0\.95 \| 4\.40 \|/);
  assert.match(md, /\| Total body \| 1\.310 \| 3150\.0 \| 2400\.0 \| 70 \| 66 \|/);
  assert.match(md, /Percentiles vs peers \(male, aged 35–41, 12,000 BodySpec scans\)/);
  assert.match(md, /Visceral fat: 0\.52 kg, 30th percentile \(lower is leaner\)/);
  assert.match(md, /ten Haaf \(2014\): 1850 kcal\/day/);
  assert.match(md, /Body fat: 20\.0 → 19\.0 % \(−1\.0\)/);
  assert.match(md, /Right arm: fat ±0\.00 kg, lean \+0\.20 kg/);
});

test('historyReport has a table of every scan and each report', () => {
  const md = historyReport([fullScan(row('2025-04-07', 20, 4)), fullScan(row('2025-08-08', 19, 4.2))], [
    { name: 'report.pdf', kind: 'report', scanDate: '2025-08-08', url: 'https://x/api/vitals/dexa/files/f1', text: 'Body fat 19%' },
  ]);
  assert.match(md, /2 scans, latest 2025-08-08/);
  assert.match(md, /\| 2025-04-07 \| 20\.0 \|/);
  assert.ok(md.indexOf('## DEXA scan 2025-08-08') < md.indexOf('## DEXA scan 2025-04-07'), 'newest first');
  assert.match(md, /### Totals/);
  assert.match(md, /report\.pdf \(report, scan 2025-08-08\)/);
  assert.match(md, /Body fat 19%/);
});
