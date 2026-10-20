/**
 * Parsers for MX3 Fitness reservation pages (mx3fitness.com, an AccelSite PHP site with no JSON API).
 *
 * Markup this relies on (seen on the logged-in /reserve-<location>-station pages):
 *   <div class='time-list castro-3'><span class='station-name'>Castro 3</span>
 *     <p id='res_time_{stationId}_{YYYY-MM-DD}_{h:mmam}'>
 *       <a onclick="loadRequest('res_time_…','v2=true&reserve=…&res_date=…&res_time=…&loadAjax=true&layout=blank')"
 *          title='Click to reserve' class='button-link '>2:00pm</a></p>
 *   Taken slots:   title='Reserved by …' class='… reserved gray'
 *   Closed slots:  title='Reservation window closed'
 *   Your bookings: <div id="my_reservations"><div>Castro 3: Tuesday 10/20 at 2:00pm
 *                    <a href='reserve-castro-station?unreserve=128242'>cancel reservation</a></div></div>
 *   Day tabs:      refreshButtons('buttons_for_2026-10-20','locID=…&refreshDate=2026-10-20&reservableType=station&forMember=…')
 *
 * Clicking your own slot on the site CANCELS it (the grid toggles). Nothing here books or cancels;
 * the client only ever sends a reserve request that it copied from a slot titled "Click to reserve".
 */

/**
 * @typedef {{ stationId: number, station: string, date: string, time: string,
 *   status: 'available' | 'mine' | 'reserved' | 'recurring' | 'closed', reservedBy: string, reserveRequest: string }} Slot
 * @typedef {{ id: string, station: string, date: string, time: string, cancelHref: string }} Reservation
 * @typedef {{ date: string, locID: string, forMember: string, reservableType: string }} Day
 */

