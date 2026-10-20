import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forecastFrom, iconCode, inUS, nwsHours, nwsWords, openMeteoHours } from './forecast.mjs';

const TZ = 'America/Los_Angeles';

/** Open-Meteo JSON for one day: 24 hours, 10–20 °C, rain at 15:00. */
function omJson(date = '2026-10-21') {
  const time = Array.from({ length: 24 }, (_, h) => `${date}T${String(h).padStart(2, '0')}:00`);
  return {
    hourly: {
      time,
      temperature_2m: time.map((_, h) => 10 + (h >= 12 && h <= 16 ? 10 : h / 3)),
      apparent_temperature: time.map((_, h) => 8 + (h >= 12 && h <= 16 ? 10 : h / 3)),
      precipitation_probability: time.map((_, h) => (h === 15 ? 70 : 5)),
      precipitation: time.map((_, h) => (h === 15 ? 1.2 : 0)),
      relative_humidity_2m: time.map(() => 80),
      wind_speed_10m: time.map((_, h) => (h === 14 ? 25 : 8)),
      wind_gusts_10m: time.map((_, h) => (h === 14 ? 40 : 15)),
      wind_direction_10m: time.map(() => 225),
      uv_index: time.map((_, h) => (h === 13 ? 4.4 : 0)),
    },
    daily: { time: [date], weather_code: [61], sunrise: [`${date}T07:25`], sunset: [`${date}T18:25`] },
  };
}

test('inUS covers the lower 48, Alaska and Hawaii, and not Europe', () => {
  assert.equal(inUS(37.77, -122.42), true);
  assert.equal(inUS(61.2, -149.9), true);
  assert.equal(inUS(21.3, -157.8), true);
  assert.equal(inUS(46.2, 6.1), false);
});

test('an Open-Meteo day: high, low, rain, wind, UV, sunrise and the hour arrays', () => {
  const d = forecastFrom({ om: openMeteoHours(omJson()) })['2026-10-21'];
  assert.equal(d.max, 20);
  assert.equal(d.min, 10);
  assert.equal(d.rain, 70);
  assert.equal(d.mm, 1.2);
  assert.equal(d.wind, 25);
  assert.equal(d.gust, 40);
  assert.equal(d.dir, 'SW');
  assert.equal(d.uv, 4);
  assert.deepEqual(d.rh, [80, 80]);
  assert.equal(d.rise, '07:25');
  assert.equal(d.set, '18:25');
  assert.equal(d.text, 'Rain');
  assert.equal(d.src, 'Open-Meteo');
  assert.equal(d.temps.length, 24);
  assert.equal(d.rains[15], 70);
});

test('NWS hours replace the Open-Meteo hours they cover, by local hour', () => {
  const nws = nwsHours(
    {
      properties: {
        periods: [
          // 22:00 UTC = 15:00 in Los Angeles (PDT).
          { startTime: '2026-10-21T22:00:00+00:00', temperature: 24, temperatureUnit: 'C', probabilityOfPrecipitation: { value: 90 }, relativeHumidity: { value: 60 }, windSpeed: '4 to 30 km/h', windDirection: 'W' },
        ],
      },
    },
    TZ
  );
  assert.deepEqual(nws[0], { date: '2026-10-21', hour: 15, temp: 24, p: 90, rh: 60, wind: 30, dir: 'W' });
  const d = forecastFrom({ om: openMeteoHours(omJson()), nws })['2026-10-21'];
  assert.equal(d.max, 24);
  assert.equal(d.rain, 90);
  assert.equal(d.wind, 30);
  assert.equal(d.dir, 'W');
  assert.deepEqual(d.feels, [8, 22]); // feels like keeps the Open-Meteo gap (2°) at the NWS temperature
  assert.equal(d.src, 'NWS');
});

test('NWS words: the day period wins, the night goes to `night`', () => {
  const words = nwsWords(
    {
      properties: {
        periods: [
          { startTime: '2026-10-21T06:00:00-07:00', isDaytime: true, shortForecast: 'Rain Showers Likely', detailedForecast: 'Rain showers likely. High near 16.', icon: 'https://api.weather.gov/icons/land/day/rain_showers,60/bkn?size=medium' },
          { startTime: '2026-10-21T18:00:00-07:00', isDaytime: false, shortForecast: 'Mostly Cloudy', detailedForecast: 'Mostly cloudy, low around 12.', icon: 'https://api.weather.gov/icons/land/night/bkn?size=medium' },
        ],
      },
    },
    TZ
  );
  assert.deepEqual(words['2026-10-21'], { text: 'Rain showers likely', detail: 'Rain showers likely. High near 16.', night: 'Mostly cloudy, low around 12.', code: 80 });
  const d = forecastFrom({ om: openMeteoHours(omJson()), words })['2026-10-21'];
  assert.equal(d.text, 'Rain showers likely');
  assert.equal(d.code, 80);
});

test('iconCode reads the wetter half of an NWS icon', () => {
  assert.equal(iconCode('https://api.weather.gov/icons/land/night/rain_showers,30/rain_showers,50?size=medium'), 80);
  assert.equal(iconCode('https://api.weather.gov/icons/land/day/few?size=medium'), 1);
  assert.equal(iconCode('https://api.weather.gov/icons/land/day/tsra,40?size=medium'), 95);
  assert.equal(iconCode(''), null);
});

test('bad or empty input gives no days', () => {
  assert.deepEqual(forecastFrom({ om: openMeteoHours(null) }), {});
  assert.deepEqual(nwsHours(null, TZ), []);
  assert.deepEqual(nwsWords(undefined, TZ), {});
});
