'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, Sun, Sunrise, Thermometer, Umbrella, Wind,
  type LucideIcon,
} from 'lucide-react';
import { weatherOf } from '@/lib/plan/calendar.mjs';
import type { DayWeather } from '@/lib/plan/weather';

const ICONS: Record<string, LucideIcon> = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

/**
 * A day's forecast: icon, high (and low) in °C, and the rain chance when it is 30 % or more. Hover, focus or tap
 * it for the day card: sky, the hourly temperature and rain, feels like, wind, humidity, UV and daylight.
 */
export default function WeatherBadge({ w, date, compact = false }: { w: DayWeather; date: string; compact?: boolean }) {
  const { icon } = weatherOf(w.code);
  const Icon = ICONS[icon] ?? Cloud;
  const rain = w.rain != null && w.rain >= 30 ? `${w.rain}%` : null;
  const [open, setOpen] = useState(false);
  const [el, setEl] = useState<HTMLButtonElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const id = useId();
  const show = (on: boolean, wait = on ? 60 : 80) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(on), wait);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !el?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open, el]);

  return (
    <>
      <button
        ref={setEl}
        type="button"
        aria-label={`Weather: ${w.text}, high ${w.max}°, low ${w.min}°C${w.rain != null ? `, ${w.rain}% rain` : ''}`}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => show(true)}
        onMouseLeave={() => show(false)}
        onFocus={() => show(true, 0)}
        onBlur={() => show(false, 0)}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          clearTimeout(timer.current);
          setOpen(true); // a tap opens it; a tap outside, Escape or a scroll closes it
        }}
        className="inline-flex cursor-default items-center gap-1 rounded px-0.5 text-[12px] tabular-nums text-[var(--viz-ink-2)] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-[var(--viz-muted)]" />
        <span aria-hidden>
          {w.max}°{!compact && <span className="text-[var(--viz-muted)]">/{w.min}°</span>}
          {rain && <span className="ml-1 text-[var(--viz-muted)]">{rain}</span>}
        </span>
      </button>
      {open && el && createPortal(<DayCard id={id} w={w} date={date} Icon={Icon} anchor={el} />, document.body)}
    </>
  );
}

const W = 288;

/** The card: placed under the badge (over it when there is no room), inside the window. */
function DayCard({ id, w, date, Icon, anchor }: { id: string; w: DayWeather; date: string; Icon: LucideIcon; anchor: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const a = anchor.getBoundingClientRect();
    const h = ref.current?.offsetHeight ?? 0;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(8, a.right - W), vw - W - 8);
    const below = a.bottom + 6;
    const top = below + h > vh - 8 && a.top - 6 - h > 8 ? a.top - 6 - h : Math.max(8, Math.min(below, vh - h - 8));
    setPos({ left: Math.max(8, left), top });
  }, [anchor]);

  const rows: { key: string; icon: LucideIcon; value: string; label: string }[] = [];
  if (w.feels) rows.push({ key: 'feels', icon: Thermometer, value: span(w.feels, '°'), label: 'feels like' });
  rows.push({ key: 'rain', icon: Umbrella, value: rainText(w), label: rainLabel(w) });
  if (w.wind != null) rows.push({ key: 'wind', icon: Wind, value: `${w.wind} km/h${w.dir ? ` ${w.dir}` : ''}`, label: w.gust != null && w.gust >= w.wind + 5 ? `wind · gusts ${w.gust}` : 'wind' });
  if (w.rh) rows.push({ key: 'rh', icon: Droplets, value: span(w.rh, '%'), label: 'humidity' });
  if (w.uv != null) rows.push({ key: 'uv', icon: Sun, value: String(w.uv), label: `UV · ${uvWord(w.uv)}` });
  if (w.rise && w.set) rows.push({ key: 'sun', icon: Sunrise, value: `${clock(w.rise)} – ${clock(w.set)}`, label: 'daylight' });

  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className="pointer-events-none fixed z-50 rounded-lg border bg-[var(--viz-surface)] px-3.5 py-3 text-xs shadow-lg"
      style={{ width: W, left: pos?.left ?? -9999, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
    >
      <div className="font-medium text-[var(--viz-ink-2)]">{longDay(date)}</div>
      <div className="mt-1.5 flex items-center gap-2">
        <Icon aria-hidden className="h-5 w-5 shrink-0 text-[var(--viz-ink-2)]" />
        <span className="text-base font-semibold tabular-nums text-[var(--viz-ink)]">
          {w.max}°<span className="font-normal text-[var(--viz-muted)]"> / {w.min}°</span>
        </span>
        <span className="min-w-0 truncate text-[var(--viz-ink-2)]">{w.text}</span>
      </div>
      <HourChart temps={w.temps} rains={w.rains} />
      <div className="mt-2 space-y-0.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2 py-0.5">
            <r.icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-[var(--viz-muted)]" />
            <span className="shrink-0 whitespace-nowrap tabular-nums font-medium text-[var(--viz-ink)]">{r.value}</span>
            <span className="truncate text-[var(--viz-muted)]">{r.label}</span>
          </div>
        ))}
      </div>
      {(w.detail || w.night) && (
        <p className="mt-2 line-clamp-4 border-t pt-2 text-[11px] leading-snug text-[var(--viz-ink-2)]">{w.detail ?? w.night}</p>
      )}
      <div className="mt-2 text-[10px] text-[var(--viz-muted)]">{w.src === 'NWS' ? 'National Weather Service forecast' : 'Open-Meteo forecast'}</div>
    </div>
  );
}

