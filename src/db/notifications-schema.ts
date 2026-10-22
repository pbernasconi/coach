import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Push notifications (src/lib/notifications, lift/PUSH.md).
 *
 * `push_devices`: one row per APNs device token the Lift app registered. A token belongs to one install; a new token
 * from the same install turns the old row off (`disabled_reason` 'replaced'). APNs saying a token is dead turns its
 * row off too. Rows are never deleted, so a delivery keeps its device.
 */
export const pushDevices = pgTable(
  'push_devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    token: text('token').notNull(),
    platform: text('platform').notNull().default('ios'),
    /** Which APNs host the token belongs to: the build's signing decides (sandbox for Xcode, production otherwise). */
    environment: text('environment').$type<'sandbox' | 'production'>().notNull(),
    /** The app's bundle id, sent as `apns-topic`. */
    topic: text('topic').notNull(),
    installId: text('install_id').notNull(),
    appVersion: text('app_version'),
    deviceName: text('device_name'),
    /** False when the person turned Lift's notifications off in iOS Settings: APNs still takes the push, iOS hides it. */
    notificationsAuthorized: boolean('notifications_authorized').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    registeredAt: timestamp('registered_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    disabledAt: timestamp('disabled_at', { withTimezone: true, mode: 'date' }),
    disabledReason: text('disabled_reason'),
  },
  (t) => [
    uniqueIndex('push_devices_token_uq').on(t.token),
    index('push_devices_user_idx').on(t.userId),
    check('push_devices_environment_check', sql`${t.environment} IN ('sandbox', 'production')`),
  ]
);

/**
 * `notifications`: one row per notice Coach decided to send, stored before it is sent. `idempotency_key` makes a
 * retried trigger (a webhook sent twice, a sync pushed again) send once. `payload` is the event's parsed payload;
 * `title`, `body` and `link` are what the phone showed.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    type: text('type').notNull(),
    category: text('category').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    link: text('link').notNull(),
    status: text('status').$type<'pending' | 'sent' | 'partial' | 'failed' | 'no_devices' | 'muted'>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'date' }),
    /** The first time a tap on it opened Lift. */
    openedAt: timestamp('opened_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    uniqueIndex('notifications_user_key_uq').on(t.userId, t.idempotencyKey),
    index('notifications_user_created_idx').on(t.userId, t.createdAt),
    check('notifications_status_check', sql`${t.status} IN ('pending', 'sent', 'partial', 'failed', 'no_devices', 'muted')`),
  ]
);

/** `notification_deliveries`: what APNs answered for one notice and one device. */
export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    notificationId: uuid('notification_id').notNull().references(() => notifications.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id').notNull().references(() => pushDevices.id, { onDelete: 'cascade' }),
    status: text('status').$type<'accepted' | 'failed' | 'dead'>().notNull(),
    /** APNs' `reason` ("Unregistered", "BadDeviceToken"), or ours ("NO_CREDENTIALS", "TRANSPORT_ERROR"). */
    code: text('code'),
    apnsId: text('apns_id'),
    attempts: integer('attempts').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'notification_deliveries_pk', columns: [t.notificationId, t.deviceId] }),
    check('notification_deliveries_status_check', sql`${t.status} IN ('accepted', 'failed', 'dead')`),
  ]
);

/** `notification_preferences`: a category switched in Settings. No row means on. */
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    userId: text('user_id').notNull(),
    category: text('category').notNull(),
    enabled: boolean('enabled').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: 'notification_preferences_pk', columns: [t.userId, t.category] })]
);
