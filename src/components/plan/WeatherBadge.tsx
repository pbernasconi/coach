import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun, type LucideIcon } from 'lucide-react';
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

/** A day's forecast: icon, high / low in °C, and the rain chance when it is 30 % or more. */
export default function WeatherBadge({ w, compact = false }: { w: DayWeather; compact?: boolean }) {
  const { label, icon } = weatherOf(w.code);
  const Icon = ICONS[icon] ?? Cloud;
  const rain = w.rain != null && w.rain >= 30 ? `${w.rain}%` : null;
  const text = `${label}, ${w.max}° / ${w.min}°C${w.rain != null ? `, ${w.rain}% rain` : ''}`;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-[var(--viz-ink-2)]" title={text}>
      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-[var(--viz-muted)]" />
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {w.max}°{!compact && <span className="text-[var(--viz-muted)]">/{w.min}°</span>}
        {rain && <span className="ml-1 text-[var(--viz-muted)]">{rain}</span>}
      </span>
    </span>
  );
}
