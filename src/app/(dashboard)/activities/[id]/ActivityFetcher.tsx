'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Asks the server once to fetch the parts of this activity that are not stored yet (Strava detail, streams,
 * weather), then reloads the page data. The next view reads them from the database.
 */
export default function ActivityFetcher({ stravaId }: { stravaId: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [state, setState] = useState<'loading' | 'done' | 'skipped' | 'failed'>('loading');
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/activities/${encodeURIComponent(stravaId)}/fetch`, { method: 'POST' });
        const body = (await res.json().catch(() => ({}))) as { fetched?: string[]; skipped?: string | null; error?: string | null };
        if (!res.ok || body.error) {
          setState('failed');
          setNote(body.error ?? `status ${res.status}`);
        } else if (body.fetched?.length) {
          setState('done');
          router.refresh();
        } else {
          setState('skipped');
          setNote(body.skipped ?? null);
        }
      } catch (e) {
        setState('failed');
        setNote((e as Error).message);
      }
    })();
  }, [stravaId, router]);
  if (state === 'done') return null;
  return (
    <p role="status" className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
      {state === 'loading' && 'Loading the map, streams and weather from Strava and Open-Meteo. This happens once per activity.'}
      {state === 'skipped' && `The details from Strava were not loaded${note ? ` (${note})` : ''}. The page shows the stored data.`}
      {state === 'failed' && `The details from Strava did not load${note ? `: ${note.slice(0, 120)}` : ''}. The page shows the stored data.`}
    </p>
  );
}
