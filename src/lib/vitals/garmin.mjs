// The Garmin connection (COACH-API.md, Health → Garmin). The GitHub Actions job (scripts/garmin/sync.py) keeps its
// Garmin tokens here, encrypted with AES-256-GCM. The key (GARMIN_TOKEN_KEY) is only in GitHub and on Paolo's Mac,
// so Coach stores and returns ciphertext it cannot read. The job also reports each run, so the app can show when
// Garmin data stops.
//
// The handlers are transport-agnostic like sync.mjs: the route passes the header and body and sends back
// `{ status, body }`. Nothing here logs the ciphertext or the error text.

import { isAuthorized } from '../lift-sync/auth.mjs';
import { isCalendarDate } from './sync.mjs';

export const STATUSES = /** @type {const} */ (['ok', 'auth_failed', 'error']);
export const MAX_CIPHERTEXT_LENGTH = 20_000;
export const MAX_ERROR_LENGTH = 300;
export const MAX_BODY_BYTES = 64_000;
/** After this many hours without a successful run, the app shows a warning. */
export const STALE_HOURS = 36;

// sync.py writes "v1." + base64url(nonce || ciphertext || tag). Anything else is refused, so a plaintext token
// cannot be stored here by mistake.
const CIPHERTEXT_RE = /^v1\.[A-Za-z0-9_-]{40,}$/;

/**
 * @typedef {'ok' | 'auth_failed' | 'error'} GarminSyncStatus
 * @typedef {object} GarminConnectionRow
 * @property {string | null} tokensCiphertext
 * @property {GarminSyncStatus} status
 * @property {string | null} lastSuccessAt ISO time
 * @property {string | null} lastAttemptAt ISO time
 * @property {string | null} lastError
 * @property {string | null} syncedThrough YYYY-MM-DD
 * @property {string | null} [backfillFrom] YYYY-MM-DD: an unfinished backfill starts here
 * @property {string | null} [backfillThrough] YYYY-MM-DD: the backfill's progress
 * @typedef {object} GarminUpdate
 * @property {string} [tokensCiphertext]
 * @property {GarminSyncStatus} [status]
 * @property {string | null} [lastError]
 * @property {string | null} [syncedThrough]
 * @property {string | null} [backfillFrom]
 * @property {string | null} [backfillThrough]
 * @property {boolean} [success] true sets last_success_at to now
 * @property {boolean} [attempt] true sets last_attempt_at to now (every update that reports a run)
 * @typedef {object} GarminRepository
 * @property {() => Promise<string | null>} ownerId
 * @property {(userId: string) => Promise<GarminConnectionRow | null>} get
 * @property {(userId: string, update: GarminUpdate) => Promise<void>} update insert the row or change only the given fields
 */

/**
 * Checks a PUT body. Every field is optional, but the body must change something.
 * @param {unknown} body
 * @returns {{ ok: true, update: GarminUpdate } | { ok: false, error: string }}
 */
export function parseGarminUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'body must be an object' };
  const b = /** @type {Record<string, unknown>} */ (body);
  /** @type {GarminUpdate} */
  const update = {};
  if (b.tokens_ciphertext !== undefined) {
    const t = b.tokens_ciphertext;
    if (typeof t !== 'string' || t.length > MAX_CIPHERTEXT_LENGTH || !CIPHERTEXT_RE.test(t)) {
      return { ok: false, error: 'tokens_ciphertext must be "v1." and base64url ciphertext' };
    }
    update.tokensCiphertext = t;
  }
  if (b.status !== undefined) {
    if (!STATUSES.includes(/** @type {GarminSyncStatus} */ (b.status))) return { ok: false, error: `status must be one of ${STATUSES.join(', ')}` };
    update.status = /** @type {GarminSyncStatus} */ (b.status);
    update.attempt = true;
  }
  if (b.last_error !== undefined) {
    if (b.last_error !== null && typeof b.last_error !== 'string') return { ok: false, error: 'last_error must be text or null' };
    // Postgres text cannot hold U+0000; the rest is cut to a short line.
    const text = typeof b.last_error === 'string' ? b.last_error.replace(/\u0000/g, '').trim().slice(0, MAX_ERROR_LENGTH) : '';
    update.lastError = text || null;
  }
  if (b.synced_through !== undefined) {
    if (b.synced_through !== null && !isCalendarDate(b.synced_through)) return { ok: false, error: 'synced_through must be YYYY-MM-DD or null' };
    update.syncedThrough = /** @type {string | null} */ (b.synced_through);
  }
  for (const [field, prop] of /** @type {const} */ ([['backfill_from', 'backfillFrom'], ['backfill_through', 'backfillThrough']])) {
    if (b[field] === undefined) continue;
    if (b[field] !== null && !isCalendarDate(b[field])) return { ok: false, error: `${field} must be YYYY-MM-DD or null` };
    update[prop] = /** @type {string | null} */ (b[field]);
  }
  if (b.success !== undefined) {
    if (typeof b.success !== 'boolean') return { ok: false, error: 'success must be a boolean' };
    if (b.success && b.status !== undefined && b.status !== 'ok') return { ok: false, error: 'success: true needs status "ok"' };
    if (b.success) {
      update.success = true;
      update.status = 'ok';
      update.attempt = true;
      if (update.lastError === undefined) update.lastError = null;
    }
  }
  if (Object.keys(update).length === 0) return { ok: false, error: 'nothing to update' };
  return { ok: true, update };
}

