import { sql } from '@/db';
import { toDate, toIso } from '@/lib/db-time.mjs';
import type { DeviceRepository } from './devices.mjs';
import type { NotificationRepository } from './notifier.mjs';

type Row = Record<string, unknown>;

/** The notification tables in Postgres (src/db/notifications-schema.ts). Same behaviour as memory-repository.mjs. */
export const neonNotificationRepository: NotificationRepository & DeviceRepository = {
  async categoryEnabled(userId, category) {
    const [r] = (await sql`
      SELECT enabled FROM notification_preferences WHERE user_id = ${userId} AND category = ${category}`) as Row[];
    return r ? Boolean(r.enabled) : true;
  },

  async create(userId, event, status) {
    const [r] = (await sql`
      INSERT INTO notifications (user_id, type, category, idempotency_key, payload, title, body, link, status, finished_at)
      VALUES (${userId}, ${event.type}, ${event.category}, ${event.idempotencyKey}, ${JSON.stringify(event.payload)}::jsonb,
              ${event.title}, ${event.body}, ${event.link}, ${status}, CASE WHEN ${status} = 'pending' THEN NULL ELSE now() END)
      ON CONFLICT (user_id, idempotency_key) DO NOTHING
      RETURNING id`) as Row[];
    return r ? { id: String(r.id), userId, event } : null;
  },

  async activeDevices(userId) {
    const rows = (await sql`
      SELECT id, token, environment, topic, registered_at FROM push_devices
      WHERE user_id = ${userId} AND disabled_at IS NULL
      ORDER BY registered_at DESC`) as Row[];
    return rows.map((r) => ({
      id: String(r.id),
      token: String(r.token),
      environment: r.environment === 'sandbox' ? 'sandbox' : 'production',
      topic: r.topic == null ? null : String(r.topic),
      registeredAt: toDate(r.registered_at),
    }));
  },

  async recordDelivery(d) {
    await sql`
      INSERT INTO notification_deliveries (notification_id, device_id, status, code, apns_id, attempts)
      VALUES (${d.notificationId}, ${d.deviceId}, ${d.status}, ${d.code}, ${d.apnsId}, ${d.attempts})
      ON CONFLICT (notification_id, device_id) DO UPDATE
        SET status = EXCLUDED.status, code = EXCLUDED.code, apns_id = EXCLUDED.apns_id, attempts = EXCLUDED.attempts`;
  },

  async disableDevice(deviceId, reason) {
    await sql`UPDATE push_devices SET disabled_at = now(), disabled_reason = ${reason} WHERE id = ${deviceId} AND disabled_at IS NULL`;
  },

  async finish(notificationId, status) {
    await sql`UPDATE notifications SET status = ${status}, finished_at = now() WHERE id = ${notificationId}`;
  },

  async register(userId, r) {
    await sql`
      UPDATE push_devices SET disabled_at = now(), disabled_reason = 'replaced'
      WHERE user_id = ${userId} AND install_id = ${r.installId} AND token <> ${r.token} AND disabled_at IS NULL`;
    const [row] = (await sql`
      INSERT INTO push_devices (user_id, token, environment, topic, install_id, app_version, device_name, notifications_authorized)
      VALUES (${userId}, ${r.token}, ${r.environment}, ${r.topic}, ${r.installId}, ${r.appVersion}, ${r.deviceName}, ${r.notificationsAuthorized})
      ON CONFLICT (token) DO UPDATE SET
        user_id = EXCLUDED.user_id, environment = EXCLUDED.environment, topic = EXCLUDED.topic, install_id = EXCLUDED.install_id,
        app_version = EXCLUDED.app_version, device_name = EXCLUDED.device_name,
        notifications_authorized = EXCLUDED.notifications_authorized,
        registered_at = now(), disabled_at = NULL, disabled_reason = NULL
      RETURNING id`) as Row[];
    return { id: String(row.id) };
  },

  async unregister(userId, token) {
    const rows = (await sql`
      UPDATE push_devices SET disabled_at = now(), disabled_reason = 'unregistered'
      WHERE user_id = ${userId} AND token = ${token} AND disabled_at IS NULL
      RETURNING id`) as Row[];
    return rows.length > 0;
  },

  async markOpened(userId, notificationId) {
    const rows = (await sql`
      UPDATE notifications SET opened_at = COALESCE(opened_at, now())
      WHERE id = ${notificationId}::uuid AND user_id = ${userId}
      RETURNING id`) as Row[];
    return rows.length > 0;
  },

  async preferences(userId) {
    const rows = (await sql`SELECT category, enabled FROM notification_preferences WHERE user_id = ${userId}`) as Row[];
    return Object.fromEntries(rows.map((r) => [String(r.category), Boolean(r.enabled)]));
  },

  async setPreference(userId, category, enabled) {
    await sql`
      INSERT INTO notification_preferences (user_id, category, enabled) VALUES (${userId}, ${category}, ${enabled})
      ON CONFLICT (user_id, category) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()`;
  },
};

/** The owner's devices and last notices, for Settings. */
export async function loadPushOverview(userId: string) {
  const [devices, recent] = await Promise.all([
    sql`
      SELECT id, device_name, app_version, environment, notifications_authorized, registered_at, disabled_at, disabled_reason
      FROM push_devices WHERE user_id = ${userId} ORDER BY disabled_at IS NOT NULL, registered_at DESC LIMIT 10` as Promise<Row[]>,
    sql`
      SELECT n.id, n.type, n.title, n.body, n.status, n.created_at, n.opened_at,
             (SELECT string_agg(DISTINCT d.code, ', ') FROM notification_deliveries d WHERE d.notification_id = n.id AND d.code IS NOT NULL) AS codes
      FROM notifications n WHERE n.user_id = ${userId} ORDER BY n.created_at DESC LIMIT 8` as Promise<Row[]>,
  ]);
  const iso = toIso;
  return {
    devices: devices.map((d) => ({
      id: String(d.id),
      name: d.device_name ? String(d.device_name) : 'iPhone',
      appVersion: d.app_version ? String(d.app_version) : null,
      environment: String(d.environment),
      authorized: Boolean(d.notifications_authorized),
      registeredAt: iso(d.registered_at),
      disabledAt: iso(d.disabled_at),
      disabledReason: d.disabled_reason ? String(d.disabled_reason) : null,
    })),
    recent: recent.map((n) => ({
      id: String(n.id),
      type: String(n.type),
      title: String(n.title),
      body: String(n.body),
      status: String(n.status),
      createdAt: iso(n.created_at)!,
      openedAt: iso(n.opened_at),
      codes: n.codes ? String(n.codes) : null,
    })),
  };
}
export type PushOverview = Awaited<ReturnType<typeof loadPushOverview>>;
