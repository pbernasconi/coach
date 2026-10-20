#!/usr/bin/env node
/**
 * Calendar sync — pull events from all active Google Calendar connections into calendar_events.
 * The logic lives in src/lib/calendar-sync/sync.mjs; the server's /api/cron/calendar uses it too.
 *
 * Usage:
 *   node --env-file=.env.local scripts/calendar-sync.mjs [--days-back 7] [--days-forward 30]
 */

import { connect } from '../src/db/neon.mjs';
import { syncCalendars } from '../src/lib/calendar-sync/sync.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

await syncCalendars(connect(), {
  daysBack: parseInt(flag('--days-back', '7'), 10),
  daysForward: parseInt(flag('--days-forward', '30'), 10),
});
