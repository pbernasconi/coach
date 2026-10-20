// The daily forecast for the plan calendar, from two sources (src/lib/plan/weather.ts fetches them):
//   - Open-Meteo: every hour of 16 days, everywhere (temperature, feels like, rain, wind, gusts, humidity, UV),
//     plus sunrise and sunset.
//   - The US National Weather Service (NWS), for US places: its hourly forecast replaces the Open-Meteo hours it
//     covers (about 7 days), and its 12-hour forecast gives the words for each day.
// One day: { code, max, min, rain, text, detail, night, feels, mm, wind, gust, dir, uv, rh, rise, set, temps, rains, src }.
// °C, km/h, mm, %. `temps` and `rains` hold one value for each hour 0–23 (null when there is none).

import { weatherOf } from './calendar.mjs';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const sentence = (s) => (s ? s.toLowerCase().replace(/^./, (c) => c.toUpperCase()) : null);
const round = (v) => (finite(v) ? Math.round(v) : null);
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compass = (deg) => (finite(deg) ? COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8] : null);

/** The US (lower 48, Alaska, Hawaii): the NWS covers it. */
export function inUS(lat, lon) {
  return (lat > 24 && lat < 50 && lon > -125.5 && lon < -66) || (lat > 51 && lat < 72 && lon > -170 && lon < -129) || (lat > 18.5 && lat < 22.5 && lon > -161 && lon < -154);
}

/** Open-Meteo JSON (hourly + daily, local ISO times) → { hours: [{ date, hour, … }], sun: { date: { rise, set, code } } }. */
export function openMeteoHours(json) {
  const H = json?.hourly;
  const D = json?.daily;
  const hours = [];
  if (H && Array.isArray(H.time)) {
    H.time.forEach((t, i) => {
      const temp = H.temperature_2m?.[i];
      if (!finite(temp)) return;
      hours.push({
        date: t.slice(0, 10),
        hour: Number(t.slice(11, 13)),
        temp,
        feels: H.apparent_temperature?.[i] ?? null,
        p: H.precipitation_probability?.[i] ?? null,
        mm: H.precipitation?.[i] ?? null,
        rh: H.relative_humidity_2m?.[i] ?? null,
        wind: H.wind_speed_10m?.[i] ?? null,
        gust: H.wind_gusts_10m?.[i] ?? null,
        dir: compass(H.wind_direction_10m?.[i]),
        uv: H.uv_index?.[i] ?? null,
      });
    });
  }
  const sun = {};
  if (D && Array.isArray(D.time)) {
    D.time.forEach((date, i) => {
      sun[date] = {
        rise: D.sunrise?.[i]?.slice(11, 16) ?? null,
        set: D.sunset?.[i]?.slice(11, 16) ?? null,
        code: Number(D.weather_code?.[i] ?? D.weathercode?.[i] ?? -1),
      };
    });
  }
  return { hours, sun };
}

