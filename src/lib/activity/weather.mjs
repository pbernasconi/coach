// Weather for an activity: the Open-Meteo hour at its start, and WMO weather codes as words. No framework or
// database imports, so node --test can run it (weather.test.mjs).

/**
 * The hourly values at the hour nearest `startIso`, from an Open-Meteo response with `timezone=GMT`.
 * @returns {{ time: string, code: number | null, tempC: number | null, feelsLikeC: number | null, humidityPct: number | null,
 *             windKmh: number | null, windDeg: number | null, precipMm: number | null } | null}
 */
export function pickHour(body, startIso) {
  const h = body?.hourly;
  if (!h?.time?.length) return null;
  const at = Date.parse(startIso);
  if (!Number.isFinite(at)) return null;
  let best = -1;
  let bestDiff = Infinity;
  for (let i = 0; i < h.time.length; i++) {
    const t = Date.parse(`${h.time[i]}:00Z`);
    const diff = Math.abs(t - at);
    if (diff < bestDiff) { best = i; bestDiff = diff; }
  }
  if (best < 0 || bestDiff > 90 * 60_000) return null;
  const v = (k) => (typeof h[k]?.[best] === 'number' ? h[k][best] : null);
  if (v('temperature_2m') == null) return null; // the archive has no data for this hour yet
  return {
    time: `${h.time[best]}:00Z`,
    code: v('weather_code'),
    tempC: v('temperature_2m'),
    feelsLikeC: v('apparent_temperature'),
    humidityPct: v('relative_humidity_2m'),
    windKmh: v('wind_speed_10m'),
    windDeg: v('wind_direction_10m'),
    precipMm: v('precipitation'),
  };
}

const CODES = [
  [[0], 'Clear'], [[1], 'Mostly clear'], [[2], 'Partly cloudy'], [[3], 'Cloudy'], [[45, 48], 'Fog'],
  [[51, 53, 55, 56, 57], 'Drizzle'], [[61, 63, 65, 66, 67, 80, 81, 82], 'Rain'], [[71, 73, 75, 77, 85, 86], 'Snow'],
  [[95, 96, 99], 'Thunderstorm'],
];

/** A WMO weather code (Open-Meteo) as a word. */
export function weatherLabel(code) {
  if (code == null) return 'Unknown';
  return CODES.find(([codes]) => codes.includes(code))?.[1] ?? 'Unknown';
}

/** A wind direction in degrees (where the wind comes from) as a compass point: 0 → 'N', 225 → 'SW'. */
export function compass(deg) {
  if (deg == null || !Number.isFinite(deg)) return '';
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return points[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

/** 'Suwa, Japan' from a Nominatim reverse-geocode response (zoom 10, English), or null. */
export function placeName(body) {
  const a = body?.address;
  if (!a) return null;
  const local = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? a.state ?? a.province ?? body.name;
  return [local, a.country].filter(Boolean).join(', ') || null;
}
