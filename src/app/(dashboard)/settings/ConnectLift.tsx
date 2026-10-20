'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { liftSyncState, revealLiftToken } from './actions';

/**
 * Connects the Lift app on the iPhone: on the iPhone, one tap on "Open in Lift" (a lift://sync link with a one-time
 * code); on a computer, scan the QR code with the iPhone camera. Before the first sync it watches for it, and
 * refreshes the page when it lands. Once Lift is connected, the steps fold away.
 */
export default function ConnectLift({ link, qrSvg, connected }: { link: string; qrSvg: string; connected: boolean }) {
  const router = useRouter();
  const [watching, setWatching] = useState(!connected);
  const [isPhone, setIsPhone] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => setIsPhone(/iPhone|iPad/.test(navigator.userAgent)), []);

  // While nothing has synced yet, check every 4 s (for 10 min) so the row turns green as soon as Lift connects.
  useEffect(() => {
    if (!watching) return;
    const started = Date.now();
    const id = setInterval(async () => {
      if (Date.now() - started > 10 * 60_000) return setWatching(false);
      const next = await liftSyncState();
      if (next.lastChangeAt) {
        setWatching(false);
        toast.success('Lift is connected');
        router.refresh();
      }
    }, 4000);
    return () => clearInterval(id);
  }, [watching, router]);

  const steps = (
    <div className="space-y-3 pt-2">
      {!connected && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${watching ? 'animate-pulse bg-amber-500' : 'bg-muted-foreground'}`} aria-hidden />
          {watching ? 'Waiting for Lift to connect…' : 'Not connected yet. Reload to try again.'}
        </p>
      )}
      {isPhone ? (
        <a href={link} className="flex h-11 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground">
          {connected ? 'Connect again in Lift' : 'Open in Lift to connect'}
        </a>
      ) : (
        <div className="flex items-center gap-4">
          {/* The SVG is made on the server by the qrcode library from our own link. */}
          <div className="h-28 w-28 shrink-0 rounded-md border bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
            <li>Install Lift from TestFlight on the iPhone.</li>
            <li>Point the iPhone camera at this code and tap <b>Open in Lift</b>.</li>
            <li>Lift saves the token and syncs. This row turns green.</li>
          </ol>
        </div>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none hover:text-foreground">Connect by hand instead</summary>
        <div className="mt-2 space-y-2">
          <p>In Lift: Settings → Sync → Sync token. Paste the token, then tap Save and sync.</p>
          {token ? (
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1">{token}</code>
              <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(token); toast.success('Token copied'); }}>Copy</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={async () => setToken(await revealLiftToken())}>Show sync token</Button>
          )}
        </div>
      </details>
    </div>
  );

  if (!connected) return steps;
  return (
    <details>
      <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">Connect another iPhone</summary>
      {steps}
    </details>
  );
}