/**
 * GET /api/vitals/garmin (CRON_SECRET). The stored row, or nulls when the job has not stored one yet.
 * @param {{ authorization: string | null, tokens: { cron?: string } }} req
 * @param {GarminRepository} repo
 */
export async function handleGarminGet(req, repo) {
  if (!isAuthorized(req.authorization, req.tokens.cron)) return { status: 401, body: { error: 'unauthorized' } };
  const owner = await repo.ownerId();
  if (!owner) return { status: 503, body: { error: 'no Coach user yet' } };
  const row = await repo.get(owner);
  return {
    status: 200,
    body: {
      tokens_ciphertext: row?.tokensCiphertext ?? null,
      synced_through: row?.syncedThrough ?? null,
      last_success_at: row?.lastSuccessAt ?? null,
      status: row?.status ?? null,
      backfill_from: row?.backfillFrom ?? null,
      backfill_through: row?.backfillThrough ?? null,
    },
  };
}

/**
 * PUT /api/vitals/garmin (CRON_SECRET). Body: { tokens_ciphertext?, status?, last_error?, synced_through?,
 * backfill_from?, backfill_through?, success? }.
 * Fields that are not sent keep their stored value.
 * @param {{ authorization: string | null, rawBody: string, tokens: { cron?: string } }} req
 * @param {GarminRepository} repo
 */
export async function handleGarminPut(req, repo) {
  if (!isAuthorized(req.authorization, req.tokens.cron)) return { status: 401, body: { error: 'unauthorized' } };
  if (Buffer.byteLength(req.rawBody, 'utf8') > MAX_BODY_BYTES) return { status: 413, body: { error: 'body too large' } };
  let body;
  try {
    body = JSON.parse(req.rawBody);
  } catch {
    return { status: 400, body: { error: 'body is not JSON' } };
  }
  const parsed = parseGarminUpdate(body);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };
  const owner = await repo.ownerId();
  if (!owner) return { status: 503, body: { error: 'no Coach user yet' } };
  await repo.update(owner, parsed.update);
  return { status: 200, body: { ok: true } };
}

/**
 * @typedef {object} GarminStatus
 * @property {boolean} connected the job has stored tokens
 * @property {GarminSyncStatus | null} status
 * @property {string | null} lastSuccessAt
 * @property {string | null} lastAttemptAt
 * @property {string | null} syncedThrough
 * @property {string | null} lastError
 * @property {{ from: string, through: string | null } | null} backfill an unfinished backfill
 * @property {{ level: 'error' | 'warn' | 'info', text: string } | null} warning
 */

const FIX = 'Run scripts/garmin/login.py on your Mac.';

