/**
 * BodySpec (DEXA scans): OAuth, the API calls and the sync into dexa_scans. COACH-API.md, "BodySpec".
 *
 * BodySpec's API (https://app.bodyspec.com/docs) signs users in on its own Keycloak server, where they log in with
 * Google or email. Coach has no client secret: on the first connect it registers itself as a public client (dynamic
 * client registration, as MCP clients do) for its callback URL, and the code exchange uses PKCE. `offline_access`
 * gives a refresh token that lasts while it is used, and the daily sync uses it.
 */

import { createHash, randomBytes } from 'node:crypto';
import { sql } from '@/db';
import { toDate, toIso } from '@/lib/db-time.mjs';
import { SECTIONS, toScanRow } from './bodyspec.mjs';

const AUTH = 'https://auth.bodyspec.com/realms/bodyspec';
const API = 'https://app.bodyspec.com';
const SCOPE = 'openid offline_access';
export const OAUTH_COOKIE = 'bodyspec_oauth';
export const CALLBACK_PATH = '/api/auth/bodyspec/callback';

const timeout = () => AbortSignal.timeout(20_000);

/** A failure to show in Settings: a short line without tokens or health values. */
export class BodyspecError extends Error {
  constructor(message: string, readonly authFailed = false) {
    super(message);
  }
}

// --- OAuth ---------------------------------------------------------------------------------------------------

type Pending = { state: string; verifier: string; clientId: string; redirectUri: string };

/** Registers Coach with BodySpec's sign-in server for this callback URL. Returns the new client id. */
async function registerClient(redirectUri: string): Promise<string> {
  const res = await fetch(`${AUTH}/clients-registrations/openid-connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Coach',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
    signal: timeout(),
  });
  if (!res.ok) throw new BodyspecError(`BodySpec client registration failed (${res.status})`);
  const body = (await res.json()) as { client_id?: string };
  if (!body.client_id) throw new BodyspecError('BodySpec client registration returned no client id');
  return body.client_id;
}

/** The client id for this callback URL: the stored one, or a new registration. */
async function clientFor(userId: string, redirectUri: string): Promise<string> {
  const [row] = (await sql`SELECT client_id, redirect_uri FROM bodyspec_connections WHERE user_id = ${userId}`) as { client_id: string; redirect_uri: string }[];
  if (row && row.redirect_uri === redirectUri) return row.client_id;
  return registerClient(redirectUri);
}

/** The BodySpec sign-in URL and the cookie value that the callback checks (state, PKCE verifier, client). */
export async function startAuthorization(userId: string, origin: string): Promise<{ url: string; cookie: string }> {
  const redirectUri = `${origin}${CALLBACK_PATH}`;
  const clientId = await clientFor(userId, redirectUri);
  const state = randomBytes(24).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  const pending: Pending = { state, verifier, clientId, redirectUri };
  return { url: `${AUTH}/protocol/openid-connect/auth?${params}`, cookie: Buffer.from(JSON.stringify(pending)).toString('base64url') };
}

/** The pending sign-in from the cookie, or null when it is missing or not ours. */
export function readPending(cookie: string | undefined): Pending | null {
  if (!cookie) return null;
  try {
    const p = JSON.parse(Buffer.from(cookie, 'base64url').toString()) as Pending;
    return typeof p.state === 'string' && typeof p.verifier === 'string' && typeof p.clientId === 'string' && typeof p.redirectUri === 'string' ? p : null;
  } catch {
    return null;
  }
}

type Tokens = { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };

async function tokenRequest(form: Record<string, string>): Promise<Tokens> {
  const res = await fetch(`${AUTH}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
    signal: timeout(),
  });
  if (!res.ok) {
    const err = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? '';
    // invalid_grant: the refresh token expired or was revoked. The user has to connect again.
    throw new BodyspecError(`BodySpec sign-in failed (${res.status}${err ? ` ${err}` : ''})`, res.status === 400 || res.status === 401);
  }
  return (await res.json()) as Tokens;
}

