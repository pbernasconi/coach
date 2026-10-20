'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Targets } from '@/lib/status';
import type { Place } from '@/lib/plan/weather';
import {
  loadLocationAction, saveCoachingNotesAction, saveLocationAction, saveTargetsAction, searchPlacesAction, syncStravaNow,
  type PlaceHit,
} from './actions';

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
        className="h-10 w-24 rounded-md border bg-background px-2 text-right text-base md:h-auto md:py-1 md:text-sm"
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

export function CoachingNotesForm({ notes }: { notes: string }) {
  const [text, setText] = useState(notes);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await saveCoachingNotesAction(text);
          toast.success('Preferences saved');
        });
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        className="w-full rounded-md border bg-background p-2 font-mono text-base md:text-xs"
      />
      <Button size="sm" type="submit" disabled={pending || text === notes}>Save preferences</Button>
    </form>
  );
}

/**
 * The weather location for /plan: search a place by name, pick a result, saved to users.settings.location.
 * Without `current`, it loads the saved location itself.
 */
export function LocationForm({ current }: { current?: { place: Place; isDefault: boolean } }) {
  const [saved, setSaved] = useState(current ?? null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => {
    if (current) return;
    loadLocationAction().then(setSaved).catch(() => setSaved(null));
  }, [current]);

  function search() {
    startSearch(async () => setHits(await searchPlacesAction(query)));
  }

  function save(place: PlaceHit | null) {
    startSave(async () => {
      try {
        await saveLocationAction(place && { name: place.name, lat: place.lat, lon: place.lon });
        setSaved(await loadLocationAction());
        setHits(null);
        setQuery('');
        toast.success(place ? `Location: ${place.name}` : 'Location reset to the default');
      } catch {
        toast.error('Could not save the location');
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2">
        <MapPin aria-hidden className="h-4 w-4 text-muted-foreground" />
        <span>{saved ? saved.place.name : 'Loading…'}</span>
        {saved?.isDefault && <span className="text-muted-foreground">(default)</span>}
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="City or town"
          aria-label="Search for a place"
          className="h-10 min-w-0 flex-1 rounded-md border bg-background px-2 text-base md:h-8 md:text-sm"
        />
        <Button size="sm" type="submit" variant="outline" disabled={searching || query.trim().length < 2}>
          {searching ? 'Searching…' : 'Search'}
        </Button>
      </form>
      {hits && hits.length === 0 && <p className="text-muted-foreground">No places found.</p>}
      {hits && hits.length > 0 && (
        <ul className="divide-y rounded-md border" aria-label="Places found">
          {hits.map((h) => (
            <li key={`${h.lat},${h.lon}`}>
              <button
                type="button"
                disabled={saving}
                onClick={() => save(h)}
                className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left hover:bg-accent disabled:opacity-50"
              >
                <span>{h.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{h.lat.toFixed(2)}, {h.lon.toFixed(2)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {saved && !saved.isDefault && (
        <Button size="sm" variant="ghost" disabled={saving} onClick={() => save(null)}>Use the default</Button>
      )}
    </div>
  );
}
