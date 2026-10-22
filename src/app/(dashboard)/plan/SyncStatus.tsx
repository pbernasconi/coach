'use client';

import { Download } from 'lucide-react';
import { StandardTooltip } from '@kobo/web';
import { cn } from '@/lib/utils';
import type { CalendarWorkout } from '@/lib/plan/month';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

/**
 * Where the steps went, as a small chip for the modal header: runs to the Garmin calendar (the Garmin job, hourly),
 * indoor rides to Zwift (every 30 minutes). Outdoor rides stay in Coach. A ride also gets its .zwo download.
 */
export default function SyncStatus({ w }: { w: CalendarWorkout }) {
  if (!w.steps) return null;
  const ride = w.steps.sport === 'ride';
  const indoor = ride && /zwift|indoor|virtual|trainer/i.test(`${w.title} ${w.workoutType ?? ''}`);
  const target = !ride ? 'garmin' : indoor ? 'zwift' : null;
  const s = target ? w.syncs[target] : undefined;
  const name = target === 'garmin' ? 'Garmin' : 'Zwift';
  const state = !s ? 'pending' : s.status === 'ok' ? 'ok' : 'error';
  const tip =
    state === 'ok' ? `On ${target === 'garmin' ? 'the Garmin calendar' : 'Zwift (restart Zwift to see a change)'} · ${when(s!.syncedAt)}`
    : state === 'error' ? `Sync problem${s!.error ? `: ${s!.error}` : ''}`
    : 'Sends within the hour';
  return (
    <>
      {target && (
        <StandardTooltip content={tip} triggerMode="description">
          <span className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-[var(--viz-ink-2)] sm:inline-flex">
            <span
              aria-hidden
              className={cn('h-1.5 w-1.5 rounded-full', state === 'ok' ? 'bg-[var(--viz-good)]' : state === 'error' ? 'bg-[var(--viz-down)]' : 'bg-[var(--viz-muted)]')}
            />
            {name}
            <span className="text-[var(--viz-muted)]">{state === 'ok' ? 'synced' : state === 'error' ? 'failed' : 'pending'}</span>
          </span>
        </StandardTooltip>
      )}
      {ride && (
        <StandardTooltip content="Download .zwo for Zwift">
          <a
            href={`/api/plan/workouts/${encodeURIComponent(w.id)}/zwo`}
            aria-label="Download .zwo for Zwift"
            className="hidden rounded-md border p-1.5 text-[var(--viz-muted)] hover:bg-accent hover:text-foreground sm:inline-flex"
          >
            <Download aria-hidden className="h-3.5 w-3.5" />
          </a>
        </StandardTooltip>
      )}
    </>
  );
}
