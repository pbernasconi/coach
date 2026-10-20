// A small intervals.icu API client: planned workout events. Auth is Basic with the user name "API_KEY" and the
// athlete's personal key (intervals.icu → Settings → Developer settings). API: https://intervals.icu/api/v1/docs.
// Env: INTERVALS_API_KEY, INTERVALS_ATHLETE_ID ("i12345"). docs/research/structured-workouts.md §6.

const BASE = 'https://intervals.icu/api/v1';

/** The client for the configured athlete, or null when the env is not set (the sync then does nothing). */
export function intervalsClient(env = process.env, fetchFn = fetch) {
  const key = env.INTERVALS_API_KEY;
  const athlete = env.INTERVALS_ATHLETE_ID;
  if (!key || !athlete) return null;
  const auth = `Basic ${Buffer.from(`API_KEY:${key}`).toString('base64')}`;
  async function call(method, path, body) {
    const res = await fetchFn(`${BASE}/athlete/${encodeURIComponent(athlete)}${path}`, {
      method,
      headers: { authorization: auth, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 404 && method === 'DELETE') return null; // already gone
    const text = await res.text();
    if (!res.ok) throw new Error(`intervals.icu ${method} ${path}: ${res.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }
  return {
    athlete,
    create: (event) => call('POST', '/events', event),
    update: (id, event) => call('PUT', `/events/${encodeURIComponent(id)}`, event),
    remove: (id) => call('DELETE', `/events/${encodeURIComponent(id)}`),
    get: (id) => call('GET', `/events/${encodeURIComponent(id)}`),
    list: (oldest, newest) => call('GET', `/events?oldest=${oldest}&newest=${newest}`),
  };
}
