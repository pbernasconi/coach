// The send pipeline: one call, `notify(type, payload, { userId })`, from any trigger (a Lift sync push, the Strava
// webhook, the scale's vitals push, a test from Settings). It is transport-agnostic and written against a small
// repository interface, so it runs the same over Postgres (repository.ts) and in memory (memory-repository.mjs).
//
//   1. Bind: parse the payload with the event's schema and build the text and link (catalog.mjs). A bad payload is a
//      bug in the trigger: it is logged and nothing is stored.
//   2. Mute: a category switched off in Settings stores the notice as `muted` and sends nothing.
//   3. Once: the notice is stored under its idempotency key. A key already stored means a retried trigger, and
//      nothing is sent again.
//   4. Send: one APNs message per active device. A retryable failure (an APNs outage, a network error) is sent again
//      after a short wait, at most MAX_ATTEMPTS times in all. A dead token turns its device off.
//   5. Record: one delivery row per device, and the notice's status: `sent` (every device took it), `partial`,
//      `failed`, or `no_devices`.
//
// Never throws for a delivery problem: a trigger's own work (the sync, the webhook) must not fail because a push did.

import { bindEvent, CATEGORIES } from './catalog.mjs';

export const MAX_ATTEMPTS = 3;
/** The wait before attempt 2 and 3, unless APNs named a longer one (capped at MAX_WAIT_MS). */
export const RETRY_WAITS_MS = [1000, 4000];
const MAX_WAIT_MS = 10_000;

/**
 * @typedef {import('./events/define.mjs').BoundEvent} BoundEvent
 * @typedef {import('./events/define.mjs').NotificationCategory} NotificationCategory
 * @typedef {import('./apns.mjs').SendOutcome} SendOutcome
 * @typedef {import('./apns.mjs').ApnsMessage} ApnsMessage
 *
 * @typedef {object} Device
 * @property {string} id
 * @property {string} token
 * @property {'sandbox' | 'production'} environment
 * @property {string | null} topic
 * @property {Date | null} registeredAt
 *
 * @typedef {'pending' | 'sent' | 'partial' | 'failed' | 'no_devices' | 'muted'} NotificationStatus
 *
 * @typedef {object} StoredNotification
 * @property {string} id
 * @property {string} userId
 * @property {BoundEvent} event
 *
 * @typedef {object} DeliveryRecord
 * @property {string} notificationId
 * @property {string} deviceId
 * @property {'accepted' | 'failed' | 'dead'} status
 * @property {string | null} code
 * @property {string | null} apnsId
 * @property {number} attempts
 *
 * @typedef {object} NotificationRepository
 * @property {(userId: string, category: NotificationCategory) => Promise<boolean>} categoryEnabled
 * @property {(userId: string, event: BoundEvent, status: NotificationStatus) => Promise<StoredNotification | null>} create
 *   stores the notice; null when its idempotency key is already stored for the user
 * @property {(userId: string) => Promise<Device[]>} activeDevices
 * @property {(record: DeliveryRecord) => Promise<void>} recordDelivery
 * @property {(deviceId: string, reason: string) => Promise<void>} disableDevice
 * @property {(notificationId: string, status: NotificationStatus) => Promise<void>} finish
 *
 * @typedef {{ send: (messages: ApnsMessage[]) => Promise<SendOutcome[]> }} PushTransport
 *
 * @typedef {{ status: 'invalid', error: string }
 *   | { status: 'duplicate' }
 *   | { status: NotificationStatus, notificationId: string, accepted: number, devices: number }} NotifyResult
 */

/**
 * The APNs message for one device. The data keys are routing hints only: the link a tap opens, the notice id the
 * app reports as opened, and the type. Never the content (it is in `aps.alert`).
 * @param {StoredNotification} n
 * @param {Device} d
 * @returns {ApnsMessage}
 */
export function messageFor(n, d) {
  const e = n.event;
  return {
    token: d.token,
    environment: d.environment,
    topic: d.topic,
    registeredAtMs: d.registeredAt ? d.registeredAt.getTime() : null,
    title: e.title,
    body: e.body,
    threadId: e.threadKey,
    collapseId: e.collapseKey,
    interruptionLevel: e.interruptionLevel,
    ttlSeconds: e.ttlSeconds,
    data: { link: e.link, notificationId: n.id, type: e.type },
  };
}

