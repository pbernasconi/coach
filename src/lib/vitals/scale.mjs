// @ts-check
// The bathroom scale bridge (devices/scale-bridge): it posts weight_kg with this source, so Coach can tell its
// weigh-ins from Garmin's and notice when the bridge goes quiet.

import { toIso } from '../db-time.mjs';

export const SCALE_SOURCE = 'Renpho Elis 1 (scale bridge)';

const DAY = 864e5;

/**
 * A warning when the scale bridge has sent weigh-ins before but none for a while. Nothing before its first
 * weigh-in. Info (Settings only) from 4 days, a banner from 10: a travel week is normal, a dead board is not.
 * @param {string | null} lastDay newest weigh-in day from the bridge (YYYY-MM-DD), or null
 * @param {string} today the local day (YYYY-MM-DD)
 * @returns {{ level: 'warn' | 'info', text: string } | null}
 */
export function scaleWarning(lastDay, today) {
  if (!lastDay) return null;
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastDay}T00:00:00Z`)) / DAY);
  if (!(days >= 4)) return null;
  const text = `No weigh-in from the bathroom scale for ${days} days. If you have been home, check the bridge at http://scale-bridge.local/.`;
  return { level: days >= 10 ? 'warn' : 'info', text };
}

// ---- the bridge's heartbeat (POST /api/vitals/sync/bridge, stored in users.settings.scaleBridge) ----------------

const RESULTS = new Set(['reading', 'no-reading', 'connect-failed', 'no-service']);
const MAX_LOG_LINES = 40;

/** @param {unknown} v @param {number} max */
const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : null);
/** @param {unknown} v @param {number} min @param {number} max */
const int = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : null);
/** @param {unknown} v unix seconds */
const unixIso = (v) => {
  const n = int(v, 1_600_000_000, 4_000_000_000);
  return n === null ? null : toIso(n * 1000);
};

/**
 * @typedef {{
 *   receivedAt: string, firmware: string | null, uptimeS: number | null, bootCount: number | null,
 *   resetReason: string | null, rssi: number | null, ip: string | null, scaleMac: string | null, pending: number | null,
 *   lastSession: { at: string | null, result: string | null, log: string[] } | null,
 *   lastPost: { at: string | null, code: number | null } | null,
 * }} BridgeHeartbeat
 */

/**
 * A clean heartbeat from the bridge's JSON: every field checked and capped, unknown fields dropped.
 * @param {unknown} body @param {Date} now
 * @returns {BridgeHeartbeat | null} null when the body is not an object
 */
export function heartbeatFrom(body, now) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = /** @type {Record<string, any>} */ (body);
  const s = b.lastSession && typeof b.lastSession === 'object' ? b.lastSession : null;
  const p = b.lastPost && typeof b.lastPost === 'object' ? b.lastPost : null;
  return {
    receivedAt: now.toISOString(),
    firmware: text(b.firmware, 40),
    uptimeS: int(b.uptimeS, 0, 10 * 365 * 86400),
    bootCount: int(b.bootCount, 0, 1e9),
    resetReason: text(b.resetReason, 40),
    rssi: int(b.rssi, -127, 0),
    ip: text(b.ip, 45),
    scaleMac: text(b.scaleMac, 17),
    pending: int(b.pending, 0, 1000),
    lastSession: s
      ? {
          at: unixIso(s.at),
          result: typeof s.result === 'string' && RESULTS.has(s.result) ? s.result : null,
          log: Array.isArray(s.log) ? s.log.filter((/** @type {unknown} */ l) => typeof l === 'string').slice(-MAX_LOG_LINES).map((/** @type {string} */ l) => l.slice(0, 200)) : [],
        }
      : null,
    lastPost: p ? { at: unixIso(p.at), code: int(p.code, -100, 999) } : null,
  };
}

const HOUR = 36e5;

/**
 * A warning when the bridge stops reporting. It reports every 15 minutes, so 2 hours without one means it is
 * unplugged or off Wi-Fi (info, Settings only); a day is a banner. Nothing before its first report.
 * @param {{ receivedAt: string } | null} heartbeat @param {number} now ms
 * @returns {{ level: 'warn' | 'info', text: string } | null}
 */
export function bridgeWarning(heartbeat, now) {
  if (!heartbeat?.receivedAt) return null;
  const hours = (now - Date.parse(heartbeat.receivedAt)) / HOUR;
  if (!(hours >= 2)) return null;
  const since = hours >= 48 ? `${Math.round(hours / 24)} days` : `${Math.round(hours)} hours`;
  const text = `The scale bridge has not reported for ${since}. Check that it is plugged in and on Wi-Fi (http://scale-bridge.local/).`;
  return { level: hours >= 24 ? 'warn' : 'info', text };
}
