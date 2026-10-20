'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { liftSyncState, revealLiftToken } from './actions';

const ago = (at: string) => {
  const m = Math.round((Date.now() - Date.parse(at)) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
};

/**
 * Connects the Lift app on the iPhone: on the iPhone, one tap on "Open in Lift" (a lift://sync link with the token);
 * on a computer, scan the QR code with the iPhone camera. The card watches for the first sync and says when it lands.
 */
export default function ConnectLift({
  link, qrSvg, lastChangeAt, sessions,
}: {
  link: string;
  qrSvg: string;
  lastChangeAt: string | null;
  sessions: number;
}) {
  const [state, setState] = useState({ lastChangeAt, sessions });
  const [watching, setWatching] = useState(!lastChangeAt);
  const [isPhone, setIsPhone] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => setIsPhone(/iPhone|iPad/.test(navigator.userAgent)), []);

  // While nothing has synced yet, check every 4 s (for 10 min) so the card turns green as soon as Lift connects.
  useEffect(() => {
    if (!watching) return;
    const started = Date.now();
    const id = setInterval(async () => {
      if (Date.now() - started > 10 * 60_000) return setWatching(false);
      const next = await liftSyncState();
      if (next.lastChangeAt) {
        setState(next);
        setWatching(false);
        toast.success('Lift is connected');
      }
    }, 4000);
    return () => clearInterval(id);
  }, [watching]);

  const connected = Boolean(state.lastChangeAt);
  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 rounded-md p-2 text-sm ${connected ? 'bg-emerald-500/10' : 'bg-muted/50'}`}>
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : watching ? 'animate-pulse bg-amber-500' : 'bg-muted-foreground'}`} />
        {connected
          ? <span>Connected · last change {ago(state.lastChangeAt as string)} · {state.sessions} sessions on the server</span>
          : <span>{watching ? 'Waiting for Lift to connect…' : 'Not connected yet'}</span>}
      </div>

      {isPhone ? (
        <a href={link} className="flex h-11 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground">
          {connected ? 'Connect again in Lift' : 'Open in Lift to connect'}
        </a>
      ) : (
        <div className="flex items-center gap-4">
          {/* The SVG is made on the server by the qrcode library from our own link. */}
          <div className="h-36 w-36 shrink-0 rounded-md border bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
            <li>Install Lift from TestFlight on the iPhone.</li>
            <li>Point the iPhone camera at this code and tap <b>Open in Lift</b>.</li>
            <li>Lift saves the token and syncs. This card turns green.</li>
          </ol>
        </div>
      )}

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none">Connect by hand instead</summary>
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
}
