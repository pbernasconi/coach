'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/db';
import { ownerForSignedInUser } from '@/lib/owner';
import { saveCoachingNotes, saveTargets, type Targets } from '@/lib/status';
import { syncStrava } from '@/lib/strava-sync/sync.mjs';

async function owner() {
  const id = await ownerForSignedInUser();
  if (!id) throw new Error('Not signed in');
  return id;
}

/** Runs one Strava sync now. Returns a short result line. */
export async function syncStravaNow(): Promise<string> {
  await owner();
  try {
    const r = await syncStrava(sql, { detailed: true, waitOnRateLimit: false, log: () => {}, warn: () => {} });
    revalidatePath('/', 'layout');
    return `Synced ${r.upserted} ${r.upserted === 1 ? 'activity' : 'activities'}.`;
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
