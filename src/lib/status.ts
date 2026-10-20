import { sql } from '@/db';
import { cached } from '@/lib/data-cache';
import { toDay, toIso } from '@/lib/db-time.mjs';
import type { GarminStatus } from '@/lib/vitals/garmin.mjs';
import { loadGarminStatus } from '@/lib/vitals/queries';

export type Targets = { runKm: number; rideHours: number; strength: number };
export const DEFAULT_TARGETS: Targets = { runKm: 35, rideHours: 4, strength: 2 };

export type Warning = { level: 'error' | 'warn' | 'info'; source: 'strava' | 'lift' | 'calendar' | 'garmin'; text: string };

export type Status = {
  strava: {
    connected: boolean;
    athleteId: number | null;
    lastSyncedAt: string | null;
    newestActivity: string | null;
    canSync: boolean; // client id and secret are set
    canConnect: boolean; // client id and redirect URI are set
  };
  lift: { tokenSet: boolean; lastChangeAt: string | null; sessions: number };
  calendars: { email: string; active: boolean; lastSyncedAt: string | null }[];
  garmin: GarminStatus;
  warnings: Warning[];
};

type Row = Record<string, unknown>;
const hoursSince = (at: string | null, now: number) => (at ? (now - Date.parse(at)) / 3_600_000 : Infinity);

function ago(hours: number) {
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}

/** The weekly targets from users.settings, with defaults. */
export async function loadTargets(userId: string): Promise<Targets> {
  const [u] = (await sql`SELECT settings FROM users WHERE id = ${userId}`) as Row[];
  const t = ((u?.settings as { targets?: Partial<Targets> }) ?? {}).targets ?? {};
  return { ...DEFAULT_TARGETS, ...Object.fromEntries(Object.entries(t).filter(([, v]) => typeof v === 'number' && v >= 0)) };
}

/** Coaching preferences (goals, weekly structure, rules) as Markdown; /plan reads them through the profile. */
export async function loadCoachingNotes(userId: string): Promise<string> {
  const [u] = (await sql`SELECT settings ->> 'coachingNotes' AS notes FROM users WHERE id = ${userId}`) as Row[];
  return String(u?.notes ?? '');
}

export async function saveCoachingNotes(userId: string, notes: string) {
  await sql`
    UPDATE users SET settings = jsonb_set(settings, '{coachingNotes}', to_jsonb(${notes}::text)), updated_at = NOW()
    WHERE id = ${userId}`;
}

export async function saveTargets(userId: string, targets: Targets) {
  await sql`
    UPDATE users SET settings = jsonb_set(settings, '{targets}', ${JSON.stringify(targets)}::jsonb), updated_at = NOW()
    WHERE id = ${userId}`;
}

/**
 * The state of every connection, with warnings for anything that stops data from arriving.
 * error and warn show as a banner on every page and on the start page; info shows on Settings only.
 */