/** Trades the callback's code for tokens and stores the connection. */
export async function finishAuthorization(userId: string, p: Pending, code: string) {
  const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: p.redirectUri, client_id: p.clientId, code_verifier: p.verifier });
  const expires = new Date(Date.now() + (t.expires_in ?? 300) * 1000);
  await sql`
    INSERT INTO bodyspec_connections (user_id, client_id, redirect_uri, access_token, refresh_token, expires_at, scope, status, connected_at, last_error, updated_at)
    VALUES (${userId}, ${p.clientId}, ${p.redirectUri}, ${t.access_token}, ${t.refresh_token ?? null}, ${expires}, ${t.scope ?? SCOPE}, 'ok', now(), null, now())
    ON CONFLICT (user_id) DO UPDATE SET
      client_id = EXCLUDED.client_id, redirect_uri = EXCLUDED.redirect_uri, access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at, scope = EXCLUDED.scope, status = 'ok',
      connected_at = now(), last_error = null, updated_at = now()`;
}

type Connection = { client_id: string; access_token: string | null; refresh_token: string | null; expires_at: unknown };

/** A valid access token: the stored one, or a refreshed one (BodySpec rotates the refresh token, so both are saved). */
async function accessToken(userId: string, c: Connection): Promise<string> {
  const expires = toDate(c.expires_at);
  if (c.access_token && expires && expires.getTime() - Date.now() > 60_000) return c.access_token;
  if (!c.refresh_token) throw new BodyspecError('BodySpec is not connected', true);
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: c.refresh_token, client_id: c.client_id });
  const next = new Date(Date.now() + (t.expires_in ?? 300) * 1000);
  await sql`
    UPDATE bodyspec_connections SET access_token = ${t.access_token}, refresh_token = ${t.refresh_token ?? c.refresh_token},
      expires_at = ${next}, updated_at = now()
    WHERE user_id = ${userId}`;
  return t.access_token;
}

// --- API -----------------------------------------------------------------------------------------------------

async function api<T>(token: string, path: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: timeout() });
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) throw new BodyspecError(`BodySpec refused the request (${res.status})`, true);
  if (!res.ok) throw new BodyspecError(`BodySpec API error (${res.status}) on ${path.replace(/[0-9a-f-]{16,}/gi, '…')}`);
  return (await res.json()) as T;
}

type Summary = { result_id: string; start_time?: string | null; update_time?: string | null; location?: { name?: string | null } | null; service?: { name?: string | null } | null };

async function listResults(token: string): Promise<Summary[]> {
  const all: Summary[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await api<{ results: Summary[]; pagination?: { has_more?: boolean } }>(token, `/api/v1/users/me/results/?page=${page}&page_size=100`);
    all.push(...(r?.results ?? []));
    if (!r?.pagination?.has_more) break;
  }
  return all;
}

export type SyncResult = { scans: number; added: number; updated: number; newest: string | null };

/**
 * Pulls every BodySpec result that is new or changed since it was stored. A result whose sections are all missing
 * (not a DEXA scan) is skipped. Records the attempt, success or error on the connection.
 */
