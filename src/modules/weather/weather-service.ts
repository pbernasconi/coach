/**
 * Weather Service
 * Thin client over Open-Meteo (https://open-meteo.com/) — no API key required.
 * Returns a normalized daily forecast for use in chat context + training-plan generation.
 */

import type { DailyForecast, TemperatureUnit, WeatherForecast } from './weather-types';

const WMO_CODE_LABELS: Record<number, string> = {
  0: 'clear',
  1: 'mostly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'freezing fog',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'heavy drizzle',
  56: 'freezing drizzle',
  57: 'freezing drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  66: 'freezing rain',
  67: 'freezing rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  77: 'snow grains',
  80: 'showers',
  81: 'showers',
  82: 'heavy showers',
  85: 'snow showers',
  86: 'heavy snow showers',
  95: 'thunderstorm',
  96: 'thunderstorm w/ hail',
  99: 'severe thunderstorm',
};

interface FetchOpts {
  latitude: number;
  longitude: number;
  label?: string;
  days?: number; // 1-16, default 7
  unit?: TemperatureUnit; // default celsius
  timezone?: string; // default 'auto'
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const cache = new Map<string, { value: WeatherForecast; expiresAt: number }>();

class WeatherService {
  async getForecast(opts: FetchOpts): Promise<WeatherForecast> {
    const {
      latitude,
      longitude,
      label,
      days = 7,
      unit = 'celsius',
      timezone = 'auto',
    } = opts;

    const cacheKey = `${latitude.toFixed(3)}|${longitude.toFixed(3)}|${days}|${unit}|${timezone}`;
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set(
      'daily',
      [
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'precipitation_probability_max',
        'weather_code',
        'wind_speed_10m_max',
      ].join(','),
    );
    url.searchParams.set('timezone', timezone);
    url.searchParams.set('forecast_days', String(days));
    url.searchParams.set('temperature_unit', unit);
    url.searchParams.set('wind_speed_unit', 'kmh');

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Open-Meteo request failed: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as {
      daily: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum: number[];
        precipitation_probability_max: (number | null)[];
        weather_code: number[];
        wind_speed_10m_max: number[];
      };
    };

    const daily: DailyForecast[] = json.daily.time.map((date, i) => ({
      date,
      tempMin: round(json.daily.temperature_2m_min[i]),
      tempMax: round(json.daily.temperature_2m_max[i]),
      precipMm: round(json.daily.precipitation_sum[i] ?? 0, 1),
      precipChance: json.daily.precipitation_probability_max[i] ?? 0,
      windKph: round(json.daily.wind_speed_10m_max[i]),
      conditions: WMO_CODE_LABELS[json.daily.weather_code[i]] ?? `code ${json.daily.weather_code[i]}`,
      weatherCode: json.daily.weather_code[i],
    }));

    const forecast: WeatherForecast = {
      location: { latitude, longitude, label },
      unit,
      daily,
      fetchedAt: new Date().toISOString(),
    };

    cache.set(cacheKey, { value: forecast, expiresAt: Date.now() + CACHE_TTL_MS });
    return forecast;
  }

  /**
   * Format a forecast for inclusion in an AI prompt.
   * Compact, deterministic, one line per day.
   */
  formatForPrompt(forecast: WeatherForecast): string {
    const unitSymbol = forecast.unit === 'celsius' ? '°C' : '°F';
    const lines = forecast.daily.map((d) => {
      return `- ${d.date}: ${d.tempMin}–${d.tempMax}${unitSymbol}, ${d.conditions}, ${d.precipChance}% precip (${d.precipMm}mm), wind ${d.windKph}kmh`;
    });
    const loc = forecast.location.label
      ? `${forecast.location.label} (${forecast.location.latitude}, ${forecast.location.longitude})`
      : `${forecast.location.latitude}, ${forecast.location.longitude}`;
    return `Weather forecast for ${loc}:\n${lines.join('\n')}`;
  }
}

function round(n: number, places = 0): number {
  const m = Math.pow(10, places);
  return Math.round(n * m) / m;
}

const weatherService = new WeatherService();
export default weatherService;