const decode = (s) =>
  String(s ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');

const stripTags = (s) => decode(String(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Attribute value from an opening tag, quoted with ' or ". */
function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? decode(m[2] ?? m[3]) : '';
}

/** "2:00 PM" / "2pm" / "14:00" → "2:00pm" (the site's format). Returns null when unparseable. */
export function normalizeTime(input) {
  const s = String(input).trim().toLowerCase().replace(/\s+/g, '');
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ?? '00';
  let ap = m[3];
  if (!ap) {
    if (h > 23) return null;
    ap = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
  }
  if (h < 1 || h > 12 || Number(min) > 59) return null;
  return `${h}:${min}${ap}`;
}

/** "2:00pm" → minutes after midnight, for sorting. */
export function timeToMinutes(t) {
  const m = String(t).match(/^(\d{1,2}):(\d{2})(am|pm)$/);
  if (!m) return NaN;
  return ((Number(m[1]) % 12) + (m[3] === 'pm' ? 12 : 0)) * 60 + Number(m[2]);
}

/**
 * Every slot on the page.
 * status: available | mine | reserved | recurring | closed
 * reserveRequest is set only for available slots, copied verbatim from the page's own onclick.
 * @param {string} html
 * @returns {Slot[]}
 */
export function parseSlots(html) {
  html = String(html ?? '');
  const names = stationNames(html);
  const slots = [];
  const re = /<p\b[^>]*\bid\s*=\s*["']res_time_(\d+)_(\d{4}-\d{2}-\d{2})_([^"']+)["'][^>]*>([\s\S]*?)<\/p>/gi;
  for (const m of html.matchAll(re)) {
    const [, stationId, date, rawTime, inner] = m;
    const aTag = inner.match(/<a\b[^>]*>/i)?.[0] ?? '';
    const title = attr(aTag, 'title');
    const cls = attr(aTag, 'class');
    const onclick = attr(aTag, 'onclick');
    const href = attr(aTag, 'href');
    const resName = stripTags(inner.match(/<span[^>]*res-name[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '');
    const request = onclick.match(/loadRequest\(\s*'[^']*'\s*,\s*'([^']*)'/)?.[1] ?? '';
    const actions = `${request} ${href}`;

    let status;
    if (/\bunreserve=/.test(actions)) status = 'mine';
    else if (/^Click to reserve$/i.test(title) && /\breserve=\d+/.test(request)) status = 'available';
    else if (/recurring/i.test(title)) status = 'recurring';
    else if (/window closed/i.test(title)) status = 'closed';
    else if (/^Reserved by/i.test(title) || /\breserved\b/.test(cls)) status = 'reserved';
    else status = 'closed'; // unknown shape: never treat as bookable

    slots.push({
      stationId: Number(stationId),
      station: names.get(Number(stationId)) ?? `Station ${stationId}`,
      date,
      time: normalizeTime(rawTime) ?? rawTime,
      status,
      reservedBy: status === 'reserved' || status === 'mine' ? resName || title.replace(/^Reserved by\s*/i, '') : '',
      reserveRequest: status === 'available' ? request : '',
    });
  }
  return slots;
}

/** stationId → display name, from each time-list's station-name label and the slot ids that follow it. */
export function stationNames(html) {
  const map = new Map();
  const re = /<span[^>]*class\s*=\s*["'][^"']*station-name[^"']*["'][^>]*>([\s\S]*?)<\/span>([\s\S]*?)(?=<span[^>]*station-name|$)/gi;
  for (const m of String(html).matchAll(re)) {
    const id = m[2].match(/res_time_(\d+)_/)?.[1];
    if (id && !map.has(Number(id))) map.set(Number(id), stripTags(m[1]));
  }
  return map;
}

/**
 * Day tabs on the page.
 * @param {string} html
 * @returns {Day[]}
 */
export function parseDays(html) {
  const days = new Map();
  for (const m of String(html).matchAll(/refreshButtons\(\s*'buttons_for_(\d{4}-\d{2}-\d{2})'\s*,\s*'([^']*)'/g)) {
    const params = new URLSearchParams(decode(m[2]));
    if (!days.has(m[1]) || params.get('reservableType') === 'station') {
      days.set(m[1], {
        date: m[1],
        locID: params.get('locID') ?? '',
        forMember: params.get('forMember') ?? '',
        reservableType: params.get('reservableType') ?? '',
      });
    }
  }
  for (const m of String(html).matchAll(/class\s*=\s*["'][^"']*day-box[^"']*["'][^>]*title\s*=\s*["'](\d{4}-\d{2}-\d{2})["']/g)) {
    if (!days.has(m[1])) days.set(m[1], { date: m[1], locID: '', forMember: '', reservableType: '' });
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** The location id (locID) the page uses for schedule refreshes, or ''. */
export function parseLocId(html) {
  return decode(String(html)).match(/locID=(\d+)/)?.[1] ?? '';
}

/** Gym credits remaining, from "you have <b>4</b> Gym Credits" or #credit_count. null if absent. */
export function parseCredits(html) {
  const s = String(html ?? '').trim();
  if (/^\d+$/.test(s)) return Number(s);
  const byId = s.match(/id\s*=\s*["']credit_count["'][^>]*>\s*(\d+)/i)?.[1];
  if (byId) return Number(byId);
  const text = stripTags(s).match(/you have\s+(\d+)\s+gym credits?/i)?.[1];
  return text ? Number(text) : null;
}

/**
 * Your upcoming bookings from the full page's #my_reservations block.
 * today (YYYY-MM-DD) picks the year for "MM/DD" dates: a date more than 2 months in the past rolls into next year.
 * @param {string} html
 * @param {string} today
 * @returns {Reservation[]}
 */
export function parseReservations(html, today) {
  const out = [];
  const re = /<div[^>]*>([^<]*?)<a\b([^>]*\bunreserve=(\d+)[^>]*)>[\s\S]*?<\/a>/gi;
  const [ty, tm] = String(today).split('-').map(Number);
  for (const m of String(html ?? '').matchAll(re)) {
    const text = stripTags(m[1]);
    const station = text.match(/^(.+?):/)?.[1]?.trim();
    const md = text.match(/(\d{1,2})\/(\d{1,2})/);
    const time = normalizeTime(text.match(/(\d{1,2}:\d{2}\s*(?:am|pm))/i)?.[1] ?? '');
    if (!station || !md || !time) continue;
    const month = Number(md[1]);
    const year = ty && month < tm - 2 ? ty + 1 : ty || new Date().getFullYear();
    out.push({
      id: m[3],
      station,
      date: `${year}-${String(month).padStart(2, '0')}-${String(Number(md[2])).padStart(2, '0')}`,
      time,
      cancelHref: attr(`<a ${m[2]}>`, 'href'),
    });
  }
  return out;
}

/** What the server said to a reserve request. */
export function parseBookingResponse(text) {
  const t = String(text ?? '').trim();
  const known = {
    reload: 'Out of gym credits. Buy more on mx3fitness.com.',
    duplicate: 'That slot was just taken.',
    concurrent: 'You already have a booking that overlaps this time.',
    invalid: 'MX3 rejected the station or time.',
  };
  if (known[t]) return { ok: false, code: t, message: known[t] };
  if (isSignInRequired(t)) return { ok: false, code: 'signin', message: 'MX3 session expired.' };
  if (!t) return { ok: false, code: 'empty', message: 'MX3 sent an empty response.' };
  return { ok: true, code: 'ok', message: 'Booked.' };
}

export function isSignInRequired(html) {
  return /Sign In Required/i.test(String(html ?? ''));
}

/** True when the page shows a logged-in member (has the reservations block, credits, or slot grid). */
export function looksLoggedIn(html) {
  const s = String(html ?? '');
  return !isSignInRequired(s) && (/my_reservations/.test(s) || parseCredits(s) !== null || /res_time_\d+_/.test(s));
}