/** Temperature through the day (line) over the rain chance (bars), with a label at the high and the low. */
function HourChart({ temps, rains }: { temps: (number | null)[]; rains: (number | null)[] }) {
  const pts = temps.map((t, h) => (t == null ? null : { h, t })).filter((p): p is { h: number; t: number } => p != null);
  if (pts.length < 4) return null;
  const width = W - 28;
  const top = 14;
  const lineH = 34;
  const barH = 18;
  const height = top + lineH + 4 + barH + 14;
  const lo = Math.min(...pts.map((p) => p.t));
  const hi = Math.max(...pts.map((p) => p.t));
  const x = (h: number) => 4 + (h / 23) * (width - 8);
  const y = (t: number) => top + (hi === lo ? lineH / 2 : ((hi - t) / (hi - lo)) * lineH);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.h).toFixed(1)},${y(p.t).toFixed(1)}`).join('');
  const hiP = pts.find((p) => p.t === hi)!;
  const loP = pts.find((p) => p.t === lo)!;
  const barTop = top + lineH + 4;
  const anyRain = rains.some((p) => (p ?? 0) >= 20);
  return (
    <svg className="mt-2.5" width={width} height={height} aria-hidden>
      {[6, 12, 18].map((h) => (
        <line key={h} x1={x(h)} x2={x(h)} y1={top - 4} y2={barTop + barH} stroke="var(--viz-grid)" strokeWidth={1} />
      ))}
      {anyRain &&
        rains.map((p, h) =>
          p != null && p >= 20 ? (
            <rect key={h} x={x(h) - 3} y={barTop + barH - (p / 100) * barH} width={6} height={Math.max(1, (p / 100) * barH)} rx={1.5} fill="var(--viz-ctl)" opacity={0.55} />
          ) : null
        )}
      <path d={line} fill="none" stroke="var(--viz-temp)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <text x={x(hiP.h)} y={y(hi) - 5} textAnchor="middle" className="fill-[var(--viz-ink)] text-[10px] font-semibold">
        {hi}°
      </text>
      {lo !== hi && (
        <text x={x(loP.h)} y={y(lo) - 5} textAnchor="middle" className="fill-[var(--viz-muted)] text-[10px]">
          {lo}°
        </text>
      )}
      {[
        [6, '6a'],
        [12, '12p'],
        [18, '6p'],
      ].map(([h, l]) => (
        <text key={h} x={x(Number(h))} y={height - 2} textAnchor="middle" className="fill-[var(--viz-muted)] text-[10px]">
          {l}
        </text>
      ))}
    </svg>
  );
}

const span = ([a, b]: [number, number], unit: string) => (a === b ? `${a}${unit}` : `${a}–${b}${unit}`);

function rainText(w: DayWeather) {
  const p = w.rain ?? 0;
  if (p < 10 && (w.mm ?? 0) < 0.1) return 'Dry';
  return `${p}%${(w.mm ?? 0) >= 0.1 ? ` · ${w.mm} mm` : ''}`;
}

function rainLabel(w: DayWeather) {
  if ((w.rain ?? 0) < 10 && (w.mm ?? 0) < 0.1) return 'no rain expected';
  const peak = w.rains.reduce<number | null>((a, p, h) => (p != null && (a == null || p > (w.rains[a] ?? -1)) ? h : a), null);
  return peak == null ? 'rain' : `rain · most at ${hourLabel(peak)}`;
}

const uvWord = (uv: number) => (uv < 3 ? 'low' : uv < 6 ? 'moderate' : uv < 8 ? 'high' : uv < 11 ? 'very high' : 'extreme');
const hourLabel = (h: number) => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`);

function clock(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function longDay(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** The forecast as a plain icon and high, for inside another control (no card: a button can't hold a button). */
export function WeatherIcon({ w }: { w: DayWeather }) {
  const Icon = ICONS[weatherOf(w.code).icon] ?? Cloud;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] tabular-nums text-[var(--viz-ink-2)]" title={`${w.text}, ${w.max}°/${w.min}°C${w.rain != null ? `, ${w.rain}% rain` : ''}`}>
      <Icon aria-hidden className="h-3 w-3 shrink-0 text-[var(--viz-muted)]" />
      {w.max}°
    </span>
  );
}
