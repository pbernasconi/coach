// Direct APNs (HTTP/2, token-based provider auth) for the Lift iPhone app. Node `http2` and `crypto` only.
//
// - Auth: an ES256 provider JWT signed with the team's `.p8` (`kid` = key id, `iss` = team id), cached and minted
//   again every 50 minutes (Apple rejects a token older than an hour with `ExpiredProviderToken`). A 403 for a
//   provider token mints a new one and sends once more.
// - Host per token, from the environment the build declared when it registered: `sandbox` (an Xcode build) →
//   api.sandbox.push.apple.com, `production` (TestFlight, App Store) → api.push.apple.com. Apple ties a token to the
//   build's signing, not to the server it talks to.
// - `apns-topic`: the bundle id the device registered, else APNS_TOPIC.
// - Outcomes per token (`SendOutcome`):
//     200                       → accepted, with Apple's `apns-id`
//     429, 5xx, network errors  → failed and retryable; never a dead token (an outage keeps every token)
//     410 Unregistered          → dead, so the caller turns the device off; EXCEPT when the device registered again
//                                 after Apple's `timestamp`: then failed, not retryable, and the token stays
//     400 BadDeviceToken        → sent once more on the other host (the error also means "wrong host"); that host's
//                                 answer is the outcome, and a second BadDeviceToken is dead
//     any other rejection       → failed, not retryable, with Apple's `reason` as the code
// - Missing credentials: every send is failed with NO_CREDENTIALS, not retryable; the token stays.

import http2 from 'node:http2';
import { createPrivateKey, sign } from 'node:crypto';

export const APNS_PRODUCTION_HOST = 'https://api.push.apple.com';
export const APNS_SANDBOX_HOST = 'https://api.sandbox.push.apple.com';
/** Apple accepts a provider token for 60 minutes; mint a new one well before. */
export const APNS_JWT_TTL_MS = 50 * 60 * 1000;
/** Device tokens are 32 bytes (64 hex) today; Apple says they may grow. */
export const APNS_TOKEN = /^[0-9a-f]{64,200}$/;

const PROVIDER_TOKEN_REASONS = new Set(['ExpiredProviderToken', 'InvalidProviderToken', 'MissingProviderToken']);
const BAD_DEVICE_TOKEN = 'BadDeviceToken';
/** Apple sends the 410 `timestamp` in epoch milliseconds; anything smaller is not one. */
const MIN_TIMESTAMP_MS = 1_000_000_000_000;

/**
 * @typedef {'sandbox' | 'production'} ApnsEnvironment
 * @typedef {{ keyP8?: string, keyId?: string, teamId?: string, topic?: string }} ApnsConfig
 * @typedef {{ host: string, path: string, headers: Record<string, string>, body: string }} ApnsRequest
 * @typedef {{ status: number, reason?: string, apnsId?: string, timestamp?: number, retryAfter?: string }} ApnsResponse
 *
 * One push to one device.
 * @typedef {object} ApnsMessage
 * @property {string} token  lower-case hex
 * @property {ApnsEnvironment} environment
 * @property {string | null} topic  the bundle id the device registered; null uses the configured topic
 * @property {number | null} registeredAtMs  when the device last registered (the 410 rule)
 * @property {string} title
 * @property {string} body
 * @property {string | null} threadId
 * @property {string | null} collapseId
 * @property {'passive' | 'active' | 'time-sensitive'} interruptionLevel
 * @property {number | null} ttlSeconds
 * @property {Record<string, string>} data  routing hints next to `aps` (the link, the notification id); no content
 *
 * @typedef {{ status: 'accepted', apnsId: string | null }
 *   | { status: 'failed', code: string, retryable: boolean, retryAfterMs?: number, apnsId?: string | null }
 *   | { status: 'dead', code: string, apnsId: string | null }} SendOutcome
 */

const b64url = (buf) => Buffer.from(buf).toString('base64url');

/**
 * The APNs JSON body. Custom keys ride next to `aps`, where iOS hands them to the app.
 * @param {ApnsMessage} m
 */
export function apnsPayload(m) {
  return {
    aps: {
      alert: { title: m.title, body: m.body },
      sound: 'default',
      ...(m.threadId ? { 'thread-id': m.threadId } : {}),
      'interruption-level': m.interruptionLevel,
    },
    ...m.data,
  };
}

