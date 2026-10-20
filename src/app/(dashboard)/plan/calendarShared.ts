import type { WeekSummary } from '@/lib/plan/month';
import type { Item, PreviewTarget } from './ItemPreview';

/** The fixed week row height (also --plan-row in plan.css) and the grid columns: 7 equal days and the week column. */
export const ROW_H = 'h-[9.5rem]';
export const COLS = 'grid grid-cols-[repeat(7,minmax(0,1fr))_9.5rem]';

export { hm } from '@/lib/plan/week-api.mjs';
export const monthTitle = (month: string) =>
  new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const monthShort = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
export const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
export const longDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
export const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

export type Day = { date: string; items: Item[] };
export type WeekRow = { monday: string; days: Day[]; summary: WeekSummary | null };
/** Stable callbacks for the memoized rows (they read the latest state through refs). */
export type Handlers = {
  drop: (e: React.DragEvent, date: string) => void;
  over: (date: string) => void;
  leave: (date: string) => void;
  /** Opens the preview card for an item or a day, next to the clicked element. */
  open: (target: PreviewTarget, anchor: HTMLElement) => void;
  /** The day menu and the "+": add a workout, copy or paste the day's planned workouts, or delete them. */
  day: (date: string, action: DayAction) => void;
};
export type DayAction = 'add' | 'copy' | 'paste' | 'clear';
