// Vitals ingestion (COACH-API.md, Health): one value per day and metric, from Garmin Connect (a GitHub Actions job,
// source "garmin") or Apple Health (the Lift app). `upsertVitals` is the one way in: the HTTP route uses it through a
// repository, and a server-side job can call it directly. The handlers are transport-agnostic, like the Lift sync
// ones: the route passes in the header, body or query and the configured tokens, and sends back `{ status, body }`.
// Values are health data: nothing here logs them.

import { isAuthorized } from '../lift-sync/auth.mjs';
import { METRICS, METRIC_IDS, isMetric } from './metrics.mjs';

export const MAX_SAMPLES = 2000;
export const MAX_BODY_BYTES = 1_000_000;
const MAX_SOURCE_LENGTH = 200;

/**
 * @typedef {import('./metrics.mjs').VitalMetric} VitalMetric
 * @typedef {{ date: string, metric: VitalMetric, value: number, unit: string, source: string }} VitalSample
 * @typedef {{ index: number, reason: string }} Rejection
 * @typedef {object} VitalsRepository
 * @property {() => Promise<string | null>} ownerId the user id that owns all Coach data (first row in users)
 * @property {(userId: string, samples: VitalSample[]) => Promise<void>} upsert write valid, de-duplicated samples
 * @property {(userId: string, since: string | null) => Promise<Partial<Record<VitalMetric, string>>>} latestDates
 *   the newest date stored for each metric, counting only dates on or after `since` when it is given
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar day written as YYYY-MM-DD. */
export function isCalendarDate(s) {
  if (typeof s !== 'string') return false;
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toISOString().slice(0, 10) === s;
}

/** Text that Postgres can store: no U+0000 and no unpaired surrogate. */
function storable(s) {
  return !/\u0000/.test(s) && s.isWellFormed?.() !== false;
}

const utcToday = () => new Date().toISOString().slice(0, 10);

/**
 * Checks one sample. `today` is the UTC day; a sample may be at most one day ahead of it (time zones).
 * @returns {{ ok: true, sample: VitalSample } | { ok: false, reason: string }}
 */
export function validateSample(raw, today = utcToday()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'sample is not an object' };
  const { date, metric, value, unit, source } = raw;
  if (!isCalendarDate(date)) return { ok: false, reason: 'date must be YYYY-MM-DD' };
  if (date < '2000-01-01') return { ok: false, reason: 'date is before 2000-01-01' };
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);
  if (date > tomorrow) return { ok: false, reason: 'date is in the future' };
  if (!isMetric(metric)) return { ok: false, reason: 'unknown metric' };
  const spec = METRICS[metric];
  if (typeof value !== 'number' || !Number.isFinite(value)) return { ok: false, reason: 'value must be a finite number' };
  if (value < spec.min || value > spec.max) return { ok: false, reason: `value out of range for ${metric} (${spec.min} to ${spec.max})` };
  if (spec.integer && !Number.isInteger(value)) return { ok: false, reason: `value must be an integer for ${metric}` };
  if (typeof source !== 'string' || !source.trim() || source.length > MAX_SOURCE_LENGTH || !storable(source)) {
    return { ok: false, reason: `source must be text of 1 to ${MAX_SOURCE_LENGTH} characters` };
  }
  // The unit is information only: each metric has one canonical unit, and the server stores that one. Clients
  // write units in their own way ("ms", "enum", "brpm", "ml/kg/min"), so a sample is never rejected for its unit.
  // The range check above still catches a value in the wrong unit.
  void unit;
  return { ok: true, sample: { date, metric, value, unit: spec.unit, source: source.trim() } };
}

/**
 * Validates every sample. When the same (date, metric) comes twice, the last one wins.
 * @param {unknown[]} samples
 * @returns {{ rows: VitalSample[], accepted: number, rejected: Rejection[] }}
 */
export function prepareSamples(samples, today = utcToday()) {
  /** @type {Rejection[]} */
  const rejected = [];
  /** @type {Map<string, VitalSample>} */
  const byKey = new Map();
  samples.forEach((raw, index) => {
    const r = validateSample(raw, today);
    if (!r.ok) return rejected.push({ index, reason: r.reason });
    const key = `${r.sample.date}|${r.sample.metric}`;
    byKey.delete(key); // keep insertion order = last occurrence
    byKey.set(key, r.sample);
  });
  return { rows: [...byKey.values()], accepted: samples.length - rejected.length, rejected };
}

/**
 * Writes already-validated samples: insert or replace on (user_id, date, metric). One statement per 1000 rows.
 * @param {import('@neondatabase/serverless').NeonQueryFunction<false, false>} sql
 * @param {string} userId
 * @param {VitalSample[]} rows
 */