export async function syncBodyspec(userId: string): Promise<SyncResult> {
  const [c] = (await sql`SELECT client_id, access_token, refresh_token, expires_at FROM bodyspec_connections WHERE user_id = ${userId}`) as Connection[];
  if (!c) throw new BodyspecError('BodySpec is not connected');
  await sql`UPDATE bodyspec_connections SET last_attempt_at = now() WHERE user_id = ${userId}`;
  try {
    const token = await accessToken(userId, c);
    const results = await listResults(token);
    const stored = new Map(
      ((await sql`SELECT result_id, result_updated_at FROM dexa_scans WHERE user_id = ${userId}`) as { result_id: string; result_updated_at: string | null }[]).map((r) => [
        r.result_id,
        r.result_updated_at,
      ])
    );
    let added = 0;
    let updated = 0;
    for (const summary of results) {
      const known = stored.has(summary.result_id);
      if (known && stored.get(summary.result_id) === (summary.update_time ?? null)) continue;
      const id = encodeURIComponent(summary.result_id);
      const fetched = await Promise.all(SECTIONS.map(async (s) => [s, await api<unknown>(token, `/api/v1/users/me/results/${id}/dexa/${s}`)] as const));
      const sections = Object.fromEntries(fetched.filter(([, v]) => v !== null));
      if (!sections.composition) continue;
      const row = toScanRow(userId, summary, sections);
      await sql`
        INSERT INTO dexa_scans (result_id, user_id, scanned_at, scan_date, location, scanner, age_years, height_cm, total_mass_kg, fat_mass_kg,
          lean_mass_kg, bone_mass_kg, body_fat_pct, vat_mass_kg, vat_volume_cm3, android_gynoid_ratio, bone_density, rmr_kcal, regions,
          bone_regions, percentiles, raw, result_updated_at, synced_at)
        VALUES (${row.resultId}, ${userId}, ${row.scannedAt}, ${row.scanDate}, ${row.location}, ${row.scanner}, ${row.ageYears}, ${row.heightCm},
          ${row.totalMassKg}, ${row.fatMassKg}, ${row.leanMassKg}, ${row.boneMassKg}, ${row.bodyFatPct}, ${row.vatMassKg}, ${row.vatVolumeCm3},
          ${row.androidGynoidRatio}, ${row.boneDensity}, ${row.rmrKcal}, ${JSON.stringify(row.regions)}::jsonb, ${JSON.stringify(row.boneRegions)}::jsonb,
          ${JSON.stringify(row.percentiles)}::jsonb, ${JSON.stringify(row.raw)}::jsonb, ${row.resultUpdatedAt}, now())
        ON CONFLICT (result_id) DO UPDATE SET
          scanned_at = EXCLUDED.scanned_at, scan_date = EXCLUDED.scan_date, location = EXCLUDED.location, scanner = EXCLUDED.scanner,
          age_years = EXCLUDED.age_years, height_cm = EXCLUDED.height_cm, total_mass_kg = EXCLUDED.total_mass_kg, fat_mass_kg = EXCLUDED.fat_mass_kg,
          lean_mass_kg = EXCLUDED.lean_mass_kg, bone_mass_kg = EXCLUDED.bone_mass_kg, body_fat_pct = EXCLUDED.body_fat_pct,
          vat_mass_kg = EXCLUDED.vat_mass_kg, vat_volume_cm3 = EXCLUDED.vat_volume_cm3, android_gynoid_ratio = EXCLUDED.android_gynoid_ratio,
          bone_density = EXCLUDED.bone_density, rmr_kcal = EXCLUDED.rmr_kcal, regions = EXCLUDED.regions, bone_regions = EXCLUDED.bone_regions,
          percentiles = EXCLUDED.percentiles, raw = EXCLUDED.raw, result_updated_at = EXCLUDED.result_updated_at, synced_at = now()
        WHERE dexa_scans.user_id = EXCLUDED.user_id`;
      if (known) updated++;
      else added++;
    }
    const [summary] = (await sql`SELECT count(*)::int AS n, max(scan_date)::text AS newest FROM dexa_scans WHERE user_id = ${userId}`) as { n: number; newest: string | null }[];
    await sql`UPDATE bodyspec_connections SET last_success_at = now(), status = 'ok', last_error = null WHERE user_id = ${userId}`;
    return { scans: summary?.n ?? 0, added, updated, newest: summary?.newest ?? null };
  } catch (e) {
    const err = e instanceof BodyspecError ? e : new BodyspecError('BodySpec sync failed');
    if (!(e instanceof BodyspecError)) console.error('BodySpec sync failed:', e);
    await sql`UPDATE bodyspec_connections SET status = ${err.authFailed ? 'auth_failed' : 'error'}, last_error = ${err.message} WHERE user_id = ${userId}`;
    throw err;
  }
}

export type BodyspecStatus = {
  connected: boolean;
  status: 'ok' | 'auth_failed' | 'error' | null;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  scans: number;
  newest: string | null;
};

/** The connection's state for Settings. */
export async function loadBodyspecStatus(userId: string): Promise<BodyspecStatus> {
  const [[c], [s]] = (await Promise.all([
    sql`SELECT status, refresh_token IS NOT NULL AS has_token, last_success_at, last_attempt_at, last_error FROM bodyspec_connections WHERE user_id = ${userId}`,
    sql`SELECT count(*)::int AS n, max(scan_date)::text AS newest FROM dexa_scans WHERE user_id = ${userId}`,
  ])) as [
    { status: BodyspecStatus['status']; has_token: boolean; last_success_at: unknown; last_attempt_at: unknown; last_error: string | null }[],
    { n: number; newest: string | null }[],
  ];
  return {
    connected: Boolean(c?.has_token),
    status: c?.status ?? null,
    lastSuccessAt: toIso(c?.last_success_at ?? null),
    lastAttemptAt: toIso(c?.last_attempt_at ?? null),
    lastError: c?.last_error ?? null,
    scans: s?.n ?? 0,
    newest: s?.newest ?? null,
  };
}
