/**
 * The data of the cards Coach shows in the chat (cards.mjs names them): each kind reuses the App API loader the phone
 * already reads, so the card matches the rest of the app. Resolved when Coach answers and stored with the message,
 * so the thread shows what Coach saw then. A card that can't be filled is left out.
 */

import { homeEvents } from '@/lib/calendar-sync/events';
import { loadAppLiftExercise, loadAppLiftSession } from '@/lib/lift-dashboard/app-api';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { loadAppToday } from '@/lib/performance/app-pages';
import { loadLiftWeeks } from '@/lib/plan/week-api';
import { addDays, mondayOf } from '@/lib/plan/week.mjs';
import { sql } from '@/db';
import { sportOfStrava } from '@/lib/plan/week.mjs';
import { breakdownCard, breakdownSpan, dayTimeline, type CardRef } from './cards.mjs';
import type { PlanRow } from './changes.mjs';

type Json = Record<string, unknown>;
export type Attachment = { kind: CardRef['kind'] } & Json;

/** Fitness days kept on a readiness card: the last six weeks, plus what is projected. */
const FITNESS_DAYS = 42;

/** Midnight of `date` in `timeZone`, as an instant. */
function startOfDay(date: string, timeZone: string): Date {
  const noon = new Date(`${date}T12:00:00Z`);
  const local = new Date(noon.toLocaleString('en-US', { timeZone }));
  const offset = noon.getTime() - local.getTime();
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + offset);
}

async function weekOf(userId: string, date: string, today: string, timeZone: string) {
  const body = await loadLiftWeeks(userId, mondayOf(date), 1, today, timeZone);
  return (body.weeks[0] ?? null) as Json | null;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** The exercise as it is in the next planned Lift session that has it (else the latest one), with its history. */
async function exerciseCard(userId: string, name: string, today: string, timeZone: string) {
  const { model } = await loadLiftModel();
  const want = norm(name);
  type SE = { sessionId: string; key: string; name: string };
  const all = [...(model.sessionExercises.values() as Iterable<SE>)];
  const matches = all.filter((se) => norm(se.name) === want);
  const found = matches.length ? matches : all.filter((se) => norm(se.name).includes(want) || want.includes(norm(se.name)));
  if (!found.length) return null;
  type S = { id: string; day: string; finishedAt: string | null };
  const sessions = found
    .map((se) => ({ se, s: model.sessions.get(se.sessionId) as S | undefined }))
    .filter((x): x is { se: SE; s: S } => Boolean(x.s));
  const next = sessions.filter((x) => !x.s.finishedAt && x.s.day >= today).sort((a, b) => a.s.day.localeCompare(b.s.day))[0];
  const pick = next ?? sessions.sort((a, b) => b.s.day.localeCompare(a.s.day))[0];
  if (!pick) return null;
  const [session, detail] = await Promise.all([
    loadAppLiftSession(userId, pick.s.id, today, timeZone),
    loadAppLiftExercise(pick.se.key),
  ]);
  const items = ((session as Json | null)?.exercises as { items?: Json[] } | undefined)?.items ?? [];
  const item = items.find((i) => i.exerciseKey === pick.se.key) ?? items.find((i) => norm(String(i.name ?? '')) === norm(pick.se.name)) ?? null;
  return {
    name: pick.se.name,
    exerciseKey: pick.se.key,
    sessionId: pick.s.id,
    item,
    stats: ((detail as Json | null)?.stats as Json | undefined) ?? null,
  };
}

async function readinessCard(userId: string, today: string, timeZone: string) {
  const t = (await loadAppToday(userId, today, timeZone)) as Json;
  const fitness = t.fitness as { days?: { date: string; projected?: boolean }[] } | undefined;
  const from = addDays(today, -FITNESS_DAYS);
  return {
    date: today,
    header: t.header ?? null,
    cue: (t.todayLine as { cue?: string | null } | undefined)?.cue ?? null,
    fitness: fitness ? { ...fitness, days: (fitness.days ?? []).filter((d) => d.date >= from) } : null,
  };
}

async function dayCard(userId: string, date: string, rows: PlanRow[], timeZone: string) {
  const events = await homeEvents(userId, startOfDay(date, timeZone), 1);
  return dayTimeline({
    date,
    timeZone,
    // Coach's own workout events are the plan's sessions, shown from the plan.
    events: events.filter((e) => !e.description.includes('Open in Coach: ')),
    sessions: rows.filter((r) => r.date === date && r.status !== 'skipped'),
  });
}

/** Training time by sport over a week or a month, from his activities (local start day). */
async function breakdown(userId: string, ref: string, today: string) {
  const span = breakdownSpan(ref, today);
  if (!span) return null;
  const rows = (await sql`
    SELECT sport_type, moving_time FROM strava_activities
    WHERE user_id = ${userId} AND start_date_local >= ${span.from}::date AND start_date_local < ${span.to}::date`) as Json[];
  return breakdownCard(rows.map((r) => ({ sport: sportOfStrava(r.sport_type), minutes: Number(r.moving_time ?? 0) / 60 })), span.caption);
}

/** Fills each card. One that fails or finds nothing is dropped (logged), so the answer still shows. */
export async function resolveCards(userId: string, refs: CardRef[], rows: PlanRow[], today: string, timeZone: string): Promise<Attachment[]> {
  const out = await Promise.all(
    refs.map(async (c): Promise<Attachment | null> => {
      try {
        switch (c.kind) {
          case 'workout': {
            const row = rows.find((r) => r.id === c.ref);
            if (!row) return null;
            const week = await weekOf(userId, row.date, today, timeZone);
            const days = (week?.days as { items: Json[] }[] | undefined) ?? [];
            const workout = days.flatMap((d) => d.items).find((i) => i.id === c.ref);
            return workout ? { kind: 'workout', workout } : null;
          }
          case 'week': {
            const week = await weekOf(userId, c.ref, today, timeZone);
            return week ? { kind: 'week', week } : null;
          }
          case 'exercise': {
            const exercise = await exerciseCard(userId, c.ref, today, timeZone);
            return exercise ? { kind: 'exercise', exercise } : null;
          }
          case 'readiness':
            return { kind: 'readiness', readiness: await readinessCard(userId, today, timeZone) };
          case 'day':
            return { kind: 'day', day: await dayCard(userId, c.ref, rows, timeZone) };
          case 'breakdown':
            return await breakdown(userId, c.ref, today);
        }
      } catch (error) {
        console.error(`Coach card ${c.kind} ${c.ref} failed:`, error instanceof Error ? error.message : error);
      }
      return null;
    })
  );
  return out.filter((a): a is Attachment => a !== null);
}