/**
 * The request headers. `apns-priority` 5 for a passive notice (the phone may hold it to save power), else 10.
 * @param {ApnsMessage} m
 * @param {string} topic
 * @param {string} jwt
 * @param {number} nowMs
 */
export function apnsHeaders(m, topic, jwt, nowMs) {
  /** @type {Record<string, string>} */
  const headers = {
    authorization: `bearer ${jwt}`,
    'apns-topic': topic,
    'apns-push-type': 'alert',
    'apns-priority': m.interruptionLevel === 'passive' ? '5' : '10',
    'content-type': 'application/json',
  };
  if (m.collapseId) headers['apns-collapse-id'] = m.collapseId;
  if (m.ttlSeconds != null) headers['apns-expiration'] = String(Math.floor(nowMs / 1000) + m.ttlSeconds);
  return headers;
}

/** Apple's error body: `reason`, and on a 410 the `timestamp`. */
export function parseErrorBody(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    const out = {};
    if (typeof parsed.reason === 'string') out.reason = parsed.reason;
    const ts = Number(parsed.timestamp);
    if (Number.isSafeInteger(ts) && ts >= MIN_TIMESTAMP_MS) out.timestamp = ts;
    return out;
  } catch {
    return {};
  }
}

/** A `Retry-After` value (seconds or an HTTP date) in ms from now, capped at an hour; undefined when unreadable. */
export function retryAfterMs(value, nowMs) {
  if (!value) return undefined;
  const seconds = Number(value);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - nowMs;
  return Number.isFinite(ms) && ms >= 0 ? Math.min(ms, 3600_000) : undefined;
}

// ---- The default HTTP/2 layer: one long-lived session per host, opened again after it closes ----

/** @type {Map<string, import('node:http2').ClientHttp2Session>} */
const sessions = new Map();

function session(host) {
  const existing = sessions.get(host);
  if (existing && !existing.closed && !existing.destroyed) return existing;
  const s = http2.connect(host);
  const drop = () => {
    if (sessions.get(host) === s) sessions.delete(host);
  };
  s.on('error', drop);
  s.on('close', drop);
  s.on('goaway', drop);
  // An idle session must not keep a serverless function alive.
  s.unref();
  sessions.set(host, s);
  return s;
}

/**
 * Sends one request over HTTP/2.
 * @param {ApnsRequest} req
 * @returns {Promise<ApnsResponse>}
 */
export function http2Request(req) {
  return new Promise((resolve, reject) => {
    const stream = session(req.host).request({ ':method': 'POST', ':path': req.path, ...req.headers });
    let status = 0;
    let apnsId;
    let retryAfter;
    let settled = false;
    const chunks = [];
    const settle = (fn) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };
    stream.on('response', (h) => {
      status = Number(h[':status'] ?? 0);
      apnsId = typeof h['apns-id'] === 'string' ? h['apns-id'] : undefined;
      retryAfter = typeof h['retry-after'] === 'string' ? h['retry-after'] : undefined;
    });
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => settle(() => resolve({ status, apnsId, retryAfter, ...parseErrorBody(Buffer.concat(chunks).toString('utf8')) })));
    stream.on('error', (e) => settle(() => reject(e)));
    // A cancelled or reset stream closes without 'end': never leave the send hanging.
    stream.on('close', () => settle(() => reject(new Error(`APNs stream closed before a response (${stream.rstCode})`))));
    stream.setTimeout(15_000, () => stream.close(http2.constants.NGHTTP2_CANCEL));
    stream.end(req.body);
  });
}

const hostFor = (env) => (env === 'production' ? APNS_PRODUCTION_HOST : APNS_SANDBOX_HOST);
const otherEnv = (env) => (env === 'production' ? 'sandbox' : 'production');

/**
 * The outcome of one APNs response.
 * @param {ApnsMessage} m
 * @param {ApnsResponse} r
 * @param {number} nowMs
 * @returns {SendOutcome}
 */
