/**
 * MX3 Fitness client: log in, read the schedule, book a free slot, cancel one of your bookings.
 *
 * Credentials come from MX3_USERNAME / MX3_PASSWORD. Used by scripts/mx3.mjs (CLI, /gym command)
 * and the Gym page in the web app.
 *
 * Safety rules (the site's grid toggles: clicking your own slot cancels it):
 *  - book() only sends a reserve request copied from a slot the page titles "Click to reserve",
 *    and refuses if you already hold that station/time. It never sends anything with "unreserve".
 *  - cancel() needs the reservation id from your own #my_reservations list.
 *  - Both re-read the page afterwards and report what MX3 actually shows.
 */

import {
  isSignInRequired,
  looksLoggedIn,
  normalizeTime,
  parseBookingResponse,
  parseCredits,
  parseDays,
  parseLocId,
  parseReservations,
  parseSlots,
  timeToMinutes,
} from './parse.mjs';

const BASE = 'https://mx3fitness.com';
export const LOCATIONS = ['castro', 'mission', 'noe', 'sonoma'];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141 Safari/537.36';

export function hasCredentials(env = process.env) {
  return Boolean(env.MX3_USERNAME && env.MX3_PASSWORD);
}

/** Today in San Francisco as YYYY-MM-DD (the gym's dates are local). */
export function gymToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(now);
}

export class MX3Error extends Error {}

