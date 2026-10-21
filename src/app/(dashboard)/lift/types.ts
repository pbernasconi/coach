import type { Tip } from '@/lib/lift-dashboard/overview.mjs';

/** The shape of liftOverview() (src/lib/lift-dashboard/overview.mjs), for the /lift page parts. */
export type Unit = 'kg' | 'lb';
export type LiftPoint = { day: string; sessionId: string; e1rm: number; reps: number; weight: number };
export type MainLift = {
  key: string;
  name: string;
  catalogId?: string | null;
  image?: string | null;
  gif?: string | null;
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
export type Record = LiftPoint & { key: string; name: string; previous: number; catalogId?: string | null; image?: string | null };
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

// The text helpers live in lift-dashboard/text.mjs, shared with the Lift app's API.
export { ago, compact, fmtDay, fmtSets, muscleName, weight } from '@/lib/lift-dashboard/text.mjs';
