// The shape of one notification event and `defineEvent`, which binds its builders to a parsed payload.
//
// Each domain file (workout-events.mjs, body-events.mjs, system-events.mjs) defines its events with `defineEvent`,
// and catalog.mjs merges them into NOTIFICATION_EVENTS. An event names everything about its notice: the payload it
// takes (a zod schema), the key that makes a retried trigger send once, the text, where a tap lands (a typed
// destination, never a URL), and how the phone groups and replaces it. The send pipeline (notifier.mjs) reads only
// the bound result, so adding an event never touches delivery.

import { appLink, webLink } from '../destinations.mjs';

/**
 * The preference an event belongs to. `system` events (a test push) are never muted.
 * @typedef {'workouts' | 'body' | 'system'} NotificationCategory
 */

/**
 * APNs `aps.interruption-level`: `passive` waits quietly (priority 5), `active` is a normal notice, `time-sensitive`
 * breaks through a Focus when the app has that entitlement (Lift does not, so iOS shows it as `active`). Never
 * `critical`.
 * @typedef {'passive' | 'active' | 'time-sensitive'} InterruptionLevel
 */

/**
 * @template P
 * @typedef {object} EventDef
 * @property {NotificationCategory} category
 * @property {import('zod').ZodType<P>} payload  what a trigger must pass; parsed before anything is stored
 * @property {(p: P) => string} idempotencyKey  a retried trigger makes the same key; a new real event a new key
 * @property {(p: P) => string} title
 * @property {(p: P) => string} body
 * @property {(p: P) => import('../destinations.mjs').Destination} destination  where a tap lands
 * @property {(p: P) => string} collapseKey  the same key replaces the notice on the phone (`apns-collapse-id`)
 * @property {(p: P) => string} threadKey  groups notices on the phone (`aps.thread-id`)
 * @property {InterruptionLevel} interruptionLevel
 * @property {number} ttlSeconds  how long APNs holds the notice for a phone that is off
 */

/**
 * One event bound to its payload: what the pipeline stores and sends.
 * @typedef {object} BoundEvent
 * @property {string} type
 * @property {NotificationCategory} category
 * @property {Record<string, unknown>} payload  the parsed payload, as JSON (what the row stores)
 * @property {string} idempotencyKey
 * @property {string} title
 * @property {string} body
 * @property {string} link  the Lift app link a tap opens
 * @property {string} webUrl  the same place on the web app
 * @property {string} collapseKey
 * @property {string} threadKey
 * @property {InterruptionLevel} interruptionLevel
 * @property {number} ttlSeconds
 */

/** APNs refuses an `apns-collapse-id` over 64 bytes. */
const MAX_COLLAPSE_BYTES = 64;
/** Apple shows about two lines; longer text is cut on the lock screen anyway. */
const MAX_TITLE = 120;
const MAX_BODY = 400;

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** A collapse or thread key APNs takes: at most 64 bytes. */
export function apnsKey(key) {
  let k = key;
  while (Buffer.byteLength(k, 'utf8') > MAX_COLLAPSE_BYTES) k = k.slice(0, -1);
  return k;
}

/**
 * Types an event's builders against its payload, and adds `bind`.
 * @template P
 * @param {EventDef<P>} def
 */
export function defineEvent(def) {
  return {
    ...def,
    /**
     * Parses `raw` and runs every builder on it.
     * @param {string} type
     * @param {unknown} raw
     * @param {{ origin: string }} options
     * @returns {{ ok: true, event: BoundEvent } | { ok: false, error: string }}
     */
    bind(type, raw, { origin }) {
      const parsed = def.payload.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return { ok: false, error: `${issue?.path.join('.') || 'payload'}: ${issue?.message ?? 'invalid'}` };
      }
      const p = parsed.data;
      const destination = def.destination(p);
      return {
        ok: true,
        event: {
          type,
          category: def.category,
          payload: JSON.parse(JSON.stringify(p)),
          idempotencyKey: def.idempotencyKey(p),
          title: clip(def.title(p), MAX_TITLE),
          body: clip(def.body(p), MAX_BODY),
          link: appLink(destination),
          webUrl: webLink(destination, origin),
          collapseKey: apnsKey(def.collapseKey(p)),
          threadKey: apnsKey(def.threadKey(p)),
          interruptionLevel: def.interruptionLevel,
          ttlSeconds: def.ttlSeconds,
        },
      };
    },
  };
}

export const HOUR_SECONDS = 3600;
export const DAY_SECONDS = 24 * HOUR_SECONDS;
