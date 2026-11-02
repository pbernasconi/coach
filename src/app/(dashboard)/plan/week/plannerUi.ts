import type { CSSProperties } from 'react';
import type { DraftEvent } from '@/lib/plan/planner-week';
import { addDays } from '@/lib/plan/week.mjs';

/** The sport colour of a draft session (physio reads as mobility, pink). */
export function sportVar(e: Pick<DraftEvent, 'sport' | 'title'>): string {
  if (/physio|stretch|mobility/i.test(e.title)) return 'var(--sport-yoga)';
  return `var(--sport-${['ride', 'run', 'strength', 'swim', 'walk', 'hike', 'yoga'].includes(e.sport) ? e.sport : 'other'})`;
}

/** A tinted card in the session's sport colour. */
export function sportStyle(e: Pick<DraftEvent, 'sport' | 'title'>): CSSProperties {
  const c = sportVar(e);
  return { borderLeftColor: c, background: `color-mix(in oklab, ${c} 13%, var(--color-card))`, color: `color-mix(in oklab, ${c} 70%, var(--color-foreground))` };
}

export const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const timeOf = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const clock = (t: string | null) => (t ? `${Number(t.slice(0, 2))}:${t.slice(3, 5)}` : '');

/** 75 → "1h15", 40 → "40 min". */
export function hm(min: number | null | undefined): string {
  const m = Math.round(min ?? 0);
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m / 60}h`;
}

const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { ...o, timeZone: 'UTC' });
export const weekday = (d: string) => fmt(d, { weekday: 'short' });
export const dayNum = (d: string) => Number(d.slice(8));
/** "Nov 2–8" or "Oct 27 – Nov 2". */
export function weekLabel(monday: string): string {
  const end = addDays(monday, 6);
  const a = fmt(monday, { month: 'short', day: 'numeric' });
  return monday.slice(5, 7) === end.slice(5, 7) ? `${a}–${dayNum(end)}` : `${a} – ${fmt(end, { month: 'short', day: 'numeric' })}`;
}

export const days = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));
