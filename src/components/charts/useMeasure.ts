'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * The element's content width, kept current with a ResizeObserver. Charts draw in real pixels. `min` keeps a
 * hidden element (width 0) from giving negative plot sizes; a sparkline in a phone's two-column grid is narrower
 * than the default, so it passes a smaller one.
 */
export function useMeasure<T extends HTMLElement>(initial = 640, min = 240) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(min, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return [ref, width] as const;
}

/** Clean axis ticks from 0 to at least `max`: steps of 1, 2, 2.5 or 5 times a power of ten. */
export function niceTicks(max: number, count = 4, min = 0) {
  const span = Math.max(1e-9, max - min);
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}
