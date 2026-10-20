import Link from 'next/link';
import { fmtDay } from './types';

type Exercise = { key: string; name: string; sessions: number; lastDay: string; bestE1rm: number | null };

/** Every exercise ever logged, most recent first, folded away: open one for its history and best sets. */
export default function ExerciseIndex({ exercises, unit }: { exercises: Exercise[]; unit: string }) {
  return (
    <details className="group overflow-hidden rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-2 px-4 py-3 hover:bg-[var(--viz-band)] [&::-webkit-details-marker]:hidden">
        <span className="font-semibold">All exercises <span className="font-normal text-[var(--viz-muted)]">· {exercises.length}</span></span>
        <span className="text-xs text-[var(--viz-muted)]"><span className="group-open:hidden">Show</span><span className="hidden group-open:inline">Hide</span></span>
      </summary>
      <ul className="grid border-t sm:grid-cols-2">
        {exercises.map((e) => (
          <li key={e.key} className="border-b sm:odd:border-r">
            <Link href={`/lift/exercises/${encodeURIComponent(e.key)}`} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-[var(--viz-band)]">
              <span className="min-w-0 flex-1">
                <span className="block truncate">{e.name}</span>
                <span className="block text-[11px] text-[var(--viz-muted)]">{e.sessions} sessions · last {fmtDay(e.lastDay)}</span>
              </span>
              <span className="shrink-0 text-right text-xs tabular-nums text-[var(--viz-ink-2)]">{e.bestE1rm ? `${Math.round(e.bestE1rm)} ${unit}` : '–'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
