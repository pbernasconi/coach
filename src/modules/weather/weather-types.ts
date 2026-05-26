/**
 * Weather Types
 * Shapes for the Open-Meteo forecast we consume.
 */

export type TemperatureUnit = 'celsius' | 'fahrenheit';

export interface DailyForecast {
  date: string; // ISO date, e.g. "2026-05-25"
  tempMin: number;
  tempMax: number;
  precipMm: number;
  precipChance: number; // 0-100
  windKph: number;
  conditions: string; // human-readable summary, e.g. "fog", "partly cloudy"
  weatherCode: number; // raw WMO code
}

export interface WeatherForecast {
  location: { latitude: number; longitude: number; label?: string };
  unit: TemperatureUnit;
  daily: DailyForecast[];
  fetchedAt: string; // ISO
}