export async function loadStatus(userId: string, now = Date.now()): Promise<Status> {
  const [conn, newest, lift, cals, garmin] = await Promise.all([
    sql`SELECT athlete_id, is_active, last_synced_at FROM strava_connections WHERE user_id = ${userId} LIMIT 1` as Promise<Row[]>,
    sql`SELECT max(start_date_local) AS at FROM strava_activities WHERE user_id = ${userId}` as Promise<Row[]>,
    sql`SELECT max(updated_at) AS at, count(*) FILTER (WHERE entity = 'session' AND deleted_at IS NULL) AS sessions FROM lift_rows` as Promise<Row[]>,
    sql`SELECT google_email, is_active, last_synced_at FROM calendar_connections WHERE user_id = ${userId} ORDER BY is_active DESC, google_email` as Promise<Row[]>,
    // Garmin must not take down the banner or /api/home (a missing table, a bad row). runChecks() checks it alone.
    loadGarminStatus(userId, now).catch((error: unknown): GarminStatus => {
      console.error('Garmin status failed:', error instanceof Error ? error.name : 'unknown error');
      return {
        connected: false, status: null, lastSuccessAt: null, lastAttemptAt: null, syncedThrough: null, lastError: null, backfill: null,
        warning: { level: 'info', text: 'Garmin status could not be read.' },
      };
    }),
  ]);
  const env = process.env;
  const strava: Status['strava'] = {
    connected: Boolean(conn[0]?.is_active),
    athleteId: conn[0] ? Number(conn[0].athlete_id) : null,
    lastSyncedAt: toIso(conn[0]?.last_synced_at),
    newestActivity: toDay(newest[0]?.at),
    canSync: Boolean(env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET),
    canConnect: Boolean(env.STRAVA_CLIENT_ID && env.STRAVA_REDIRECT_URI),
  };
  const liftStatus: Status['lift'] = {
    tokenSet: Boolean(env.LIFT_SYNC_TOKEN),
    lastChangeAt: toIso(lift[0]?.at),
    sessions: Number(lift[0]?.sessions ?? 0),
  };
  const calendars = cals.map((c) => ({ email: String(c.google_email), active: Boolean(c.is_active), lastSyncedAt: toIso(c.last_synced_at) }));

  const warnings: Warning[] = [];
  if (!strava.connected) {
    warnings.push({ level: 'error', source: 'strava', text: 'Strava is not connected, so no activities arrive.' });
  } else if (!strava.canSync) {
    warnings.push({ level: 'warn', source: 'strava', text: 'Strava cannot sync: the Strava app secret is not set up.' });
  } else if (hoursSince(strava.lastSyncedAt, now) > 36) {
    warnings.push({ level: 'warn', source: 'strava', text: `Strava has not synced for ${ago(hoursSince(strava.lastSyncedAt, now))}.` });
  }
  if (!liftStatus.tokenSet) {
    warnings.push({ level: 'warn', source: 'lift', text: 'Lift sync is off: LIFT_SYNC_TOKEN is not set.' });
  } else if (!liftStatus.lastChangeAt) {
    warnings.push({ level: 'info', source: 'lift', text: 'Lift has not synced yet. Connect Lift in Settings → Lift.' });
  } else if (hoursSince(liftStatus.lastChangeAt, now) > 10 * 24) {
    warnings.push({ level: 'info', source: 'lift', text: `No Lift changes for ${ago(hoursSince(liftStatus.lastChangeAt, now))}.` });
  }
  const personal = calendars.find((c) => c.active);
  if (personal && hoursSince(personal.lastSyncedAt, now) > 3) {
    warnings.push({ level: 'warn', source: 'calendar', text: `Calendar has not synced for ${ago(hoursSince(personal.lastSyncedAt, now))} (it should sync every hour).` });
  }
  // Garmin: an expired login is an error, no success for 36 h a warning, "not set up" or a recent error info only.
  if (garmin.warning) warnings.push({ ...garmin.warning, source: 'garmin' });
  // A Vercel preview reads a copy of the data and must not sync (a Strava refresh there would rotate production's
  // token), so its missing secrets are expected: show them on Settings only, not as a banner.
  if (env.VERCEL_ENV === 'preview') {
    const quiet = warnings.map((w) => ({ ...w, level: 'info' as const }));
    quiet.unshift({ level: 'info', source: 'strava', text: 'Preview deployment: it reads the development database, and syncs are off.' });
    return { strava, lift: liftStatus, calendars, garmin, warnings: quiet };
  }
  return { strava, lift: liftStatus, calendars, garmin, warnings };
}

/**
 * loadStatus for the banner on every page and for /api/home: at most 5 minutes old, so a page view does not run
 * its eight queries (or wake the database) each time. Settings and /api/health read it fresh. A save in Settings
 * clears the tag.
 */
export const loadStatusCached = cached((userId: string) => loadStatus(userId), 'status-v1', 'status', 300);
