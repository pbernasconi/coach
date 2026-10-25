import { locationFrom } from './calendar.mjs';
import { forecastFrom, inUS, nwsHours, nwsWords, openMeteoHours } from './forecast.mjs';

export type Place = { name: string; lat: number; lon: number };
/** One day of the forecast (src/lib/plan/forecast.mjs). °C, km/h, mm, %; `temps` and `rains` are hours 0–23. */
export type DayWeather = {
  code: number;
  max: number;
  min: number;
  rain: number | null;
  text: string;
  detail: string | null;
  night: string | null;
  feels: [number, number] | null;
  mm: number | null;
  wind: number | null;
  gust: number | null;
  dir: string | null;
  uv: number | null;
  rh: [number, number] | null;
  rise: string | null;
  set: string | null;
  temps: (number | null)[];
  rains: (number | null)[];
  src: 'NWS' | 'Open-Meteo';
};

/** Used when users.settings has no `location: { name, lat, lon }`. The same home as the planner's profile (src/lib/planner/profile.mjs). */
export const DEFAULT_PLACE: Place = { name: 'San Francisco, CA', lat: 37.7749, lon: -122.4194 };

export function placeFrom(settings: unknown): Place {
  return locationFrom(settings, DEFAULT_PLACE) as Place;
}

// api.weather.gov asks each client to name itself in User-Agent.
const NWS_HEADERS = { 'User-Agent': 'coach (github.com/pbernasconi/coach)', Accept: 'application/geo+json' };
const NWS_WAIT = 3000;

async function getJson(url: string | URL, revalidate: number, ms: number, headers?: Record<string, string>) {
  const r = await fetch(url, { headers, next: { revalidate }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${r.status} ${String(url).split('?')[0]}`);
  return r.json();
}

function openMeteo(place: Place, timeZone: string) {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.searchParams.set('latitude', place.lat.toFixed(3));
  u.searchParams.set('longitude', place.lon.toFixed(3));
  u.searchParams.set(
    'hourly',
    'temperature_2m,apparent_temperature,precipitation_probability,precipitation,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,uv_index'
  );
  u.searchParams.set('daily', 'weather_code,sunrise,sunset');
  u.searchParams.set('timezone', timeZone);
  u.searchParams.set('forecast_days', '16');
  u.searchParams.set('wind_speed_unit', 'kmh');
  return getJson(u, 3600, 3000);
}

/** The NWS hourly and 12-hour forecasts for a US place. The grid point for a place does not change: cached a week. */
async function nws(place: Place, timeZone: string) {
  const point = await getJson(`https://api.weather.gov/points/${place.lat.toFixed(4)},${place.lon.toFixed(4)}`, 604_800, 2500, NWS_HEADERS);
  const { forecast, forecastHourly } = point.properties ?? {};
  if (!forecast || !forecastHourly) throw new Error('NWS has no forecast for this point');
  const [hourly, words] = await Promise.all([
    getJson(`${forecastHourly}?units=si`, 1800, 2500, NWS_HEADERS),
    getJson(`${forecast}?units=si`, 1800, 2500, NWS_HEADERS).catch(() => null),
  ]);
  return { hours: nwsHours(hourly, timeZone), words: words ? nwsWords(words, timeZone) : {} };
}

/**
 * The forecast for today to today + 15, by local day. US places: the NWS forecast for about 7 days, Open-Meteo
 * after that and for what the NWS does not give (gusts, UV, rain amount, sunrise). Next caches each response
 * (NWS 30 min, Open-Meteo 1 h). Fails soft: Open-Meteo alone when the NWS is slow or down, and an empty object
 * when Open-Meteo is down.
 */
export async function loadForecast(place: Place, timeZone: string): Promise<Record<string, DayWeather>> {
  const us = inUS(place.lat, place.lon);
  const nwsPart = us
    ? Promise.race([
        nws(place, timeZone),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), NWS_WAIT)),
      ]).catch((e) => {
        console.error('NWS weather failed:', (e as Error).message);
        return null;
      })
    : Promise.resolve(null);
  try {
    const [omJson, n] = await Promise.all([openMeteo(place, timeZone), nwsPart]);
    return forecastFrom({ om: openMeteoHours(omJson), nws: n?.hours, words: n?.words }) as Record<string, DayWeather>;
  } catch (e) {
    console.error('Weather failed:', (e as Error).message);
    return {};
  }
}
