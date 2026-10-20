import type { Tip } from '@/lib/lift-dashboard/overview.mjs';

/** The shape of liftOverview() (src/lib/lift-dashboard/overview.mjs), for the /lift page parts. */
export type Unit = 'kg' | 'lb';
export type LiftPoint = { day: string; sessionId: string; e1rm: number; reps: number; weight: number };
export type MainLift = {
  key: string;
  name: string;
  sessions: number;
  points: LiftPoint[];
  latest: LiftPoint | null;
  best: LiftPoint | null;
  change: number | null;
  prDay: string | null;
};
export type MuscleRow = { muscle: string; week: number; avg: number; arm: boolean };
export type SessionRow = {
  id: string;
  day: string;
  title: string;
  sets: number;
  volume: number;
  exercises: number;
  minutes: number | null;
  muscles: string[];
  prs: string[];
};
export type Upcoming = { id: string; day: string; title: string; exercises: number; sets: number };
export type Record = LiftPoint & { key: string; name: string; previous: number };
export type Week = { week: string; sessions: number; sets: number; volume: number };
export type CalendarDay = { day: string; future: boolean; sets: number; sessionId: string | null; title: string | null };
export type { Tip };

export type Overview = {
  today: string;
  monday: string;
  unit: Unit;
  strengthTarget: number;
  thisWeek: Week;
  weeks: Week[];
  calendar: CalendarDay[][];
  streak: number;
  hits: number;
  avg8: number;
  last: { id: string; day: string; title: string } | null;
  daysSince: number | null;
  upcoming: Upcoming[];
  sessions: SessionRow[];
  muscles: MuscleRow[];
  lifts: MainLift[];
  prs: Record[];
  ready: { key: string; name: string; day: string }[];
  tips: Tip[];
  totals: { sessions: number; exercises: number; volume: number };
};

/** A 'YYYY-MM-DD' day as text ("Oct 20" by default). */
export function fmtDay(d: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  const [y, m, n] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, n, 12)).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}
export const weight = (v: number, unit: string) => `${Math.round(v).toLocaleString('en-US')} ${unit}`;
export const compact = (v: number) => (v >= 10_000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v).toLocaleString('en-US'));
export const fmtSets = (n: number) => (n % 1 ? n.toFixed(1) : String(n));
export const muscleName = (m: string) => m.charAt(0).toUpperCase() + m.slice(1);
export const ago = (days: number) => (days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`);
