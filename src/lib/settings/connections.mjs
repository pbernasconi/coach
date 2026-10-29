// @ts-check
/**
 * The state of every connection, for the Settings pages on the web and in the app: one row per service with a state,
 * a level, one short status line and at most one short note. Pure: it reads loadStatus()'s result and BodySpec's
 * status. The web page adds its own detail tables; the phone shows these rows as they are.
 */

/** @typedef {'connected' | 'attention' | 'error' | 'off'} ConnectionState */
/** @typedef {'ok' | 'info' | 'warn' | 'error'} Level */

/**
 * @typedef {{
 *   id: string, name: string, state: ConnectionState, level: Level, statusText: string,
 *   detailText: string | null, note: string | null, lastSyncedAt: string | null, required: boolean,
 * }} Connection
 */

const RANK = { ok: 0, info: 1, warn: 2, error: 3 };

/**
 * "just now", "12 min ago", "3 h ago", "4 days ago"; "never" without a time.
 * @param {string | null | undefined} at
 * @param {number} now
 */
export function agoText(at, now) {
  if (!at) return 'never';
  const minutes = Math.max(0, (now - Date.parse(at)) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  const hours = minutes / 60;
  if (hours < 48) return `${Math.round(hours)} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** "Oct 22" from "2026-10-22". @param {string | null | undefined} day */
export function dayText(day) {
  if (!day) return null;
  const date = new Date(`${day.slice(0, 10)}T12:00:00Z`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * The worst warning level for a source, and its text.
 * @param {{ level: 'error' | 'warn' | 'info', source: string, text: string }[]} warnings
 * @param {string} source
 */
function worst(warnings, source) {
  /** @type {{ level: Level, text: string | null }} */
  let out = { level: 'ok', text: null };
  for (const w of warnings) {
    if (w.source === source && RANK[w.level] > RANK[out.level]) out = { level: w.level, text: w.text };
  }
  return out;
}

/**
 * A row's state from whether it is connected and its level.
 * @param {boolean} connected @param {Level} level @returns {ConnectionState}
 */
function stateOf(connected, level) {
  if (!connected) return 'off';
  if (level === 'error') return 'error';
  if (level === 'warn') return 'attention';
  return 'connected';
}

/**
 * Every connection and how many need attention.
 * @param {{ status: any, bodyspec: any | null, now: number }} input
 *   status: loadStatus(); bodyspec: loadBodyspecStatus(), or null when it could not be read.
 * @returns {{ items: Connection[], summary: { attention: number, total: number, level: Level, text: string } }}
 */
export function connectionsFrom({ status, bodyspec, now }) {
  const warnings = status.warnings ?? [];
  /** @type {Connection[]} */
  const items = [];
  /** @param {Omit<Connection, 'state' | 'level'> & { connected: boolean, level: Level }} row */
  const add = ({ connected, level, ...row }) => items.push({ ...row, state: stateOf(connected, level), level: connected ? level : level === 'ok' ? 'info' : level });

  const strava = worst(warnings, 'strava');
  add({
    id: 'strava', name: 'Strava', connected: status.strava.connected, level: strava.level, required: true,
    statusText: status.strava.connected ? `Synced ${agoText(status.strava.lastSyncedAt, now)}` : 'Not connected',
    detailText: status.strava.newestActivity ? `Newest activity ${dayText(status.strava.newestActivity)}` : null,
    note: strava.text, lastSyncedAt: status.strava.lastSyncedAt,
  });

  const g = status.garmin;
  const garminOk = g.connected && g.status !== 'auth_failed';
  const garmin = worst(warnings, 'garmin');
  add({
    id: 'garmin', name: 'Garmin', connected: garminOk, level: garmin.level, required: true,
    statusText: !g.connected ? 'Not set up' : g.status === 'auth_failed' ? 'Login expired' : `Synced ${agoText(g.lastSuccessAt, now)}`,
    detailText: g.syncedThrough ? `Sleep and HRV through ${dayText(g.syncedThrough)}` : null,
    // The web's Garmin text ends with a Mac command; on a phone one plain sentence says what to do.
    note: garminOk ? (garmin.level === 'ok' ? null : garmin.text) : 'Log in to Garmin again on your Mac (scripts/garmin).',
    lastSyncedAt: g.lastSuccessAt,
  });

  /** @type {{ lastSyncedAt: string | null }[]} */
  const calendars = status.calendars ?? [];
  const newestCalendar = calendars.map((c) => c.lastSyncedAt).filter(Boolean).sort().at(-1) ?? null;
  const calendar = worst(warnings, 'calendar');
  add({
    id: 'calendar', name: 'Google Calendar', connected: calendars.length > 0, level: calendar.level, required: true,
    statusText: calendars.length ? `Synced ${agoText(newestCalendar, now)}` : 'Not connected',
    detailText: calendars.length ? `${calendars.length} ${calendars.length === 1 ? 'calendar' : 'calendars'}` : null,
    note: calendar.text, lastSyncedAt: newestCalendar,
  });

  const lift = status.lift;
  const liftNote = warnings.find((/** @type {{ source: string, level: Level, text: string }} */ w) => w.source === 'lift' && w.level !== 'info');
  add({
    id: 'lift', name: 'Lift', connected: Boolean(lift.lastChangeAt), level: liftNote?.level ?? 'ok', required: true,
    statusText: lift.lastChangeAt ? `Synced ${agoText(lift.lastChangeAt, now)}` : 'Not synced yet',
    detailText: `${lift.sessions} ${lift.sessions === 1 ? 'session' : 'sessions'}`,
    note: liftNote?.text ?? null, lastSyncedAt: lift.lastChangeAt,
  });

  const bs = bodyspec;
  const bsLevel = !bs || bs.status === 'auth_failed' || bs.status === 'error' ? 'error' : 'ok';
  add({
    id: 'bodyspec', name: 'BodySpec', connected: Boolean(bs?.connected), level: bsLevel, required: true,
    statusText: !bs ? 'Could not be read' : !bs.connected ? 'Not connected' : bs.status === 'auth_failed' ? 'Login expired' : `${bs.scans} ${bs.scans === 1 ? 'scan' : 'scans'}`,
    detailText: bs?.newest ? `Newest scan ${dayText(bs.newest)}` : null,
    note: bsLevel === 'error' && bs?.connected ? (bs.lastError ?? 'The last BodySpec sync failed.') : null,
    lastSyncedAt: bs?.lastSuccessAt ?? null,
  });

  const fn = status.functionSync;
  const fnWarn = worst(warnings, 'function');
  add({
    id: 'function', name: 'Function Health', connected: Boolean(fn.lastSuccessAt), level: fnWarn.level, required: false,
    statusText: fn.lastSuccessAt ? `Synced ${agoText(fn.lastSuccessAt, now)}` : 'Runs by hand',
    detailText: null, note: fnWarn.text, lastSyncedAt: fn.lastSuccessAt,
  });

  const scale = worst(warnings, 'scale');
  const bridge = status.scale.bridge ?? null;
  add({
    id: 'scale', name: 'Bathroom scale', connected: Boolean(status.scale.lastWeighIn || bridge), level: scale.level, required: false,
    statusText: status.scale.lastWeighIn ? `Last weigh-in ${dayText(status.scale.lastWeighIn)}` : 'No weigh-ins yet',
    detailText: bridge ? `Bridge seen ${agoText(bridge.receivedAt, now)}` : null, note: scale.text, lastSyncedAt: bridge?.receivedAt ?? null,
  });

  const required = items.filter((i) => i.required);
  const attention = items.filter((i) => (i.required && i.state === 'off') || i.state === 'error' || i.state === 'attention').length;
  /** @type {Level} */
  const level = items.reduce((worstLevel, i) => (i.state !== 'connected' && i.required && RANK[i.level] > RANK[worstLevel] ? i.level : worstLevel), /** @type {Level} */ ('ok'));
  return {
    items,
    summary: {
      attention,
      total: required.length,
      level: attention ? (level === 'ok' ? 'warn' : level) : 'ok',
      text: attention ? `${attention} of ${required.length} ${attention === 1 ? 'needs' : 'need'} attention` : `All ${required.length} required connections are healthy`,
    },
  };
}
