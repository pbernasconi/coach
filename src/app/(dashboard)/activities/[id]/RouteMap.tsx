'use client';

import { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useActivityHover } from './ActivityHover';

// OpenFreeMap: free vector tiles, no key. The dark style follows the app's .dark class (the token switch).
const STYLE = { light: 'https://tiles.openfreemap.org/styles/liberty', dark: 'https://tiles.openfreemap.org/styles/dark' };

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.classList.contains('dark'));
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

/** A computed CSS color for a token (MapLibre paints on a canvas and cannot read var()). */
function tokenColor(el: HTMLElement, token: string, fallback: string) {
  const name = /^var\((--[^)]+)\)$/.exec(token)?.[1];
  const v = name ? getComputedStyle(el).getPropertyValue(name).trim() : token;
  return v || fallback;
}

/**
 * The route on an OpenFreeMap map, in the sport's color, with start and end markers. `points` are the chart's
 * series points ([lng, lat] or null), so the hovered chart index places the dot. `route` is the full line.
 */
export default function RouteMap({ route, points, color, label }: { route: [number, number][]; points: ([number, number] | null)[] | null; color: string; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const dark = useDark();
  const { index } = useActivityHover();

  useEffect(() => {
    const el = box.current;
    if (!el || route.length < 2) return;
    let cancelled = false;
    let instance: MapLibreMap | null = null;
    let ro: ResizeObserver | null = null;
    (async () => {
      try {
        const maplibre = await import('maplibre-gl');
        if (cancelled) return;
        // The bundler does not emit MapLibre's module worker, so load the same version's worker from jsDelivr.
        maplibre.setWorkerUrl(`https://cdn.jsdelivr.net/npm/maplibre-gl@${maplibre.getVersion()}/dist/maplibre-gl-worker.mjs`);
        const lngs = route.map((p) => p[1]);
        const lats = route.map((p) => p[0]);
        const bounds: [[number, number], [number, number]] = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
        instance = new maplibre.Map({
          container: el,
          style: dark ? STYLE.dark : STYLE.light,
          bounds,
          fitBoundsOptions: { padding: 32, maxZoom: 15 },
          attributionControl: { compact: true },
          cooperativeGestures: true,
        });
        instance.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
        // The box can change size after the map is made (grid layout, phone rotation): keep the canvas in step.
        ro = new ResizeObserver(() => instance?.resize());
        ro.observe(el);
        map.current = instance;
        const line = tokenColor(el, color, '#eb6834');
        instance.on('load', () => {
          if (!instance) return;
          instance.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route.map(([la, ln]) => [ln, la]) } } });
          instance.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.8 } });
          instance.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': line, 'line-width': 3.5 } });
          const ends = {
            type: 'FeatureCollection' as const,
            features: [
              { type: 'Feature' as const, properties: { kind: 'start' }, geometry: { type: 'Point' as const, coordinates: [route[0][1], route[0][0]] } },
              { type: 'Feature' as const, properties: { kind: 'end' }, geometry: { type: 'Point' as const, coordinates: [route[route.length - 1][1], route[route.length - 1][0]] } },
            ],
          };
          instance.addSource('ends', { type: 'geojson', data: ends });
          instance.addLayer({
            id: 'ends', type: 'circle', source: 'ends',
            paint: { 'circle-radius': 6, 'circle-color': ['match', ['get', 'kind'], 'start', '#0ca30c', '#d03b3b'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
          });
          instance.addSource('hover', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
          instance.addLayer({ id: 'hover', type: 'circle', source: 'hover', paint: { 'circle-radius': 7, 'circle-color': line, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 } });
          instance.resize();
          instance.fitBounds(bounds, { padding: 32, maxZoom: 15, duration: 0 });
          setReady(true);
        });
        instance.on('error', (e) => console.warn('Map:', e.error?.message ?? e));
      } catch (e) {
        console.error('Map failed:', e);
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      setReady(false);
      instance?.remove();
      map.current = null;
    };
  }, [route, color, dark]);

  useEffect(() => {
    const src = ready ? (map.current?.getSource('hover') as GeoJSONSource | undefined) : undefined;
    if (!src) return;
    const p = index != null ? points?.[index] : null;
    src.setData({ type: 'FeatureCollection', features: p ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }] : [] });
  }, [index, points, ready]);

  if (route.length < 2) return null;
  return (
    <div className="relative overflow-hidden rounded-lg border">
      <div ref={box} role="img" aria-label={label} className="h-[300px] w-full bg-muted sm:h-[380px]" />
      {failed && <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">The map did not load.</p>}
    </div>
  );
}
