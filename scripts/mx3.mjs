#!/usr/bin/env node
/**
 * Book MX3 Fitness private stations from the command line. Used by the /gym command.
 *
 * Needs MX3_USERNAME and MX3_PASSWORD (in .env.local locally, or the cloud environment's variables).
 *
 *   node --env-file=.env.local scripts/mx3.mjs status                       # credits + your bookings
 *   node --env-file=.env.local scripts/mx3.mjs slots --date tue             # free private stations that day
 *   node --env-file=.env.local scripts/mx3.mjs slots --date 2026-10-21 --time 2pm
 *   node --env-file=.env.local scripts/mx3.mjs book --date tue --time 2pm --station 3 --dry-run
 *   node --env-file=.env.local scripts/mx3.mjs book --date tue --time 2pm --station 3
 *   node --env-file=.env.local scripts/mx3.mjs cancel --id 128242 --confirm
 *
 * Common flags: --location castro|mission|noe|sonoma (default castro), --json.
 * Dates: YYYY-MM-DD, today, tomorrow, or a weekday (mon..sun = the next one, today included).
 *
 * book only ever sends a reserve for a slot MX3 shows as free. It never touches your own slots
 * (clicking your own slot on the site cancels it). cancel needs --confirm.
 */

import { createClient, gymToday, googleCalendarLink, bookingWindow, MX3Error, LOCATIONS } from '../src/lib/mx3/client.mjs';
import { normalizeTime } from '../src/lib/mx3/parse.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (!a.startsWith('--')) fail(`Unexpected argument "${a}"`);
  const key = a.slice(2);
  const next = rest[i + 1];
  if (next === undefined || next.startsWith('--')) flags[key] = true;
  else { flags[key] = next; i++; }
}
const KNOWN = new Set(['date', 'time', 'station', 'location', 'json', 'dry-run', 'id', 'confirm', 'all']);
for (const k of Object.keys(flags)) if (!KNOWN.has(k)) fail(`Unknown flag --${k}`);

function fail(msg) {
  if (flags?.json) console.log(JSON.stringify({ ok: false, error: msg }));
  else console.error(`✗ ${msg}`);
  process.exit(1);
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
function resolveDate(input) {
  const today = gymToday();
  if (!input || input === true) return null;
  const s = String(input).toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const add = (n) => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  if (s === 'today') return today;
  if (s === 'tomorrow') return add(1);
  const wd = WEEKDAYS.indexOf(s.slice(0, 3));
  if (wd >= 0) { const now = new Date(`${today}T12:00:00Z`).getUTCDay(); return add((wd - now + 7) % 7); }
  fail(`Bad date "${input}". Use YYYY-MM-DD, today, tomorrow or a weekday.`);
}

const location = String(flags.location ?? 'castro').toLowerCase();
if (!LOCATIONS.includes(location)) fail(`Unknown location "${location}". Use ${LOCATIONS.join(', ')}.`);
const out = (data, text) => console.log(flags.json ? JSON.stringify(data, null, 2) : text);

try {
  const mx3 = createClient({ location });

  if (cmd === 'status') {
    const p = await mx3.overview();
    const lines = [`Credits: ${p.credits ?? 'unknown'}`, p.reservations.length ? 'Your bookings:' : 'No upcoming bookings.'];
    for (const r of p.reservations) lines.push(`  ${r.date} ${r.time.padStart(7)}  ${r.station}  (id ${r.id})`);
    lines.push(`Bookable days: ${p.days.map((d) => d.date).join(', ') || 'none shown'}`);
    out({ ok: true, location, credits: p.credits, reservations: p.reservations, days: p.days.map((d) => d.date) }, lines.join('\n'));
  } else if (cmd === 'slots') {
    const page = await mx3.overview();
    const date = resolveDate(flags.date) ?? page.days[0]?.date ?? gymToday();
    const t = flags.time ? normalizeTime(flags.time) : null;
    if (flags.time && !t) fail(`Bad time "${flags.time}"`);
    const day = await mx3.schedule(date, { page });
    const shown = day.slots.filter((s) => (flags.all || s.status === 'available' || s.status === 'mine') && (!t || s.time === t) && (!flags.station || s.station.toLowerCase().endsWith(` ${String(flags.station).toLowerCase()}`) || s.station.toLowerCase() === String(flags.station).toLowerCase()));
    const byStation = new Map();
    for (const s of shown) byStation.set(s.station, [...(byStation.get(s.station) ?? []), s]);
    const lines = [`${location} ${date} · credits ${day.credits ?? '?'} · free${flags.all ? ' + taken' : ''} slots:`];
    for (const [st, list] of byStation) lines.push(`  ${st.padEnd(10)} ${list.map((s) => (s.status === 'mine' ? `[${s.time} yours]` : s.status === 'available' ? s.time : `(${s.time})`)).join('  ')}`);
    if (!byStation.size) lines.push('  none');
    out({ ok: true, location, date, credits: day.credits, slots: shown.map((s) => ({ ...s, reserveRequest: undefined })) }, lines.join('\n'));
  } else if (cmd === 'book') {
    const date = resolveDate(flags.date);
    if (!date || !flags.time || !flags.station) fail('book needs --date, --time and --station');
    const r = await mx3.book({ date, time: flags.time, station: String(flags.station), dryRun: Boolean(flags['dry-run']) });
    const cal = r.ok && !r.dryRun ? { ...bookingWindow(date, r.slot.time), title: `Gym: MX3 ${r.slot.station}`, link: googleCalendarLink({ station: r.slot.station, date, time: r.slot.time, location }) } : null;
    const slot = r.slot ? { ...r.slot, reserveRequest: undefined } : null;
    out({ ...r, slot, calendar: cal }, [`${r.ok ? '✓' : '✗'} ${r.message}`, `Credits: ${r.credits?.before ?? '?'} → ${r.credits?.after ?? '?'}`, cal ? `Calendar: ${cal.link}` : ''].filter(Boolean).join('\n'));
    if (!r.ok) process.exit(1);
  } else if (cmd === 'cancel') {
    if (!flags.id) fail('cancel needs --id (see `status`)');
    if (!flags.confirm) fail('cancel is irreversible if the slot gets taken. Re-run with --confirm.');
    const r = await mx3.cancel(String(flags.id));
    out(r, `${r.ok ? '✓' : '✗'} ${r.message}\nCredits: ${r.credits.before ?? '?'} → ${r.credits.after ?? '?'}`);
    if (!r.ok) process.exit(1);
  } else {
    fail('Usage: mx3.mjs status | slots | book | cancel  (see the header of scripts/mx3.mjs)');
  }
} catch (e) {
  fail(e instanceof MX3Error ? e.message : `${e.name}: ${e.message}`);
}
