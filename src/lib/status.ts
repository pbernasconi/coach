import { sql } from '@/db';

export type Targets = { runKm: number; rideHours: number; strength: number };
export const DEFAULT_TARGETS: Targets = { runKm: 35, rideHours: 4, strength: 2 };

export type Warning = { level: 'error' | 'warn' | 'info'; source: 'strava' | 'lift' | 'calendar'; text: string };

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
  warnings: Warning[];
};

type Row = Record<string, unknown>;
/**
 * A database time as ISO 8601, or null. Postgres sends `timestamp` as '2026-10-20 03:00:41.123' (UTC here) and
 * `timestamptz` as '2026-10-20 03:00:41.123+00'; only a value without a zone gets 'Z'. An unreadable value is null,
 * so one odd row never breaks the start page.
 */
export function iso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  const text = String(v).trim().replace(' ', 'T');
  const zoned = /(Z|[+-]\d{2}(:?\d{2})?)$/.test(text);
  const d = new Date(zoned ? text.replace(/([+-]\d{2})$/, '$1:00') : `${text}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
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
  const [conn, newest, lift, cals] = await Promise.all([
    sql`SELECT athlete_id, is_active, last_synced_at FROM strava_connections WHERE user_id = ${userId} LIMIT 1` as Promise<Row[]>,
    sql`SELECT max(start_date_local) AS at FROM strava_activities WHERE user_id = ${userId}` as Promise<Row[]>,
    sql`SELECT max(updated_at) AS at, count(*) FILTER (WHERE entity = 'session' AND deleted_at IS NULL) AS sessions FROM lift_rows` as Promise<Row[]>,
    sql`SELECT google_email, is_active, last_synced_at FROM calendar_connections WHERE user_id = ${userId} ORDER BY is_active DESC, google_email` as Promise<Row[]>,
  ]);
  const env = process.env;
  const strava: Status['strava'] = {
    connected: Boolean(conn[0]?.is_active),
    athleteId: conn[0] ? Number(conn[0].athlete_id) : null,
    lastSyncedAt: iso(conn[0]?.last_synced_at),
    newestActivity: newest[0]?.at ? String(iso(newest[0].at)).slice(0, 10) : null,
    canSync: Boolean(env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET),
    canConnect: Boolean(env.STRAVA_CLIENT_ID && env.STRAVA_REDIRECT_URI),
  };
  const liftStatus: Status['lift'] = {
    tokenSet: Boolean(env.LIFT_SYNC_TOKEN),
    lastChangeAt: iso(lift[0]?.at),
    sessions: Number(lift[0]?.sessions ?? 0),
  };
  const calendars = cals.map((c) => ({ email: String(c.google_email), active: Boolean(c.is_active), lastSyncedAt: iso(c.last_synced_at) }));

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
    warnings.push({ level: 'info', source: 'lift', text: 'Lift has not synced yet. Paste the sync token into Lift → Settings → Sync.' });
  } else if (hoursSince(liftStatus.lastChangeAt, now) > 10 * 24) {
    warnings.push({ level: 'info', source: 'lift', text: `No Lift changes for ${ago(hoursSince(liftStatus.lastChangeAt, now))}.` });
  }
  const personal = calendars.find((c) => c.active);
  if (personal && hoursSince(personal.lastSyncedAt, now) > 3) {
    warnings.push({ level: 'warn', source: 'calendar', text: `Calendar has not synced for ${ago(hoursSince(personal.lastSyncedAt, now))} (it should sync every 30 min).` });
  }
  return { strava, lift: liftStatus, calendars, warnings };
}
