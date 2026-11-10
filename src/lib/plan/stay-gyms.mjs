// @ts-check
// The gyms near where Paolo stays on a trip. A calendar hold like "Stay at Loft Style East London Flat" with the
// flat's address names the stay; OpenStreetMap (Nominatim) finds the address and the gyms around it. The planner
// reads the list so a trip with a gym 5 minutes away stays a full week with full-gym lifts, not a floor week.
// Pure but for the injected fetch (stay-gyms.test.mjs).

const STAY = /^\s*(stay|staying|hotel|airbnb|accommodation|lodging)\b|\bstay(ing)? (at|in)\b|\bcheck[- ]?in\b.*\b(hotel|airbnb|flat|apartment)\b/i;
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
/** Nominatim asks every client to say who it is; no personal details. */
const UA = 'CoachTrainingPlanner/1.0 (personal training app)';

// Metres between two points.
/** @param {{ lat: number, lon: number }} a @param {{ lat: number, lon: number }} b */
export function distanceM(a, b) {
  const R = 6371000;
  const rad = (/** @type {number} */ x) => (x * Math.PI) / 180;
  const dp = rad(b.lat - a.lat);
  const dl = rad(b.lon - a.lon);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dl / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/**
 * The stays on the calendar: events that name a stay and carry an address, one per address.
 * @param {Array<{ summary?: string, location?: string | null, start_time?: any, end_time?: any, is_all_day?: boolean }>} events
 * @returns {{ title: string, address: string, from: string, to: string }[]}
 */
export function staysOf(events) {
  /** @type {Map<string, { title: string, address: string, from: string, to: string }>} */
  const out = new Map();
  for (const e of events ?? []) {
    const address = String(e?.location ?? '').trim();
    if (!address || address.length < 8 || !STAY.test(String(e?.summary ?? ''))) continue;
    const from = new Date(e.start_time).toISOString().slice(0, 10);
    const to = new Date(e.end_time ?? e.start_time).toISOString().slice(0, 10);
    const key = address.toLowerCase();
    const had = out.get(key);
    out.set(key, had ? { ...had, from: had.from < from ? had.from : from, to: had.to > to ? had.to : to } : { title: String(e.summary).slice(0, 80), address, from, to });
  }
  return [...out.values()].sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * The address's point and the nearest gyms (fitness centres within ~2 km), nearest first.
 * @param {string} address
 * @param {{ fetch?: typeof fetch, limit?: number, timeoutMs?: number }} [opts]
 * @returns {Promise<{ lat: number, lon: number, gyms: { name: string, m: number, lat: number, lon: number, website: string | null }[] } | null>}
 */
export async function gymsNear(address, { fetch: get = fetch, limit = 3, timeoutMs = 5000 } = {}) {
  const search = async (/** @type {Record<string, string>} */ params) => {
    const u = new URL(NOMINATIM);
    for (const [k, v] of Object.entries({ format: 'json', ...params })) u.searchParams.set(k, v);
    const r = await get(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) throw new Error(`nominatim ${r.status}`);
    return /** @type {any[]} */ (await r.json());
  };
  const [hit] = await search({ q: address, limit: '1' });
  if (!hit) return null;
  const here = { lat: Number(hit.lat), lon: Number(hit.lon) };
  const d = 0.02;
  const viewbox = `${here.lon - d * 1.5},${here.lat + d},${here.lon + d * 1.5},${here.lat - d}`;
  // Nominatim ranks by name, so one query misses gyms called "PureGym" or "Muscleworks": ask a few ways.
  const found = [];
  for (const q of ['gym', 'fitness centre', 'fitness']) {
    found.push(...(await search({ q, viewbox, bounded: '1', limit: '50', extratags: '1' }).catch(() => [])));
  }
  /** @type {Map<string, { name: string, m: number, lat: number, lon: number, website: string | null }>} */
  const gyms = new Map();
  for (const g of found) {
    if (g?.type !== 'fitness_centre') continue;
    const name = String(g.name || String(g.display_name ?? '').split(',')[0]).trim();
    if (!name) continue;
    const at = { lat: Number(g.lat), lon: Number(g.lon) };
    const m = distanceM(here, at);
    if (m > 2000) continue;
    const prev = gyms.get(name);
    if (!prev || m < prev.m) gyms.set(name, { name, m, ...at, website: g.extratags?.website ?? prev?.website ?? null });
    else if (!prev.website && g.extratags?.website) prev.website = g.extratags.website;
  }
  return { ...here, gyms: [...gyms.values()].sort((a, b) => a.m - b.m).slice(0, limit) };
}

/** "440 m" or "1.2 km". @param {number} m */
export function walk(m) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${Math.round(m / 100) / 10} km`;
}
