'use server';

import { revalidatePath } from 'next/cache';
import { clearCache } from '@/lib/data-cache';
import { sql } from '@/db';
import { ownerForSignedInUser } from '@/lib/owner';
import { saveCoachingNotes, saveTargets, type Targets } from '@/lib/status';
import { syncStrava } from '@/lib/strava-sync/sync.mjs';
import { syncBodyspec } from '@/lib/vitals/bodyspec-api';
import { locationFrom } from '@/lib/plan/calendar.mjs';
import { geocodeUrl, placesFrom } from '@/lib/plan/places.mjs';
import { DEFAULT_PLACE, type Place } from '@/lib/plan/weather';
import { saveGoals } from '@/lib/goals/goals.mjs';

async function owner() {
  const id = await ownerForSignedInUser();
  if (!id) throw new Error('Not signed in');
  return id;
}

/** Runs one Strava sync now. Returns a short result line. */
export async function syncStravaNow(): Promise<string> {
  await owner();
  try {
    const r = await syncStrava(sql, { detailed: true, streams: 'new', waitOnRateLimit: false, log: () => {}, warn: () => {} });
    clearCache('status');
    clearCache('activities');
    revalidatePath('/', 'layout');
    return `Synced ${r.upserted} ${r.upserted === 1 ? 'activity' : 'activities'}.`;
  } catch (e) {
    return `Sync failed: ${(e as Error).message}`;
  }
}

/** Pulls new BodySpec DEXA scans now. Returns a short result line. */
export async function syncBodyspecNow(): Promise<string> {
  const userId = await owner();
  try {
    const r = await syncBodyspec(userId);
    revalidatePath('/', 'layout');
    const changed = r.added + r.updated;
    return changed ? `${changed} ${changed === 1 ? 'scan' : 'scans'} synced; ${r.scans} in total.` : `No new scans; ${r.scans} in total.`;
  } catch (e) {
    return `Sync failed: ${(e as Error).message}`;
  }
}

/** The Lift sync token, for pasting into the iPhone. Only the owner gets it. */
export async function revealLiftToken(): Promise<string | null> {
  await owner();
  return process.env.LIFT_SYNC_TOKEN ?? null;
}

export async function saveTargetsAction(t: Targets) {
  const id = await owner();
  const clean = (v: unknown, max: number) => Math.min(max, Math.max(0, Math.round(Number(v) * 10) / 10 || 0));
  await saveTargets(id, { runKm: clean(t.runKm, 300), rideHours: clean(t.rideHours, 40), strength: clean(t.strength, 7) });
  clearCache('status');
  revalidatePath('/', 'layout');
}

/** Lift's sync state, for the Connect Lift card to watch while the iPhone connects. */
export async function liftSyncState(): Promise<{ lastChangeAt: string | null; sessions: number }> {
  const id = await owner();
  const { loadStatus } = await import('@/lib/status');
  const s = await loadStatus(id);
  return { lastChangeAt: s.lift.lastChangeAt, sessions: s.lift.sessions };
}

export async function saveCoachingNotesAction(notes: string) {
  const id = await owner();
  await saveCoachingNotes(id, String(notes).slice(0, 20_000));
  revalidatePath('/settings');
}

export type PlaceHit = { name: string; lat: number; lon: number; timezone: string | null };

/** Places that match a name (Open-Meteo geocoding, free, no key). Empty on a short query or an error. */
export async function searchPlacesAction(query: string): Promise<PlaceHit[]> {
  await owner();
  const q = String(query ?? '').trim();
  if (q.length < 2) return [];
  try {
    const r = await fetch(geocodeUrl(q), { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(4000) });
    if (!r.ok) return [];
    return placesFrom(await r.json()) as PlaceHit[];
  } catch {
    return [];
  }
}

/** The weather location for /plan (users.settings.location), and whether it is the default. */
export async function loadLocationAction(): Promise<{ place: Place; isDefault: boolean }> {
  const id = await owner();
  const [u] = (await sql`SELECT settings -> 'location' AS location FROM users WHERE id = ${id}`) as { location: unknown }[];
  const place = locationFrom({ location: u?.location }, null) as Place | null;
  return place ? { place, isDefault: false } : { place: DEFAULT_PLACE, isDefault: true };
}

/** Saves users.settings.location ({ name, lat, lon }), or removes it (back to the default) with null. */
export async function saveLocationAction(place: { name: string; lat: number; lon: number } | null) {
  const id = await owner();
  if (place === null) {
    await sql`UPDATE users SET settings = settings - 'location', updated_at = NOW() WHERE id = ${id}`;
  } else {
    const clean = locationFrom({ location: { name: String(place.name ?? '').slice(0, 120), lat: place.lat, lon: place.lon } }, null) as Place | null;
    if (!clean) throw new Error('Bad location');
    await sql`
      UPDATE users SET settings = jsonb_set(settings, '{location}', ${JSON.stringify(clean)}::jsonb), updated_at = NOW()
      WHERE id = ${id}`;
  }
  revalidatePath('/plan');
  revalidatePath('/settings');
}

/** Saves the milestone goals. saveGoals drops any goal that is not valid. */
export async function saveGoalsAction(goals: unknown[]) {
  const id = await owner();
  await saveGoals(sql, id, goals.slice(0, 20));
  clearCache('status');
  revalidatePath('/', 'layout');
}

export type ThresholdInput = { ftp: number | null; runLthr: number | null; rideLthr: number | null; restingHr: number | null; runPaceS: number | null };

/**
 * Saves the TSS thresholds (an empty field is automatic: Garmin, Strava or an estimate), then recomputes every
 * activity's TSS and the training load (CTL, ATL, TSB) with them.
 */
export async function saveThresholdsAction(t: ThresholdInput): Promise<string> {
  const id = await owner();
  const clean = (v: unknown, min: number, max: number) => {
    const n = Number(v);
    return v == null || v === '' || !Number.isFinite(n) || n <= 0 ? null : Math.min(max, Math.max(min, Math.round(n)));
  };
  const value = {
    ftp: clean(t.ftp, 50, 600), runLthr: clean(t.runLthr, 100, 220), rideLthr: clean(t.rideLthr, 100, 220),
    restingHr: clean(t.restingHr, 25, 100), runPaceS: clean(t.runPaceS, 150, 600),
  };
  const own = Object.fromEntries(Object.entries(value).filter(([, v]) => v != null));
  await sql`
    UPDATE users SET settings = jsonb_set(settings, '{thresholds}', ${JSON.stringify(own)}::jsonb), updated_at = NOW()
    WHERE id = ${id}`;
  const { recomputeAllTss } = await import('@/lib/strava-sync/thresholds.mjs');
  const { rebuildTrainingLoad } = await import('@/lib/strava-sync/sync.mjs');
  const r = await recomputeAllTss(sql, id);
  if (r.changed) await rebuildTrainingLoad(sql, id, () => {});
  clearCache('activities');
  revalidatePath('/', 'layout');
  return `Thresholds saved. ${r.changed} of ${r.total} activities have a new TSS.`;
}

