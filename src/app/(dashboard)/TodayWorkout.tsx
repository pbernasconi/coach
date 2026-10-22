import Link from 'next/link';
import SportIcon from '@/components/SportIcon';
import WorkoutChart, { ZONE_COLOR } from '@/components/workouts/WorkoutChart';
import { plainTitle } from '@/lib/plan/calendar.mjs';
import { todayItemText } from '@/lib/performance/display.mjs';
import { clock, keyTargets, totals } from '@/lib/workouts/steps.mjs';
import type { CalendarWorkout } from '@/lib/plan/month';

/**
 * One of today's workouts on the home page: the title and time, what is asked (the main sets, as in the workout
 * window) and the structure chart. A workout without steps shows its description. Links open it in Plan.
 */
export default function TodayWorkout({ w, href }: { w: CalendarWorkout; href: string }) {
  const s = w.steps ?? null;
  const t = s ? (totals(s as never) as { seconds: number; tss: number; if: number }) : null;
  // The main sets without their notes, so each stays one short line.
  const work = s ? (keyTargets(s as never) as { text: string; zone: string }[]).slice(0, 3).map((l) => ({ ...l, text: l.text.split(' · ')[0] })) : [];
  const tss = w.tss ? Math.round(w.tss) : t?.tss || null;
  const meta = [todayItemText(w), tss ? `${tss} TSS` : null, t?.if ? `IF ${t.if.toFixed(2)}` : null].filter(Boolean).join(' · ');
  const desc = !s && w.description ? w.description.trim() : null;
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-stretch sm:gap-5">
      <div className="min-w-0 sm:w-64 sm:shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--viz-muted)]">Today</span>
        <Link href={href} className="mt-0.5 flex items-center gap-1.5 font-medium hover:underline hover:underline-offset-4">
          <SportIcon id={w.sport} className="h-3.5 w-3.5" />
          <span className="truncate">{plainTitle(w.title)}</span>
        </Link>
        <p className="text-xs tabular-nums text-[var(--viz-muted)]">{meta}</p>
        {work.length > 0 && (
          <ul className="mt-2 space-y-1">
            {work.map((l, i) => (
              <li key={i} className="flex gap-2 text-xs leading-4">
                <span className="mt-0.5 h-3 w-1 shrink-0 rounded-full" style={{ background: ZONE_COLOR[l.zone] }} aria-hidden />
                <span className="tabular-nums text-[var(--viz-ink)]">{l.text}</span>
              </li>
            ))}
          </ul>
        )}
        {desc && <p className="mt-1.5 line-clamp-2 text-xs text-[var(--viz-ink-2)]">{desc}</p>}
      </div>
      {s && t && (
        <Link href={href} className="block min-w-0 flex-1 rounded-md bg-muted/40 px-2 pb-1 pt-2 transition-colors hover:bg-muted/60" aria-label={`${plainTitle(w.title)}: open in Plan`}>
          <WorkoutChart workout={s} className="h-20 w-full" />
          <div className="mt-0.5 flex justify-between text-[10px] tabular-nums text-[var(--viz-muted)]">
            <span>0</span>
            <span>{clock(t.seconds).replace(/:00$/, '')}</span>
          </div>
        </Link>
      )}
    </div>
  );
}
