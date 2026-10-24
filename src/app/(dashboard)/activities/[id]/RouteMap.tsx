'use client';

import { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Palette } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@kobo/web';
import { routePieces } from '@/lib/activity/route-colors.mjs';
import { useActivityHover } from './ActivityHover';

/** One metric the route can be coloured by (route-colors.mjs). */
export type RouteMetric = { key: string; label: string; unit: string; colors: string[]; bins: (number | null)[]; lowText: string; highText: string };
/** The route's points with each metric's colour bins (routeColors). */
export type RouteColored = { points: [number, number][]; metrics: RouteMetric[] };

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
export default function RouteMap({ route, points, color, label, colored }: { route: [number, number][]; points: ([number, number] | null)[] | null; color: string; label: string; colored?: RouteColored | null }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  // The metric the line is coloured by; null is the sport's colour.
  const [metricKey, setMetricKey] = useState<string | null>(null);
  const metric = colored?.metrics.find((m) => m.key === metricKey) ?? null;
  const [failed, setFailed] = useState(false);
  const dark = useDark();
  const { index, range, pinned } = useActivityHover();

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
          // The route coloured by a metric: one piece per run of the same colour, over the plain line.
          instance.addSource('colored', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
          instance.addLayer({ id: 'colored', type: 'line', source: 'colored', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 4 } });
          // The highlighted lap, split or segment: drawn over the route, thicker, with an ink outline.
          const ink = tokenColor(el, 'var(--viz-ink)', '#0b0b0b');
          instance.addSource('range', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
          instance.addLayer({ id: 'range-casing', type: 'line', source: 'range', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': ink, 'line-width': 10 } });
          instance.addLayer({ id: 'range', type: 'line', source: 'range', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': line, 'line-width': 6 } });
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

  // The line in the chosen metric's colours.
  useEffect(() => {
    const m = ready ? map.current : null;
    const src = m?.getSource('colored') as GeoJSONSource | undefined;
    if (!m || !src) return;
    const pieces = metric && colored ? routePieces(colored.points.map(([la, ln]) => [ln, la] as [number, number]), metric.bins) : [];
    src.setData({
      type: 'FeatureCollection',
      features: pieces.map((p) => ({
        type: 'Feature' as const,
        properties: { color: p.bin != null ? (metric?.colors[p.bin] ?? '#a8a79f') : '#a8a79f' },
        geometry: { type: 'LineString' as const, coordinates: p.points },
      })),
    });
  }, [metric, colored, ready]);

  // The highlighted range: its points on the route, and the rest of the route dimmed.
  useEffect(() => {
    const m = ready ? map.current : null;
    const src = m?.getSource('range') as GeoJSONSource | undefined;
    if (!m || !src) return;
    const coords = range && points ? points.slice(range.from, range.to + 1).filter((p): p is [number, number] => p !== null) : [];
    src.setData(
      coords.length > 1
        ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }
        : { type: 'FeatureCollection', features: [] },
    );
    const dim = coords.length > 1;
    m.setPaintProperty('route', 'line-opacity', metric ? 0 : dim ? 0.45 : 1);
    m.setPaintProperty('colored', 'line-opacity', dim ? 0.45 : 1);
    m.setPaintProperty('route-casing', 'line-opacity', dim ? 0.3 : 0.8);
  }, [range, points, ready, metric]);

  // A pinned range zooms the map to it; unpinning shows the whole route again. A preview does not move the map.
  useEffect(() => {
    const m = ready ? map.current : null;
    if (!m) return;
    const coords = pinned && range?.key === pinned && points ? points.slice(range.from, range.to + 1).filter((p): p is [number, number] => p !== null) : [];
    const all = coords.length > 1 ? coords : route.map(([la, ln]) => [ln, la] as [number, number]);
    const lngs = all.map((p) => p[0]);
    const lats = all.map((p) => p[1]);
    m.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 48, maxZoom: 15, duration: 400 });
    // Only the pin moves the map: `range` changes on every row the pointer crosses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned, ready]);

  if (route.length < 2) return null;
  return (
    <div className="relative overflow-hidden rounded-lg border">
      <div ref={box} role="img" aria-label={label} className="h-[300px] w-full bg-muted sm:h-[380px]" />
      {failed && <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">The map did not load.</p>}
      {ready && colored && colored.metrics.length > 0 && <ColorBy metrics={colored.metrics} metric={metric} onChange={setMetricKey} />}
    </div>
  );
}

/** The "Color by" button over the map's top left, and the chosen metric's scale under it. */
function ColorBy({ metrics, metric, onChange }: { metrics: RouteMetric[]; metric: RouteMetric | null; onChange: (key: string | null) => void }) {
  return (
    <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-[29px] items-center gap-1.5 rounded-[4px] bg-white px-2 text-xs font-medium text-neutral-900 shadow-[0_0_0_2px_rgba(0,0,0,0.1)] hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label={`Color the route by: ${metric?.label ?? 'sport'}`}
          >
            <Palette className="size-3.5" aria-hidden />
            {metric?.label ?? 'Color by'}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="z-[60]">
          <DropdownMenuLabel>Color the route by</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={metric?.key ?? 'sport'} onValueChange={(k) => onChange(k === 'sport' ? null : k)}>
            <DropdownMenuRadioItem value="sport">Sport color</DropdownMenuRadioItem>
            {metrics.map((m) => (
              <DropdownMenuRadioItem key={m.key} value={m.key}>{m.label}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {metric && <RouteLegend metric={metric} />}
    </div>
  );
}

/** The scale: the colours low to high, with the ends' values. */
function RouteLegend({ metric }: { metric: RouteMetric }) {
  return (
    <div className="flex items-center gap-1.5 rounded-[4px] bg-white/90 px-2 py-1 text-[11px] tabular-nums text-neutral-700 shadow-[0_0_0_2px_rgba(0,0,0,0.1)]">
      <span>{metric.lowText}</span>
      <span aria-hidden className="flex h-2 w-24 overflow-hidden rounded-full">
        {metric.colors.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
      </span>
      <span>{metric.highText}{metric.unit ? ` ${metric.unit}` : ''}</span>
    </div>
  );
}