/** "3 h" or "4 days". @param {number} hours */
export function ago(hours) {
  if (hours < 1) return `${Math.max(0, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}

/**
 * The state the app shows. Pure: the query passes in the row and the time.
 * @param {GarminConnectionRow | null} row
 * @param {number} now ms
 * @returns {GarminStatus}
 */
export function garminStatusFrom(row, now) {
  const base = {
    connected: Boolean(row?.tokensCiphertext),
    status: row?.status ?? null,
    lastSuccessAt: row?.lastSuccessAt ?? null,
    lastAttemptAt: row?.lastAttemptAt ?? null,
    syncedThrough: row?.syncedThrough ?? null,
    lastError: row?.lastError ?? null,
    backfill: row?.backfillFrom ? { from: row.backfillFrom, through: row.backfillThrough ?? null } : null,
  };
  if (!row || !row.tokensCiphertext) {
    return { ...base, warning: { level: 'info', text: `Garmin sync is not set up. ${FIX}` } };
  }
  if (row.status === 'auth_failed') {
    return { ...base, warning: { level: 'error', text: `Garmin login has expired, so no Garmin data arrives. ${FIX}` } };
  }
  const success = row.lastSuccessAt ? Date.parse(row.lastSuccessAt) : NaN;
  const hours = Number.isFinite(success) ? (now - success) / 3_600_000 : Infinity;
  if (hours > STALE_HOURS) {
    const since = Number.isFinite(hours) ? `for ${ago(hours)}` : 'yet';
    const why = row.status === 'error' && row.lastError ? ` Last error: ${row.lastError}` : ' Check the Garmin workflow in GitHub Actions.';
    return { ...base, warning: { level: 'warn', text: `Garmin has not synced ${since}.${why}` } };
  }
  if (row.status === 'error') {
    return { ...base, warning: { level: 'info', text: `The last Garmin run had an error${row.lastError ? `: ${row.lastError}` : '.'}` } };
  }
  return { ...base, warning: null };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 19" for "2026-10-19". @param {string} day */
export function shortDay(day) {
  const [, m, d] = day.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/**
 * One line for /health: "Garmin: synced 3 h ago, through Oct 19".
 * @param {GarminStatus} s
 * @param {number} now ms
 */
export function garminLine(s, now) {
  if (!s.connected) return 'Garmin: not set up';
  if (!s.lastSuccessAt) return 'Garmin: no successful sync yet';
  const hours = (now - Date.parse(s.lastSuccessAt)) / 3_600_000;
  const through = s.syncedThrough ? `, through ${shortDay(s.syncedThrough)}` : '';
  const backfill = s.backfill ? ` (backfill from ${shortDay(s.backfill.from)}: ${s.backfill.through ? `through ${shortDay(s.backfill.through)}` : 'starting'})` : '';
  return `Garmin: synced ${ago(hours)} ago${through}${backfill}`;
}

/** An in-memory repository for tests. */
export function createMemoryGarminRepository(owner = 'user_test', now = () => new Date().toISOString()) {
  /** @type {Map<string, GarminConnectionRow>} */
  const rows = new Map();
  return {
    rows,
    ownerId: async () => owner,
    get: async (userId) => rows.get(userId) ?? null,
    update: async (userId, u) => {
      const prev = rows.get(userId) ?? {
        tokensCiphertext: null, status: 'ok', lastSuccessAt: null, lastAttemptAt: null, lastError: null, syncedThrough: null,
        backfillFrom: null, backfillThrough: null,
      };
      const at = now();
      rows.set(userId, {
        tokensCiphertext: u.tokensCiphertext ?? prev.tokensCiphertext,
        status: u.status ?? prev.status,
        lastError: u.lastError !== undefined ? u.lastError : prev.lastError,
        syncedThrough: u.syncedThrough !== undefined ? u.syncedThrough : prev.syncedThrough,
        backfillFrom: u.backfillFrom !== undefined ? u.backfillFrom : (prev.backfillFrom ?? null),
        backfillThrough: u.backfillThrough !== undefined ? u.backfillThrough : (prev.backfillThrough ?? null),
        lastSuccessAt: u.success ? at : prev.lastSuccessAt,
        lastAttemptAt: u.attempt ? at : prev.lastAttemptAt,
      });
    },
  };
}

// --------------------------------------------------------------------------- //
// Raw archive: POST /api/vitals/garmin/raw
// --------------------------------------------------------------------------- //

/**
 * The Garmin responses the job archives, one row per (day, kind) in garmin_raw. Daily kinds use the day they
 * describe; the once-a-run kinds (lactate_threshold … power_zones) use the run's day. scripts/garmin/sync.py
 * sends them, with the account ids, names and emails removed. health_samples keeps the mapped metrics; this
 * archive lets Coach map more later without fetching from Garmin again.
 */
export const RAW_KINDS = /** @type {const} */ ([
  // daily
  'summary', 'hrv', 'sleep', 'readiness', 'max_metrics', 'body_composition', 'heart_rates', 'stress',
  'training_status', 'endurance_score', 'hill_score', 'race_predictions', 'body_battery_events',
  // once a run
  'lactate_threshold', 'lactate_threshold_history', 'cycling_ftp', 'fitness_age', 'personal_records',
  'power_curve', 'stamina_curve', 'running_economy', 'running_tolerance', 'hr_zones', 'power_zones',
]);
/** Vercel refuses request bodies over 4.5 MB; the job sends at most this. */
export const MAX_RAW_BODY_BYTES = 4_000_000;
export const MAX_RAW_ITEMS = 500;

/**
 * @typedef {(typeof RAW_KINDS)[number]} GarminRawKind
 * @typedef {{ date: string, kind: GarminRawKind, payload: string }} GarminRawRow payload is JSON text
 * @typedef {object} GarminRawRepository
 * @property {() => Promise<string | null>} ownerId
 * @property {(userId: string, rows: GarminRawRow[]) => Promise<void>} upsertRaw insert or replace on (user, date, kind)
 */

/**
 * POST /api/vitals/garmin/raw (CRON_SECRET). Body `{ items: [{ date, kind, payload }] }`. Invalid items are
 * rejected one by one with their index; the others are stored. When (date, kind) comes twice, the last one wins.
 * @param {{ authorization: string | null, rawBody: string, tokens: { cron?: string }, today?: string }} req
 * @param {GarminRawRepository} repo
 */
export async function handleGarminRawPush(req, repo) {
  if (!isAuthorized(req.authorization, req.tokens.cron)) return { status: 401, body: { error: 'unauthorized' } };
  if (Buffer.byteLength(req.rawBody, 'utf8') > MAX_RAW_BODY_BYTES) return { status: 413, body: { error: `body over ${MAX_RAW_BODY_BYTES} bytes` } };
  let body;
  try {
    body = JSON.parse(req.rawBody);
  } catch {
    return { status: 400, body: { error: 'body is not JSON' } };
  }
  const items = body && typeof body === 'object' ? body.items : undefined;
  if (!Array.isArray(items)) return { status: 400, body: { error: 'items must be an array' } };
  if (items.length > MAX_RAW_ITEMS) return { status: 400, body: { error: `at most ${MAX_RAW_ITEMS} items per request` } };

  const today = req.today ?? new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);
  /** @type {{ index: number, reason: string }[]} */
  const rejected = [];
  /** @type {Map<string, GarminRawRow>} */
  const byKey = new Map();
  items.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return rejected.push({ index, reason: 'item is not an object' });
    const { date, kind, payload } = item;
    if (!isCalendarDate(date) || date < '2000-01-01' || date > tomorrow) return rejected.push({ index, reason: 'date must be YYYY-MM-DD, not in the future' });
    if (!RAW_KINDS.includes(kind)) return rejected.push({ index, reason: 'unknown kind' });
    if (payload === null || typeof payload !== 'object') return rejected.push({ index, reason: 'payload must be an object or array' });
    const text = JSON.stringify(payload);
    // Postgres jsonb cannot hold U+0000.
    if (text.includes('\\u0000')) return rejected.push({ index, reason: 'payload contains U+0000' });
    const key = `${date}|${kind}`;
    byKey.delete(key);
    byKey.set(key, { date, kind, payload: text });
  });
  const rows = [...byKey.values()];
  if (rows.length) {
    const owner = await repo.ownerId();
    if (!owner) return { status: 503, body: { error: 'no Coach user yet' } };
    await repo.upsertRaw(owner, rows);
  }
  return { status: 200, body: { accepted: items.length - rejected.length, rejected } };
}

/** An in-memory raw repository for tests. */
export function createMemoryGarminRawRepository(owner = 'user_test') {
  /** @type {Map<string, GarminRawRow & { userId: string }>} */
  const rows = new Map();
  return {
    rows,
    ownerId: async () => owner,
    upsertRaw: async (userId, list) => {
      for (const r of list) rows.set(`${userId}|${r.date}|${r.kind}`, { ...r, userId });
    },
  };
}
