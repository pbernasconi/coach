// The phone's side of push (lift/PUSH.md): register a device token, report a tapped notice, read and change the
// switches. Transport-agnostic like the Lift sync handlers: a route passes in the parsed body and the owner, and
// sends back `{ status, body }`. The bearer token check stays in the route (appRoute).

import { z } from 'zod';
import { APNS_TOKEN } from './apns.mjs';
import { CATEGORIES } from './catalog.mjs';

/**
 * @typedef {import('./events/define.mjs').NotificationCategory} NotificationCategory
 *
 * @typedef {object} DeviceRegistration
 * @property {string} token  lower-case hex
 * @property {'sandbox' | 'production'} environment
 * @property {string} topic  the app's bundle id
 * @property {string} installId  the install's own id, so a new token replaces the install's old one
 * @property {string | null} appVersion
 * @property {string | null} deviceName
 * @property {boolean} notificationsAuthorized
 *
 * @typedef {object} DeviceRepository
 * @property {(userId: string, registration: DeviceRegistration) => Promise<{ id: string }>} register
 *   insert or refresh by token; turns on a device that was off; turns off the install's other tokens
 * @property {(userId: string, token: string) => Promise<boolean>} unregister
 * @property {(userId: string, notificationId: string) => Promise<boolean>} markOpened
 * @property {(userId: string) => Promise<Partial<Record<NotificationCategory, boolean>>>} preferences
 * @property {(userId: string, category: NotificationCategory, enabled: boolean) => Promise<void>} setPreference
 */

const BUNDLE_ID = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const ID = /^[0-9A-Za-z-]{1,64}$/;

export const registrationSchema = z.object({
  token: z
    .string()
    .trim()
    .transform((t) => t.toLowerCase())
    .pipe(z.string().regex(APNS_TOKEN, 'token must be the APNs device token as hex')),
  environment: z.enum(['sandbox', 'production']),
  topic: z.string().regex(BUNDLE_ID, 'topic must be a bundle id').max(155),
  installId: z.string().regex(ID, 'installId must be an id'),
  appVersion: z.string().trim().max(40).nullable().default(null),
  deviceName: z.string().trim().max(100).nullable().default(null),
  notificationsAuthorized: z.boolean(),
});

const tokenSchema = z.object({ token: z.string().trim().transform((t) => t.toLowerCase()).pipe(z.string().regex(APNS_TOKEN)) });
const openedSchema = z.object({ notificationId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'notificationId must be a UUID') });
const preferencesSchema = z.object({
  categories: z.record(z.string(), z.boolean()),
});

const firstIssue = (error) => {
  const i = error.issues[0];
  return `${i?.path.join('.') || 'body'}: ${i?.message ?? 'invalid'}`;
};

/** Every switchable category with its state: on unless switched off. */
export function preferenceView(stored) {
  return Object.entries(CATEGORIES)
    .filter(([, c]) => !c.mandatory)
    .map(([id, c]) => ({ id, label: c.label, description: c.description, enabled: stored[id] ?? true }));
}

/**
 * POST /api/app/push/devices.
 * @param {unknown} body
 * @param {string} userId
 * @param {DeviceRepository} repo
 * @param {{ appTopic?: string }} [options]  appTopic: the one bundle id the APNs key pushes to (APNS_TOPIC)
 */
export async function handleRegister(body, userId, repo, { appTopic } = {}) {
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { error: firstIssue(parsed.error) } };
  // A build with another bundle id (a Simulator or Xcode debug build, com.example.lift) can never get a push from this
  // key: APNs answers TopicDisallowed. Refuse it here, so it is not stored as a device that every notice fails on.
  if (appTopic && parsed.data.topic !== appTopic) {
    return { status: 422, body: { error: `topic: ${parsed.data.topic} is not this app's bundle id` } };
  }
  const { id } = await repo.register(userId, parsed.data);
  return { status: 200, body: { deviceId: id } };
}

/**
 * DELETE /api/app/push/devices: the phone turned notifications off for Coach, or disconnected sync.
 * @param {unknown} body
 * @param {string} userId
 * @param {DeviceRepository} repo
 */
export async function handleUnregister(body, userId, repo) {
  const parsed = tokenSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { error: firstIssue(parsed.error) } };
  return { status: 200, body: { removed: await repo.unregister(userId, parsed.data.token) } };
}

/**
 * POST /api/app/push/opened: a notice was tapped.
 * @param {unknown} body
 * @param {string} userId
 * @param {DeviceRepository} repo
 */
export async function handleOpened(body, userId, repo) {
  const parsed = openedSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { error: firstIssue(parsed.error) } };
  return { status: 200, body: { opened: await repo.markOpened(userId, parsed.data.notificationId) } };
}

/**
 * GET /api/app/push/preferences.
 * @param {string} userId
 * @param {DeviceRepository} repo
 */
export async function handlePreferences(userId, repo) {
  return { status: 200, body: { categories: preferenceView(await repo.preferences(userId)) } };
}

/**
 * PUT /api/app/push/preferences: `{ categories: { workouts: false } }`. Unknown and mandatory categories are refused.
 * @param {unknown} body
 * @param {string} userId
 * @param {DeviceRepository} repo
 */
export async function handleSetPreferences(body, userId, repo) {
  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { error: firstIssue(parsed.error) } };
  for (const id of Object.keys(parsed.data.categories)) {
    const c = CATEGORIES[/** @type {NotificationCategory} */ (id)];
    if (!c || c.mandatory) return { status: 400, body: { error: `categories.${id}: not a switchable category` } };
  }
  for (const [id, enabled] of Object.entries(parsed.data.categories)) {
    await repo.setPreference(userId, /** @type {NotificationCategory} */ (id), enabled);
  }
  return handlePreferences(userId, repo);
}
