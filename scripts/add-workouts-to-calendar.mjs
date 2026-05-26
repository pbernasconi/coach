#!/usr/bin/env node
/**
 * Push training events to Paolo's personal Gmail calendar (purple).
 * Idempotent — re-running deletes existing events tagged with the same
 * plan date, then re-creates them.
 *
 * Usage:
 *   node scripts/add-workouts-to-calendar.mjs --plan plans/2026-05-25.json
 *   node scripts/add-workouts-to-calendar.mjs --plan plans/2026-05-25.json --dry-run
 *   node scripts/add-workouts-to-calendar.mjs --events '[{ title, start, end, description }]' --plan-date 2026-05-25
 *
 * Plan JSON schema:
 *   {
 *     "weekStart": "YYYY-MM-DD",
 *     "events": [
 *       { "title": "...", "start": "YYYY-MM-DDTHH:MM:SS", "end": "...", "description": "...", "timeZone": "America/Los_Angeles" }
 *     ]
 *   }
 *
 * Defaults (from durable memory):
 *   - Calendar: paolo.enrico.bernasconi@gmail.com (personal Gmail)
 *   - Color: "3" (Grape / purple)
 *   - Timezone: America/Los_Angeles
 *
 * Idempotency: every event we create is tagged with
 *   extendedProperties.private.coachPlanDate = <weekStart>
 *   extendedProperties.private.coachManaged = "true"
 * On re-run, all events matching that tag are deleted first.
 */

import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const CRED_PATH = '/Users/paolo/.claude/skills/google-calendar/.credentials/personal-gmail.json';
const PLANS_DIR = resolve('plans');
const CALENDAR_ID = 'paolo.enrico.bernasconi@gmail.com';
const COLOR_ID = '3'; // Grape / purple
const DEFAULT_TZ = 'America/Los_Angeles';

const CLIENT_ID = process.env.GCAL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GCAL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

// ===== Args =====
const args = process.argv.slice(2);
function getFlag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}
const PLAN_PATH = getFlag('--plan');
const EVENTS_INLINE = getFlag('--events');
const PLAN_DATE_FLAG = getFlag('--plan-date');
const DRY_RUN = args.includes('--dry-run');

let events;
let planDate;
if (PLAN_PATH) {
  // Restrict --plan to the project's plans/ directory to prevent arbitrary file read/write.
  const resolved = resolve(PLAN_PATH);
  const rel = relative(PLANS_DIR, resolved);
  if (rel.startsWith('..') || resolve(rel) === resolved) {
    console.error(`--plan must resolve inside ${PLANS_DIR}`);
    process.exit(1);
  }
  const plan = JSON.parse(readFileSync(resolved, 'utf8'));
  events = plan.events;
  planDate = plan.weekStart;
} else if (EVENTS_INLINE) {
  events = JSON.parse(EVENTS_INLINE);
  planDate = PLAN_DATE_FLAG;
} else {
  console.error('Usage: --plan <path.json>  OR  --events <json> --plan-date YYYY-MM-DD');
  process.exit(1);
}
if (!planDate) { console.error('Need a plan date (weekStart in JSON or --plan-date).'); process.exit(1); }
if (!Array.isArray(events) || events.length === 0) { console.error('No events to add.'); process.exit(1); }

// ===== Token =====
const cred = JSON.parse(readFileSync(CRED_PATH, 'utf8'));
let accessToken = cred.access_token;
if ((cred.expiry_date ?? 0) < Date.now() + 60_000) {
  console.log('Refreshing token…');
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Need GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET env vars to refresh.');
    process.exit(1);
  }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: cred.refresh_token, grant_type: 'refresh_token',
    }),
  });
  if (!r.ok) {
    // Don't echo the response body — it may contain token fragments.
    console.error(`Refresh failed: ${r.status} ${r.statusText}`);
    process.exit(1);
  }
  const tok = await r.json();
  accessToken = tok.access_token;
  cred.access_token = tok.access_token;
  cred.expiry_date = Date.now() + tok.expires_in * 1000;
  writeFileSync(CRED_PATH, JSON.stringify(cred, null, 2));
  try { chmodSync(CRED_PATH, 0o600); } catch { /* best-effort */ }
}

async function gcal(path, init = {}) {
  const url = `https://www.googleapis.com/calendar/v3${path}`;
  const r = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${url}: ${r.status} ${await r.text()}`);
  if (r.status === 204) return null;
  return r.json();
}

// ===== 1. Delete any existing managed events for this plan date =====
// Window: planDate (Mon) UTC midnight → Mon+8d (covers full 7-day week with a 1-day timezone buffer).
const weekStart = new Date(`${planDate}T00:00:00Z`);
const weekEnd = new Date(weekStart); weekEnd.setUTCDate(weekEnd.getUTCDate() + 8);
const params = new URLSearchParams({
  privateExtendedProperty: `coachPlanDate=${planDate}`,
  timeMin: weekStart.toISOString(),
  timeMax: weekEnd.toISOString(),
  singleEvents: 'true',
  maxResults: '100',
});
const existing = await gcal(`/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params}`);
const toDelete = existing.items ?? [];
if (toDelete.length > 0) {
  console.log(`Deleting ${toDelete.length} existing managed event(s) for ${planDate}…`);
  for (const e of toDelete) {
    if (DRY_RUN) {
      console.log(`  (dry-run) would delete: ${e.summary} (${e.id})`);
      continue;
    }
    await gcal(`/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${e.id}`, { method: 'DELETE' });
  }
}

// ===== 2. Create the new events =====
const created = [];
for (const e of events) {
  const body = {
    summary: e.title,
    description: e.description ?? '',
    location: e.location ?? undefined,
    start: { dateTime: e.start, timeZone: e.timeZone ?? DEFAULT_TZ },
    end: { dateTime: e.end, timeZone: e.timeZone ?? DEFAULT_TZ },
    colorId: e.colorId ?? COLOR_ID,
    transparency: e.transparency ?? 'opaque',
    reminders: { useDefault: true },
    extendedProperties: {
      private: {
        coachPlanDate: planDate,
        coachManaged: 'true',
        ...(e.workoutType ? { coachWorkoutType: e.workoutType } : {}),
      },
    },
  };
  if (DRY_RUN) {
    console.log(`(dry-run) ${e.title}  ${e.start}–${e.end}`);
    continue;
  }
  const out = await gcal(`/calendars/${encodeURIComponent(CALENDAR_ID)}/events`, {
    method: 'POST', body: JSON.stringify(body),
  });
  console.log(`✓ ${e.title.padEnd(40)} ${e.start}  →  ${out.htmlLink}`);
  created.push({ id: out.id, htmlLink: out.htmlLink, title: e.title, start: e.start });
}

console.log(`\nCreated ${created.length}/${events.length} on ${CALENDAR_ID} (purple). Plan date: ${planDate}.`);

// ===== 3. Write created event IDs back to plan JSON for traceability =====
if (PLAN_PATH && !DRY_RUN && created.length > 0) {
  const plan = JSON.parse(readFileSync(PLAN_PATH, 'utf8'));
  plan.calendarEvents = created;
  plan.calendarSyncedAt = new Date().toISOString();
  writeFileSync(PLAN_PATH, JSON.stringify(plan, null, 2));
  console.log(`Wrote event IDs back to ${PLAN_PATH}.`);
}