/** The notice's status from its deliveries. */
export function statusOf(outcomes) {
  if (outcomes.length === 0) return 'no_devices';
  const accepted = outcomes.filter((o) => o.status === 'accepted').length;
  return accepted === outcomes.length ? 'sent' : accepted > 0 ? 'partial' : 'failed';
}

/**
 * @param {{
 *   repo: NotificationRepository,
 *   transport: PushTransport,
 *   origin: string,
 *   sleep?: (ms: number) => Promise<void>,
 *   log?: { warn: (...a: unknown[]) => void, error: (...a: unknown[]) => void },
 * }} deps
 */
export function createNotifier(deps) {
  const { repo, transport, origin } = deps;
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const log = deps.log ?? console;

  /**
   * Sends one stored notice to every active device and records the result.
   * @param {StoredNotification} n
   */
  async function deliver(n) {
    const devices = await repo.activeDevices(n.userId);
    /** @type {Map<string, { outcome: SendOutcome, attempts: number }>} */
    const results = new Map();
    let pending = devices;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.length; attempt++) {
      if (attempt > 1) {
        const asked = Math.max(0, ...pending.map((d) => results.get(d.id)?.outcome).map((o) => (o?.status === 'failed' && o.retryAfterMs) || 0));
        await sleep(Math.min(MAX_WAIT_MS, Math.max(RETRY_WAITS_MS[attempt - 2] ?? 0, asked)));
      }
      const outcomes = await transport.send(pending.map((d) => messageFor(n, d)));
      pending.forEach((d, i) => results.set(d.id, { outcome: outcomes[i], attempts: attempt }));
      pending = pending.filter((d) => {
        const o = results.get(d.id)?.outcome;
        return o?.status === 'failed' && o.retryable;
      });
    }
    for (const d of devices) {
      const r = results.get(d.id);
      if (!r) continue;
      const o = r.outcome;
      await repo.recordDelivery({
        notificationId: n.id,
        deviceId: d.id,
        status: o.status,
        code: o.status === 'accepted' ? null : o.code,
        apnsId: o.apnsId ?? null,
        attempts: r.attempts,
      });
      if (o.status === 'dead') await repo.disableDevice(d.id, o.code);
      // Codes only: the text is health data and never goes to the logs.
      if (o.status !== 'accepted') log.warn(`Push ${n.event.type} to device ${d.id} ${o.status}: ${o.code}`);
    }
    const outcomes = [...results.values()].map((r) => r.outcome);
    const status = statusOf(outcomes);
    await repo.finish(n.id, status);
    return { status, accepted: outcomes.filter((o) => o.status === 'accepted').length, devices: devices.length };
  }

  return {
    /**
     * Sends the notice `type` with `payload` to the user's devices, once per idempotency key.
     * @param {string} type
     * @param {unknown} payload
     * @param {{ userId: string, replay?: string }} target  `replay` sends a notice again as a test: its idempotency
     *   key gets the replay id, so it neither counts as the original nor blocks it
     * @returns {Promise<NotifyResult>}
     */
    async notify(type, payload, { userId, replay }) {
      const bound = bindEvent(type, payload, { origin });
      if (!bound.ok) {
        log.error(`Notification ${type} not sent: ${bound.error}`);
        return { status: 'invalid', error: bound.error };
      }
      const event = replay ? { ...bound.event, idempotencyKey: `${bound.event.idempotencyKey}:replay:${replay}` } : bound.event;
      const mandatory = CATEGORIES[event.category].mandatory;
      const enabled = mandatory || (await repo.categoryEnabled(userId, event.category));
      const stored = await repo.create(userId, event, enabled ? 'pending' : 'muted');
      if (!stored) return { status: 'duplicate' };
      if (!enabled) return { status: 'muted', notificationId: stored.id, accepted: 0, devices: 0 };
      try {
        return { notificationId: stored.id, ...(await deliver(stored)) };
      } catch (error) {
        log.error(`Notification ${type} delivery failed:`, error instanceof Error ? error.message : 'unknown error');
        await repo.finish(stored.id, 'failed').catch(() => {});
        return { status: 'failed', notificationId: stored.id, accepted: 0, devices: 0 };
      }
    },
  };
}
