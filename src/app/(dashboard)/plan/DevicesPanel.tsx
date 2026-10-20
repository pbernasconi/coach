'use client';

import { cn } from '@/lib/utils';
import type { CalendarWorkout } from '@/lib/plan/month';
import { Panel } from './ModalParts';

/**
 * Where the steps go, with no service in between: runs onto the Garmin calendar (the Garmin job, hourly) and
 * indoor rides into Zwift's workouts folder on the Mac (every 30 minutes). Outdoor rides stay in Coach.
 */
export default function DevicesPanel({ w }: { w: CalendarWorkout }) {
  const ride = w.steps?.sport === 'ride';
  const indoor = ride && /zwift|indoor|virtual|trainer/i.test(`${w.title} ${w.workoutType ?? ''}`);
  const target = !ride ? 'garmin' : indoor ? 'zwift' : null;
  const s = target ? w.syncs[target] : undefined;
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
  return (
    <Panel title="On your devices">
      <div className="space-y-2 rounded-lg border p-3 text-sm">
        <p className="text-[var(--viz-ink)]">{target === 'garmin' ? 'Garmin watch' : target === 'zwift' ? 'Zwift' : 'Outdoor ride: in Coach only'}</p>
        {target &&
          (s ? (
            <p className={cn('text-xs', s.status === 'ok' ? 'text-[var(--viz-up)]' : 'text-[var(--viz-down)]')}>
              {s.status === 'ok' ? (target === 'garmin' ? 'On the Garmin calendar' : 'In Zwift (restart Zwift to see a change)') : 'Problem'}
              {s.syncedAt ? ` · ${when(s.syncedAt)}` : ''}
              {s.error ? ` · ${s.error}` : ''}
            </p>
          ) : (
            <p className="text-xs text-[var(--viz-muted)]">
              {target === 'garmin' ? 'Not sent yet: the Garmin job sends it within the hour.' : 'Not sent yet: the cloud sends it to Zwift (through intervals.icu) within the hour.'}
            </p>
          ))}
        {ride && (
          <a href={`/api/plan/workouts/${encodeURIComponent(w.id)}/zwo`} className="inline-block text-xs underline underline-offset-2">
            Download .zwo for Zwift
          </a>
        )}
      </div>
    </Panel>
  );
}