export function outcomeFor(m, r, nowMs) {
  const apnsId = r.apnsId ?? null;
  if (r.status === 200) return { status: 'accepted', apnsId };
  const code = r.reason ?? `HTTP_${r.status}`;
  if (r.status === 429 || r.status >= 500) {
    const wait = r.status === 429 || r.status === 503 ? retryAfterMs(r.retryAfter, nowMs) : undefined;
    return { status: 'failed', code, retryable: true, apnsId, ...(wait !== undefined ? { retryAfterMs: wait } : {}) };
  }
  if (r.status === 410 || r.reason === 'Unregistered' || r.reason === BAD_DEVICE_TOKEN) {
    // The device registered again after Apple's check: Apple's answer is about an earlier install state.
    const registeredAgain = r.status === 410 && r.timestamp !== undefined && m.registeredAtMs != null && m.registeredAtMs > r.timestamp;
    return registeredAgain ? { status: 'failed', code, retryable: false, apnsId } : { status: 'dead', code, apnsId };
  }
  return { status: 'failed', code, retryable: false, apnsId };
}

/**
 * The APNs transport.
 * @param {{ config: () => ApnsConfig, request?: (req: ApnsRequest) => Promise<ApnsResponse>, now?: () => number }} deps
 */
export function createApnsTransport(deps) {
  const request = deps.request ?? http2Request;
  const now = deps.now ?? (() => Date.now());
  /** @type {{ token: string, issuedAtMs: number, keyId: string } | null} */
  let jwtCache = null;

  /** @param {ApnsConfig} c */
  function providerJwt(c) {
    if (jwtCache && jwtCache.keyId === c.keyId && now() - jwtCache.issuedAtMs < APNS_JWT_TTL_MS) return jwtCache.token;
    // A .p8 is PKCS8 PEM; an env var may hold it on one line with `\n` written out.
    const key = createPrivateKey(String(c.keyP8).replace(/\\n/g, '\n'));
    const issuedAtMs = now();
    const input = `${b64url(JSON.stringify({ alg: 'ES256', kid: c.keyId }))}.${b64url(JSON.stringify({ iss: c.teamId, iat: Math.floor(issuedAtMs / 1000) }))}`;
    const signature = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
    jwtCache = { token: `${input}.${b64url(signature)}`, issuedAtMs, keyId: String(c.keyId) };
    return jwtCache.token;
  }

  /**
   * @param {ApnsConfig} c
   * @param {ApnsMessage} m
   * @returns {Promise<SendOutcome>}
   */
  async function sendOne(c, m) {
    const topic = m.topic || c.topic;
    if (!topic) return { status: 'failed', code: 'NO_TOPIC', retryable: false };
    const body = JSON.stringify(apnsPayload(m));
    const sendTo = async (env) => {
      const attempt = () =>
        request({ host: hostFor(env), path: `/3/device/${m.token}`, headers: apnsHeaders(m, topic, providerJwt(c), now()), body });
      let r = await attempt();
      if (r.status === 403 && r.reason && PROVIDER_TOKEN_REASONS.has(r.reason)) {
        jwtCache = null;
        r = await attempt();
      }
      return r;
    };
    const first = await sendTo(m.environment);
    if (!(first.status === 400 && first.reason === BAD_DEVICE_TOKEN)) return outcomeFor(m, first, now());
    // BadDeviceToken also means "sent to the wrong host": the other host's answer decides.
    return outcomeFor(m, await sendTo(otherEnv(m.environment)), now());
  }

  return {
    /**
     * Sends each message; one outcome per message, in order. Never throws.
     * @param {ApnsMessage[]} messages
     * @returns {Promise<SendOutcome[]>}
     */
    async send(messages) {
      const c = deps.config();
      if (!c.keyP8 || !c.keyId || !c.teamId) {
        return messages.map(() => /** @type {SendOutcome} */ ({ status: 'failed', code: 'NO_CREDENTIALS', retryable: false }));
      }
      return Promise.all(
        messages.map(async (m) => {
          try {
            return await sendOne(c, m);
          } catch (error) {
            // A key that does not import never will; anything else (network, timeout, a reset stream) may pass later.
            const bad = error instanceof Error && /key|PEM|asn1|decoder/i.test(error.message);
            return /** @type {SendOutcome} */ ({ status: 'failed', code: bad ? 'CREDENTIALS_INVALID' : 'TRANSPORT_ERROR', retryable: !bad });
          }
        })
      );
    },
  };
}

/** The transport over the environment: APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID, APNS_TOPIC. */
export const apnsFromEnv = (env = process.env) =>
  createApnsTransport({
    config: () => ({ keyP8: env.APNS_KEY_P8, keyId: env.APNS_KEY_ID, teamId: env.APNS_TEAM_ID, topic: env.APNS_TOPIC }),
  });
