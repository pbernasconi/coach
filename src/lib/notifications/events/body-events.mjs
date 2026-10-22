// The body domain of NOTIFICATION_EVENTS: a weigh-in on the bathroom scale (devices/scale-bridge posts it to
// /api/vitals/sync). A tap opens that day's weigh-in.

import { z } from 'zod';
import { DAY_SECONDS, defineEvent } from './define.mjs';
import { kgChangeText, shortDay } from './format.mjs';

const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const KG = z.number().min(20).max(400);

/** What `weigh_in.recorded` takes: the reading, and the readings it is compared with. */
export const weighInPayload = z.object({
  date: DAY,
  weightKg: KG,
  bodyFatPct: z.number().min(1).max(80).nullable().default(null),
  /** The last weigh-in on an earlier day. */
  previous: z.object({ date: DAY, weightKg: KG }).nullable().default(null),
  /** The change over 4 weeks (loadBody's `change4w`). */
  change4wKg: z.number().min(-100).max(100).nullable().default(null),
  source: z.string().trim().min(1).max(200),
});

/** @typedef {z.infer<typeof weighInPayload>} WeighIn */

/**
 * "▼ 0.3 kg since Oct 21 · body fat 18.4 % · ▼ 1.2 kg in 4 weeks", or "First weigh-in" with nothing to compare.
 * @param {WeighIn} p
 */
export function weighInBody(p) {
  const parts = [];
  if (p.previous) parts.push(`${kgChangeText(p.weightKg - p.previous.weightKg)} since ${shortDay(p.previous.date)}`);
  if (p.bodyFatPct != null) parts.push(`body fat ${p.bodyFatPct.toFixed(1)} %`);
  if (p.change4wKg != null) parts.push(`${kgChangeText(p.change4wKg)} in 4 weeks`);
  return parts.length ? parts.join(' · ') : 'First weigh-in in Coach';
}

export const BODY_NOTIFICATION_EVENTS = {
  'weigh_in.recorded': defineEvent({
    category: 'body',
    payload: weighInPayload,
    // A second weigh-in the same day with another weight is a new notice; the scale re-sending a batch is not.
    idempotencyKey: (p) => `weigh_in.recorded:${p.date}:${p.weightKg.toFixed(2)}`,
    title: (p) => `Weigh-in: ${p.weightKg.toFixed(1)} kg`,
    body: weighInBody,
    destination: (p) => ({ kind: 'weighIn', date: p.date }),
    // The day's latest weigh-in replaces an earlier one on the lock screen.
    collapseKey: (p) => `weigh_in:${p.date}`,
    threadKey: () => 'body',
    interruptionLevel: 'passive',
    ttlSeconds: DAY_SECONDS,
  }),
};
