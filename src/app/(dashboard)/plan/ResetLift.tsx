'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { editLiftAction } from './actions';

/**
 * "Reset workout" for a Lift session logged by mistake: every set goes back to planned, with no start or finish. The
 * targets stay. The change goes through Lift sync, so the iPhone has it on its next sync. Asks once before it saves.
 * Without `onReset` (the Lift session page), the page loads its data again.
 */
export default function ResetLift({ sessionId, onReset }: { sessionId: string; onReset?: () => Promise<void> | void }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    try {
      const r = await editLiftAction(sessionId, [{ type: 'resetSession' }]);
      if ('error' in r) toast.error(r.error);
      else {
        toast.success('Workout reset to planned');
        if (onReset) await onReset();
        else router.refresh();
      }
    } catch {
      toast.error('Could not reset the workout');
    } finally {
      setBusy(false);
      setAsking(false);
    }
  }

  return (
    <section className="rounded-xl border p-4">
      {asking ? (
        <>
          <p className="text-sm text-[var(--viz-ink)]">Un-log every set and put this workout back to planned?</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="destructive" disabled={busy} onClick={reset}>
              {busy ? <Loader2 aria-hidden className="mr-1 h-4 w-4 animate-spin" /> : <RotateCcw aria-hidden className="mr-1 h-4 w-4" />}
              Reset workout
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setAsking(false)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--viz-ink-2)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCcw aria-hidden className="h-3.5 w-3.5" /> Logged by mistake? Reset workout
        </button>
      )}
    </section>
  );
}
