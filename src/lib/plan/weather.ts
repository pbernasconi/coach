import { forecastDays, locationFrom } from './calendar.mjs';

export type Place = { name: string; lat: number; lon: number };
export type DayWeather = { code: number; max: number; min: number; rain: number | null };

/** Used when users.settings has no `location: { name, lat, lon }`. The same home as scripts/coach-profile.mjs. */
export const DEFAULT_PLACE: Place = { name: 'San Francisco, CA', lat: 37.7749, lon: -122.4194 };

export function placeFrom(settings: unknown): Place {
  return locationFrom(settings, DEFAULT_PLACE) as Place;
}

/**
 * The daily forecast for today to today + 15 (Open-Meteo, no key), by local day. Next caches the response for
 * 3 hours. Fails soft: an empty object when Open-Meteo is slow or down.
 */
export async function loadForecast(place: Place, timeZone: string): Promise<Record<string, DayWeather>> {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.searchParams.set('latitude', place.lat.toFixed(3));
  u.searchParams.set('longitude', place.lon.toFixed(3));
  u.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
  u.searchParams.set('timezone', timeZone);
  u.searchParams.set('forecast_days', '16');
  u.searchParams.set('temperature_unit', 'celsius');
  try {
    const r = await fetch(u, { next: { revalidate: 10_800 }, signal: AbortSignal.timeout(3000) });
    if (!r.ok) return {};
    return forecastDays(await r.json()) as Record<string, DayWeather>;
  } catch (e) {
    console.error('Weather failed:', (e as Error).message);
    return {};
  }
}
