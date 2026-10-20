'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { Targets } from '@/lib/status';
import { revealLiftToken, saveTargetsAction, syncStravaNow } from './actions';

export function StravaSyncButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => start(async () => {
        const msg = await syncStravaNow();
        if (msg.startsWith('Sync failed')) toast.error(msg);
        else toast.success(msg);
      })}
    >
      {pending ? 'Syncing…' : 'Sync now'}
    </Button>
  );
}

export function LiftTokenButton() {
  const [token, setToken] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!token) {
    return (
      <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => setToken(await revealLiftToken()))}>
        Show sync token
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{token}</code>
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(token);
          toast.success('Token copied');
        }}
      >
        Copy
      </Button>
    </div>
  );
}

export function TargetsForm({ targets }: { targets: Targets }) {
  const [t, setT] = useState(targets);
  const [pending, start] = useTransition();
  const field = (key: keyof Targets, label: string, step: number) => (
    <label className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        value={t[key]}
        onChange={(e) => setT({ ...t, [key]: Number(e.target.value) })}
        className="w-24 rounded-md border bg-background px-2 py-1 text-right"
      />
    </label>
  );
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await saveTargetsAction(t);
          toast.success('Targets saved');
        });
      }}
    >
      {field('runKm', 'Run km per week', 1)}
      {field('rideHours', 'Ride hours per week', 0.5)}
      {field('strength', 'Strength sessions per week', 1)}
      <Button size="sm" type="submit" disabled={pending}>Save targets</Button>
    </form>
  );
}