export function createClient({ username = process.env.MX3_USERNAME, password = process.env.MX3_PASSWORD, location = 'castro', fetchImpl = fetch } = {}) {
  if (!username || !password) throw new MX3Error('MX3_USERNAME and MX3_PASSWORD are not set.');
  if (!LOCATIONS.includes(location)) throw new MX3Error(`Unknown location "${location}". Use one of: ${LOCATIONS.join(', ')}.`);
  const path = `/reserve-${location}-station`;
  const cookies = new Map();
  let loggedIn = false;

  function keepCookies(res) {
    const list = res.headers.getSetCookie?.() ?? [];
    for (const c of list) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      if (i > 0) cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    // The page's own JS copies the session cookie into as_mx3fitness_com; the server expects both.
    const s = cookies.get('AccelSite_mx3fitness_com');
    if (s) cookies.set('as_mx3fitness_com', s);
  }

  async function request(method, url, body) {
    const headers = { 'User-Agent': UA };
    if (cookies.size) headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (body != null) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    let res = await fetchImpl(new URL(url, BASE), { method, headers, body, redirect: 'manual' });
    keepCookies(res);
    // Follow same-site redirects by hand so cookies set along the way are kept.
    for (let hops = 0; res.status >= 300 && res.status < 400 && hops < 5; hops++) {
      const next = new URL(res.headers.get('location') ?? '/', BASE);
      if (next.origin !== BASE) throw new MX3Error(`Unexpected redirect to ${next.origin}`);
      res = await fetchImpl(next, { method: 'GET', headers: { ...headers, Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') }, redirect: 'manual' });
      keepCookies(res);
    }
    if (!res.ok) throw new MX3Error(`MX3 returned HTTP ${res.status}`);
    return res.text();
  }

  async function login() {
    cookies.clear();
    const body = new URLSearchParams({ userName: username, password, loginReturnURL: path, formSubmitFrom: 'memberLoginForm.php' });
    const html = await request('POST', path, body.toString());
    if (!looksLoggedIn(html) && !cookies.has('AccelSite_mx3fitness_com')) throw new MX3Error('MX3 login failed. Check MX3_USERNAME / MX3_PASSWORD.');
    loggedIn = true;
    return html;
  }

  /** POST to the location page with auto re-login once if the session expired. */
  async function post(body) {
    if (!loggedIn) await login();
    let html = await request('POST', path, body);
    if (isSignInRequired(html)) {
      await login();
      html = await request('POST', path, body);
      if (isSignInRequired(html)) throw new MX3Error('MX3 session expired and logging in again did not help.');
    }
    return html;
  }

  /** Full page: credits, your bookings, day tabs and the first day's grid. */
  async function overview() {
    const html = await post('getReservations=true&forMember=');
    if (!looksLoggedIn(html)) throw new MX3Error('MX3 did not show a logged-in page. Login may have failed.');
    return {
      html,
      credits: parseCredits(html),
      reservations: parseReservations(html, gymToday()),
      days: parseDays(html),
      locID: parseLocId(html),
      slots: parseSlots(html),
    };
  }

  /**
   * Slots for one date (private stations by default). Read-only.
   * @param {string} date
   * @param {{ type?: string, page?: Awaited<ReturnType<typeof overview>> }} [opts]
   */
  async function schedule(date, { type = 'station', page } = {}) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new MX3Error(`Bad date "${date}", use YYYY-MM-DD.`);
    page ??= await overview();
    const onPage = page.slots.filter((s) => s.date === date);
    let slots = onPage;
    if (!onPage.length || type !== 'station') {
      const day = page.days.find((d) => d.date === date);
      const locID = day?.locID || page.locID;
      if (!locID) throw new MX3Error(`MX3 shows no schedule for ${date}. Bookable days: ${page.days.map((d) => d.date).join(', ') || 'none found'}.`);
      const params = new URLSearchParams({ locID, refreshDate: date, reservableType: type, forMember: day?.forMember ?? '', layout: 'blank', ajax: 'true' });
      slots = parseSlots(await post(params.toString())).filter((s) => s.date === date);
    }
    // A booking listed in #my_reservations is yours even if the grid cell does not say so.
    for (const s of slots) {
      if (page.reservations.some((r) => r.date === s.date && r.time === s.time && r.station === s.station)) s.status = 'mine';
    }
    slots.sort((a, b) => a.station.localeCompare(b.station, 'en', { numeric: true }) || timeToMinutes(a.time) - timeToMinutes(b.time));
    return { ...page, date, slots };
  }

  /** Station "3", "Castro 3" or "castro-3" → the slot's station name match. */
  function matchStation(slot, station) {
    const want = String(station).toLowerCase().replace(/[-_]/g, ' ').trim();
    const name = slot.station.toLowerCase();
    return name === want || name.endsWith(` ${want}`) || String(slot.stationId) === want;
  }

  /**
   * Book one free slot. Returns { ok, message, slot, credits: { before, after }, reservation }.
   * dryRun: find and check the slot, send nothing.
   */
  async function book({ date, time, station, dryRun = false }) {
    const t = normalizeTime(time);
    if (!t) throw new MX3Error(`Bad time "${time}". Use e.g. 2pm or 2:00pm.`);
    const day = await schedule(date);
    const candidates = day.slots.filter((s) => s.time === t && matchStation(s, station));
    if (!candidates.length) throw new MX3Error(`No ${station} slot at ${t} on ${date}.`);
    if (candidates.length > 1) throw new MX3Error(`"${station}" matches several stations (${candidates.map((c) => c.station).join(', ')}). Be more specific.`);
    const slot = candidates[0];
    if (slot.status === 'mine') return { ok: true, already: true, message: `You already have ${slot.station} at ${t} on ${date}.`, slot, credits: { before: day.credits, after: day.credits } };
    if (slot.status !== 'available') throw new MX3Error(`${slot.station} at ${t} on ${date} is ${slot.status}${slot.reservedBy ? ` (${slot.reservedBy})` : ''}, not free.`);
    if (!/\breserve=\d+/.test(slot.reserveRequest) || /unreserve/i.test(slot.reserveRequest)) throw new MX3Error('Refusing: the slot request does not look like a reserve.');
    if (day.reservations.some((r) => r.date === date && r.time === t)) throw new MX3Error(`You already have a booking at ${t} on ${date}.`);
    if (dryRun) return { ok: true, dryRun: true, message: `Would book ${slot.station} at ${t} on ${date}.`, slot, credits: { before: day.credits, after: day.credits } };

    const response = parseBookingResponse(await post(`${slot.reserveRequest}&ajax=true`));
    const after = await overview();
    const reservation = after.reservations.find((r) => r.date === date && r.time === t && r.station === slot.station);
    if (reservation) return { ok: true, message: `Booked ${slot.station} at ${t} on ${date}.`, slot, reservation, credits: { before: day.credits, after: after.credits } };
    return { ok: false, message: response.ok ? 'MX3 accepted the request but the booking is not in your list. Check the site.' : response.message, slot, credits: { before: day.credits, after: after.credits } };
  }

  /** Cancel one of your bookings by reservation id (from overview().reservations). */
  async function cancel(id) {
    const page = await overview();
    const r = page.reservations.find((x) => x.id === String(id));
    if (!r) throw new MX3Error(`No booking with id ${id} in your MX3 list.`);
    await request('GET', r.cancelHref.startsWith('/') ? r.cancelHref : `/${r.cancelHref}`);
    const after = await overview();
    const gone = !after.reservations.some((x) => x.id === r.id);
    return { ok: gone, message: gone ? `Cancelled ${r.station} at ${r.time} on ${r.date}.` : 'MX3 still lists the booking. Cancellations must be at least 1 hour before.', reservation: r, credits: { before: page.credits, after: after.credits } };
  }

  return { login, overview, schedule, book, cancel, location, path };
}

/** One-hour event times for a booking, in SF local time (for calendars). */
export function bookingWindow(date, time, minutes = 60) {
  const start = timeToMinutes(normalizeTime(time));
  const fmt = (m) => `${date}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`;
  return { start: fmt(start), end: fmt(start + minutes), timeZone: 'America/Los_Angeles' };
}

/** Google Calendar "add event" link for a booking: no OAuth needed, one tap on the phone. */
export function googleCalendarLink({ station, date, time, location = 'castro' }) {
  const { start, end } = bookingWindow(date, time);
  const compact = (s) => s.replace(/[-:]/g, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Gym: MX3 ${station}`,
    dates: `${compact(start)}/${compact(end)}`,
    ctz: 'America/Los_Angeles',
    details: `MX3 ${location} private station, booked via Coach. Cancel at least 1 hour before on mx3fitness.com.`,
    location: `MX3 Fitness ${location[0].toUpperCase()}${location.slice(1)}, San Francisco`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
