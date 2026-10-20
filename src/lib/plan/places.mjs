// Place search for the /plan weather location (Settings). Open-Meteo geocoding, free and with no key. No framework
// or database imports, so node --test can run it (places.test.mjs).

/** The Open-Meteo geocoding URL for a name search. */
export function geocodeUrl(query, count = 6) {
  const u = new URL('https://geocoding-api.open-meteo.com/v1/search');
  u.searchParams.set('name', String(query).trim().slice(0, 80));
  u.searchParams.set('count', String(count));
  u.searchParams.set('language', 'en');
  u.searchParams.set('format', 'json');
  return u.toString();
}

/** "San Francisco, California, United States": the name, the region when it differs, and the country. */
export function placeLabel(hit) {
  const parts = [hit.name, hit.admin1 !== hit.name ? hit.admin1 : null, hit.country ?? hit.country_code];
  return parts.filter((p) => typeof p === 'string' && p).join(', ');
}

/** Open-Meteo geocoding JSON → [{ name, lat, lon, timezone }], dropping hits without coordinates. */
export function placesFrom(json) {
  const results = Array.isArray(json?.results) ? json.results : [];
  return results
    .filter((h) => Number.isFinite(h?.latitude) && Number.isFinite(h?.longitude) && typeof h?.name === 'string')
    .map((h) => ({ name: placeLabel(h), lat: Math.round(h.latitude * 1e4) / 1e4, lon: Math.round(h.longitude * 1e4) / 1e4, timezone: h.timezone ?? null }));
}