/** The local date ('YYYY-MM-DD') and hour of an ISO time in a time zone. */
function localHour(iso, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/** The first number in an NWS wind text ("11 km/h", "4 to 11 km/h": the larger one). */
function windOf(text) {
  const n = String(text ?? '').match(/\d+(\.\d+)?/g);
  return n ? Math.max(...n.map(Number)) : null;
}

/** NWS hourly forecast JSON (units=si) → [{ date, hour, temp, p, rh, wind, dir }]. */
export function nwsHours(json, timeZone) {
  const out = [];
  for (const per of json?.properties?.periods ?? []) {
    if (!finite(per.temperature)) continue;
    const temp = per.temperatureUnit === 'F' ? ((per.temperature - 32) * 5) / 9 : per.temperature;
    out.push({
      ...localHour(per.startTime, timeZone),
      temp,
      p: per.probabilityOfPrecipitation?.value ?? null,
      rh: per.relativeHumidity?.value ?? null,
      wind: windOf(per.windSpeed),
      dir: per.windDirection || null,
    });
  }
  return out;
}

/** A WMO code for an NWS icon URL (".../day/rain_showers,30/bkn?size=medium"): the wetter of its halves. */
export function iconCode(url) {
  const map = (k) =>
    /^tsra/.test(k) ? 95 : /snow|sleet|fzra|blizzard/.test(k) ? 73 : /^rain_showers/.test(k) ? 80 : /^rain/.test(k) ? 63
      : /fog|haze|smoke|dust/.test(k) ? 45 : /ovc/.test(k) ? 3 : /bkn/.test(k) ? 2 : /sct/.test(k) ? 2 : /few/.test(k) ? 1 : /skc|hot|cold/.test(k) ? 0 : null;
  const path = String(url ?? '').split('?')[0].split('/').slice(6);
  const codes = path.map((x) => map(x.split(',')[0])).filter((c) => c != null);
  if (!codes.length) return null;
  return codes.reduce((a, c) => (c >= 45 && (a < 45 || c > a) ? c : a));
}

/** NWS 12-hour forecast JSON → { date: { text, detail, night, code } }. The day period wins; "Tonight" fills a day that has no day period left. */
export function nwsWords(json, timeZone) {
  const out = {};
  for (const per of json?.properties?.periods ?? []) {
    const { date } = localHour(per.startTime, timeZone);
    const d = (out[date] ??= { text: null, detail: null, night: null, code: null });
    if (per.isDaytime || !d.text) {
      d.text = sentence(per.shortForecast) || d.text;
      d.detail = per.detailedForecast || d.detail;
      d.code = iconCode(per.icon) ?? d.code;
    }
    if (!per.isDaytime) d.night = per.detailedForecast || null;
  }
  return out;
}

/**
 * Days from the Open-Meteo hours, with the NWS hours on top where they exist. Feels-like moves with the NWS
 * temperature (the Open-Meteo difference is kept). Days with fewer than 6 hours are left out.
 * @param {{ om: { hours: any[], sun: Record<string, any> }, nws?: any[], words?: Record<string, any> }} args
 */
export function forecastFrom({ om, nws = [], words = {} }) {
  const nwsAt = new Map(nws.map((h) => [`${h.date}T${h.hour}`, h]));
  const byDate = new Map();
  for (const o of om.hours) {
    const n = nwsAt.get(`${o.date}T${o.hour}`);
    const h = n
      ? {
          ...o,
          temp: n.temp,
          feels: finite(o.feels) ? n.temp + (o.feels - o.temp) : n.temp,
          p: n.p ?? o.p,
          rh: n.rh ?? o.rh,
          wind: n.wind ?? o.wind,
          // NWS hours have no gusts: keep the Open-Meteo gust factor at the NWS wind speed.
          gust: finite(o.gust) && finite(n.wind) ? Math.max(n.wind, o.wind > 0 ? (o.gust * n.wind) / o.wind : n.wind) : o.gust,
          dir: n.dir ?? o.dir,
          nws: true,
        }
      : o;
    if (!byDate.has(o.date)) byDate.set(o.date, []);
    byDate.get(o.date).push(h);
  }
  const out = {};
  for (const [date, hs] of byDate) {
    if (hs.length < 6) continue;
    const vals = (k) => hs.map((h) => h[k]).filter(finite);
    const span = (k) => {
      const v = vals(k);
      return v.length ? [Math.round(Math.min(...v)), Math.round(Math.max(...v))] : null;
    };
    const temps = vals('temp');
    const w = words[date];
    const windiest = hs.reduce((a, h) => ((h.wind ?? -1) > (a?.wind ?? -1) ? h : a), null);
    const mm = vals('mm');
    const code = w?.code ?? om.sun[date]?.code ?? -1;
    const temp24 = Array(24).fill(null);
    const rain24 = Array(24).fill(null);
    for (const h of hs) {
      temp24[h.hour] = round(h.temp);
      rain24[h.hour] = round(h.p);
    }
    out[date] = {
      code,
      max: Math.round(Math.max(...temps)),
      min: Math.round(Math.min(...temps)),
      rain: vals('p').length ? Math.round(Math.max(...vals('p'))) : null,
      text: w?.text ?? weatherOf(code).label,
      detail: w?.detail ?? null,
      night: w?.night ?? null,
      feels: span('feels'),
      mm: mm.length ? Math.round(mm.reduce((a, b) => a + b, 0) * 10) / 10 : null,
      wind: round(windiest?.wind),
      gust: vals('gust').length ? Math.round(Math.max(...vals('gust'))) : null,
      dir: windiest?.dir ?? null,
      uv: vals('uv').length ? Math.round(Math.max(...vals('uv'))) : null,
      rh: span('rh'),
      rise: om.sun[date]?.rise ?? null,
      set: om.sun[date]?.set ?? null,
      temps: temp24,
      rains: rain24,
      src: hs.some((h) => h.nws) ? 'NWS' : 'Open-Meteo',
    };
  }
  return out;
}
