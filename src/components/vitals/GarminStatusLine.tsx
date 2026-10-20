import { garminLine } from '@/lib/vitals/garmin.mjs';
import type { loadGarminStatus } from '@/lib/vitals/queries';

type GarminStatus = Awaited<ReturnType<typeof loadGarminStatus>>;

/** The Garmin sync line ("Garmin: synced 3 h ago …") and its warning, from loadGarminStatus. Nothing when null. */
export default function GarminStatusLine({ status, now }: { status: GarminStatus | null; now: number }) {
  if (!status) return null;
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground" data-smoke="garmin-status">{garminLine(status, now)}</p>
      {status.warning && status.warning.level !== 'info' && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm" role="status">{status.warning.text}</p>
      )}
    </div>
  );
}
