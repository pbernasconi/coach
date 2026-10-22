// Every notification Coach sends, by type. The rules for a new entry:
//
//  1. Put it in the domain file it belongs to (events/*-events.mjs), defined with `defineEvent`.
//  2. Give it a payload schema that a trigger can fill from the database, and an idempotency key that a retried
//     trigger (a webhook sent twice, a sync pushed again) makes again, so the phone gets one notice.
//  3. Name a destination (destinations.mjs). Add a new destination kind there and in lift/PUSH.md and AppLink.swift.
//  4. Pick a category: it is the switch in Settings. A new category also goes in CATEGORIES below.
//  5. Add a test to catalog.test.mjs that binds a sample payload and checks the text and link.

import { BODY_NOTIFICATION_EVENTS } from './events/body-events.mjs';
import { SYSTEM_NOTIFICATION_EVENTS } from './events/system-events.mjs';
import { WORKOUT_NOTIFICATION_EVENTS } from './events/workout-events.mjs';

export const NOTIFICATION_EVENTS = {
  ...WORKOUT_NOTIFICATION_EVENTS,
  ...BODY_NOTIFICATION_EVENTS,
  ...SYSTEM_NOTIFICATION_EVENTS,
};

/** @typedef {keyof typeof NOTIFICATION_EVENTS} NotificationType */

/**
 * The switches in Settings, one per category. `mandatory` categories have no switch.
 * @type {Record<import('./events/define.mjs').NotificationCategory, { label: string, description: string, mandatory: boolean }>}
 */
export const CATEGORIES = {
  workouts: { label: 'Workouts', description: 'When a Lift session or a Strava activity is finished.', mandatory: false },
  body: { label: 'Weigh-ins', description: 'When the bathroom scale sends a weigh-in.', mandatory: false },
  system: { label: 'Coach', description: 'Test pushes from Settings.', mandatory: true },
};

/** True for a type in the catalog. */
export const isNotificationType = (type) => Object.hasOwn(NOTIFICATION_EVENTS, type);

/**
 * Binds `payload` to the event `type`.
 * @param {string} type
 * @param {unknown} payload
 * @param {{ origin: string }} options
 * @returns {{ ok: true, event: import('./events/define.mjs').BoundEvent } | { ok: false, error: string }}
 */
export function bindEvent(type, payload, options) {
  if (!isNotificationType(type)) return { ok: false, error: `unknown notification type ${type}` };
  return NOTIFICATION_EVENTS[/** @type {NotificationType} */ (type)].bind(type, payload, options);
}
