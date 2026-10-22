import { garminLine } from '@/lib/vitals/garmin.mjs';
import type { loadGarminStatus } from '@/lib/vitals/queries';
import type { Board } from '@/lib/vitals/garmin-pages';

type GarminStatus = Awaited<ReturnType<typeof loadGarminStatus>>;

const hm = (m: number) => `${Math.floor(Math.round(m) / 60)}:${String(Math.round(m) % 60).padStart(2, '0')}`;
const NIGHT = { off: 'no watch last night', waiting: "waiting for last night's sleep" } as const;

/** The Garmin sync line ("Garmin: synced 3 h ago …"), whether last night is in, and its warning. Nothing when null. */
export default function GarminStatusLine({ status, now, lastNight }: { status: GarminStatus | null; now: number; lastNight?: Board['lastNight'] | null }) {
  if (!status) return null;
  const night = !lastNight || !status.connected ? null : lastNight.status === 'in' ? `last night ${hm(lastNight.sleepMin ?? 0)} asleep` : NIGHT[lastNight.status];
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground" data-smoke="garmin-status">{garminLine(status, now)}{night && <span className={lastNight?.status === 'in' ? undefined : 'text-[var(--color-amber-600)]'}> · {night}</span>}</p>
      {status.warning && status.warning.level !== 'info' && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm" role="status">{status.warning.text}</p>
      )}
    </div>
  );
}