export async function writeSamples(sql, userId, rows) {
  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000);
    await sql`
      INSERT INTO health_samples (user_id, date, metric, value, unit, source, updated_at)
      SELECT ${userId}, d, m, v, u, s, now()
      FROM unnest(${chunk.map((x) => x.date)}::date[], ${chunk.map((x) => x.metric)}::text[],
                  ${chunk.map((x) => x.value)}::float8[], ${chunk.map((x) => x.unit)}::text[],
                  ${chunk.map((x) => x.source)}::text[]) AS t(d, m, v, u, s)
      ON CONFLICT (user_id, date, metric) DO UPDATE
        SET value = EXCLUDED.value, unit = EXCLUDED.unit, source = EXCLUDED.source, updated_at = now()`;
  }
}

/**
 * The reusable ingestion: validates raw samples and upserts the valid ones for `userId`. For server-side jobs
 * (a Garmin sync) and the HTTP route alike. Never throws for a bad sample; database errors propagate.
 * @param {import('@neondatabase/serverless').NeonQueryFunction<false, false>} sql
 * @param {string} userId
 * @param {unknown[]} samples
 * @param {{ today?: string }} [options]
 * @returns {Promise<{ accepted: number, rejected: Rejection[] }>}
 */
export async function upsertVitals(sql, userId, samples, options = {}) {
  const { rows, accepted, rejected } = prepareSamples(samples, options.today);
  await writeSamples(sql, userId, rows);
  return { accepted, rejected };
}

/** Either bearer token: the Lift token (Apple Health from the iPhone) or CRON_SECRET (the Garmin job). */
function authorized(authorization, tokens) {
  // Both checks always run, so the time does not show which token matched.
  const a = isAuthorized(authorization, tokens.lift);
  const b = isAuthorized(authorization, tokens.cron);
  return a || b;
}

/**
 * POST /api/vitals/sync. Body `{ samples: [...] }`, at most MAX_SAMPLES. Invalid samples are rejected one by one
 * with their index; the others are stored.
 * @param {{ authorization: string | null, rawBody: string, tokens: { lift?: string, cron?: string }, today?: string }} req
 * @param {VitalsRepository} repo
 */
export async function handleVitalsPush(req, repo) {
  if (!authorized(req.authorization, req.tokens)) return { status: 401, body: { error: 'unauthorized' } };
  if (Buffer.byteLength(req.rawBody, 'utf8') > MAX_BODY_BYTES) return { status: 413, body: { error: 'body too large' } };
  let body;
  try {
    body = JSON.parse(req.rawBody);
  } catch {
    return { status: 400, body: { error: 'body is not JSON' } };
  }
  const samples = body && typeof body === 'object' ? body.samples : undefined;
  if (!Array.isArray(samples)) return { status: 400, body: { error: 'samples must be an array' } };
  if (samples.length > MAX_SAMPLES) return { status: 400, body: { error: `at most ${MAX_SAMPLES} samples per request` } };

  const { rows, accepted, rejected } = prepareSamples(samples, req.today);
  if (rows.length) {
    const owner = await repo.ownerId();
    if (!owner) return { status: 503, body: { error: 'no Coach user yet' } };
    await repo.upsert(owner, rows);
  }
  return { status: 200, body: { accepted, rejected } };
}

/**
 * GET /api/vitals/sync?since=YYYY-MM-DD. `{ latestDate: { <metric>: "YYYY-MM-DD" | null } }` for every metric, so
 * a client knows where to resume (it re-sends from that day: the last day is often still incomplete).
 * @param {{ authorization: string | null, since: string | null, tokens: { lift?: string, cron?: string } }} req
 * @param {VitalsRepository} repo
 */
export async function handleVitalsLatest(req, repo) {
  if (!authorized(req.authorization, req.tokens)) return { status: 401, body: { error: 'unauthorized' } };
  const since = req.since || null;
  if (since !== null && !isCalendarDate(since)) return { status: 400, body: { error: 'since must be YYYY-MM-DD' } };
  const owner = await repo.ownerId();
  const found = owner ? await repo.latestDates(owner, since) : {};
  const latestDate = Object.fromEntries(METRIC_IDS.map((m) => [m, found[m] ?? null]));
  return { status: 200, body: { latestDate } };
}

/** An in-memory repository for tests. */
export function createMemoryVitalsRepository(owner = 'user_test') {
  /** @type {Map<string, VitalSample & { userId: string }>} */
  const rows = new Map();
  return {
    rows,
    ownerId: async () => owner,
    upsert: async (userId, samples) => {
      for (const s of samples) rows.set(`${userId}|${s.date}|${s.metric}`, { ...s, userId });
    },
    latestDates: async (userId, since) => {
      /** @type {Record<string, string>} */
      const out = {};
      for (const r of rows.values()) {
        if (r.userId !== userId || (since && r.date < since)) continue;
        if (!out[r.metric] || r.date > out[r.metric]) out[r.metric] = r.date;
      }
      return out;
    },
  };
}
