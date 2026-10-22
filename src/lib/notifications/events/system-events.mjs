// The system domain of NOTIFICATION_EVENTS: notices about Coach itself, never muted.

import { z } from 'zod';
import { HOUR_SECONDS, defineEvent } from './define.mjs';

/** A test push from Settings: proves the key, the token and the tap. `nonce` makes each test its own notice. */
export const testPayload = z.object({ nonce: z.string().regex(/^[0-9A-Za-z-]{1,64}$/) });

export const SYSTEM_NOTIFICATION_EVENTS = {
  'system.test': defineEvent({
    category: 'system',
    payload: testPayload,
    idempotencyKey: (p) => `system.test:${p.nonce}`,
    title: () => 'Coach test',
    body: () => 'Push notifications work. Tap to open Today in Lift.',
    destination: () => ({ kind: 'today' }),
    collapseKey: () => 'system.test',
    threadKey: () => 'system',
    interruptionLevel: 'active',
    ttlSeconds: HOUR_SECONDS,
  }),
};
