/** The DEXA scans for /health (dexa_scans, filled by the BodySpec sync in bodyspec-api.ts). */

import { sql } from '@/db';
import { toDay } from '@/lib/db-time.mjs';
import { dexaView, type Scan } from './bodyspec.mjs';

export type DexaView = ReturnType<typeof dexaView>;

/** Every scan of the user (a few a year), without the raw API answers. */
export async function loadDexa(userId: string): Promise<DexaView> {
  const rows = (await sql`
    SELECT result_id, scan_date, location, total_mass_kg, fat_mass_kg, lean_mass_kg, body_fat_pct, vat_mass_kg,
      android_gynoid_ratio, bone_density, rmr_kcal, regions, percentiles
    FROM dexa_scans WHERE user_id = ${userId} ORDER BY scan_date`) as Record<string, unknown>[];
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const scans: Scan[] = rows.map((r) => ({
    resultId: String(r.result_id),
    scanDate: toDay(r.scan_date) ?? '',
    location: (r.location as string | null) ?? null,
    totalMassKg: n(r.total_mass_kg),
    fatMassKg: n(r.fat_mass_kg),
    leanMassKg: n(r.lean_mass_kg),
    bodyFatPct: n(r.body_fat_pct),
    vatMassKg: n(r.vat_mass_kg),
    androidGynoidRatio: n(r.android_gynoid_ratio),
    boneDensity: n(r.bone_density),
    rmrKcal: n(r.rmr_kcal),
    regions: (r.regions as Scan['regions']) ?? null,
    percentiles: (r.percentiles as Scan['percentiles']) ?? null,
  }));
  return dexaView(scans.filter((s) => s.scanDate));
}
