// An in-memory notification and device repository for tests: the same behaviour as repository.ts over Postgres.

let seq = 0;
const nextId = (prefix) => `${prefix}-${++seq}`;

/**
 * @param {{ now?: () => Date }} [options]
 * @returns {import('./notifier.mjs').NotificationRepository & import('./devices.mjs').DeviceRepository & {
 *   devices: Map<string, any>, notifications: Map<string, any>, deliveries: any[], prefs: Map<string, boolean>
 * }}
 */
export function createMemoryNotificationRepository(options = {}) {
  const now = options.now ?? (() => new Date());
  /** @type {Map<string, any>} by id */
  const devices = new Map();
  /** @type {Map<string, any>} by id */
  const notifications = new Map();
  /** @type {any[]} */
  const deliveries = [];
  /** @type {Map<string, boolean>} `${userId}|${category}` */
  const prefs = new Map();

  return {
    devices,
    notifications,
    deliveries,
    prefs,

    async categoryEnabled(userId, category) {
      return prefs.get(`${userId}|${category}`) ?? true;
    },
    async create(userId, event, status) {
      for (const n of notifications.values()) {
        if (n.userId === userId && n.event.idempotencyKey === event.idempotencyKey) return null;
      }
      const n = { id: nextId('n'), userId, event, status, createdAt: now(), openedAt: null };
      notifications.set(n.id, n);
      return { id: n.id, userId, event };
    },
    async activeDevices(userId) {
      return [...devices.values()]
        .filter((d) => d.userId === userId && !d.disabledAt)
        .map((d) => ({ id: d.id, token: d.token, environment: d.environment, topic: d.topic, registeredAt: d.registeredAt }));
    },
    async recordDelivery(record) {
      deliveries.push(record);
    },
    async disableDevice(deviceId, reason) {
      const d = devices.get(deviceId);
      if (d) Object.assign(d, { disabledAt: now(), disabledReason: reason });
    },
    async finish(notificationId, status) {
      const n = notifications.get(notificationId);
      if (n) n.status = status;
    },

    async register(userId, r) {
      for (const d of devices.values()) {
        if (d.userId === userId && d.installId === r.installId && d.token !== r.token && !d.disabledAt) {
          Object.assign(d, { disabledAt: now(), disabledReason: 'replaced' });
        }
      }
      const existing = [...devices.values()].find((d) => d.token === r.token);
      if (existing) {
        Object.assign(existing, { ...r, userId, registeredAt: now(), disabledAt: null, disabledReason: null });
        return { id: existing.id };
      }
      const d = { id: nextId('d'), userId, ...r, registeredAt: now(), disabledAt: null, disabledReason: null };
      devices.set(d.id, d);
      return { id: d.id };
    },
    async unregister(userId, token) {
      const d = [...devices.values()].find((x) => x.userId === userId && x.token === token && !x.disabledAt);
      if (!d) return false;
      Object.assign(d, { disabledAt: now(), disabledReason: 'unregistered' });
      return true;
    },
    async markOpened(userId, notificationId) {
      const n = notifications.get(notificationId);
      if (!n || n.userId !== userId) return false;
      n.openedAt ??= now();
      return true;
    },
    async preferences(userId) {
      const out = {};
      for (const [key, enabled] of prefs) {
        const [u, c] = key.split('|');
        if (u === userId) out[c] = enabled;
      }
      return out;
    },
    async setPreference(userId, category, enabled) {
      prefs.set(`${userId}|${category}`, enabled);
    },
  };
}
