'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Targets } from '@/lib/status';
import type { Place } from '@/lib/plan/weather';
import {
  loadLocationAction, saveCoachingNotesAction, saveLocationAction, saveTargetsAction, saveThresholdsAction, searchPlacesAction, syncStravaNow,
  type PlaceHit, type ThresholdInput,
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
  const [saved, setSaved] = useState(targets);
  const [t, setT] = useState(targets);
  const [pending, start] = useTransition();
  const changed = (Object.keys(t) as (keyof Targets)[]).some((k) => t[k] !== saved[k]);
  const field = (key: keyof Targets, label: string, unit: string, step: number) => (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring">
        <input
          type="number"
          min={0}
          step={step}
          value={t[key]}
          onChange={(e) => setT({ ...t, [key]: Number(e.target.value) })}
          className="h-10 w-full min-w-0 bg-transparent px-2 text-base tabular-nums outline-none md:h-8 md:text-sm"
        />
        <span className="shrink-0 pr-2 text-xs text-muted-foreground">{unit}</span>
      </span>
    </label>
  );
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await saveTargetsAction(t);
          setSaved(t);
          toast.success('Targets saved');
        });
      }}
    >
      <div className="grid grid-cols-3 gap-3 sm:w-full sm:max-w-md">
        {field('runKm', 'Run', 'km', 1)}
        {field('rideHours', 'Ride', 'h', 0.5)}
        {field('strength', 'Strength', 'x', 1)}
      </div>
      <Button size="sm" className="self-start sm:self-auto" type="submit" disabled={pending || !changed}>{pending ? 'Saving…' : 'Save targets'}</Button>
    </form>
  );
}

export type ThresholdView = Record<keyof ThresholdInput, { own: number | null; auto: number | null; source: string | null }>;

const paceText = (s: number | null) => (s == null ? '' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);
const paceSeconds = (text: string) => {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(text);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** FTP, LTHR per sport, resting HR and threshold pace for TSS. An empty field uses the automatic value shown. */
export function ThresholdsForm({ view }: { view: ThresholdView }) {
  const [own, setOwn] = useState<Record<keyof ThresholdInput, string>>({
    ftp: view.ftp.own?.toString() ?? '', runLthr: view.runLthr.own?.toString() ?? '', rideLthr: view.rideLthr.own?.toString() ?? '',
    restingHr: view.restingHr.own?.toString() ?? '', runPaceS: paceText(view.runPaceS.own),
  });
  const [pending, start] = useTransition();
  const field = (key: keyof ThresholdInput, label: string, unit: string) => {
    const auto = key === 'runPaceS' ? paceText(view[key].auto) : view[key].auto?.toString() ?? '';
    return (
      <label className="flex items-center justify-between gap-4">
        <span className="min-w-0 text-muted-foreground">
          {label}
          <span className="block text-xs">{auto ? `Automatic: ${auto} ${unit} (${view[key].source})` : 'No automatic value'}</span>
        </span>
        <input
          inputMode={key === 'runPaceS' ? 'text' : 'numeric'}
          placeholder={auto || '–'}
          value={own[key]}
          onChange={(e) => setOwn({ ...own, [key]: e.target.value })}
          aria-label={label}
          className="h-10 w-24 shrink-0 rounded-md border bg-background px-2 text-right text-base md:h-auto md:py-1 md:text-sm"
        />
      </label>
    );
  };
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const num = (v: string) => (v.trim() === '' ? null : Number(v));
        const pace = own.runPaceS.trim() === '' ? null : paceSeconds(own.runPaceS);
        if (own.runPaceS.trim() !== '' && pace == null) {
          toast.error('Write the threshold pace as m:ss, for example 4:48.');
          return;
        }
        start(async () => {
          const msg = await saveThresholdsAction({
            ftp: num(own.ftp), runLthr: num(own.runLthr), rideLthr: num(own.rideLthr), restingHr: num(own.restingHr), runPaceS: pace,
          });
          toast.success(msg);
        });
      }}
    >
      {field('ftp', 'Cycling FTP', 'W')}
      {field('rideLthr', 'Cycling threshold HR', 'bpm')}
      {field('runLthr', 'Running threshold HR', 'bpm')}
      {field('runPaceS', 'Threshold run pace', '/km')}
      {field('restingHr', 'Resting HR', 'bpm')}
      <Button size="sm" type="submit" disabled={pending}>{pending ? 'Recomputing TSS…' : 'Save and recompute TSS'}</Button>
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
        rows={10}
        aria-label="Coaching preferences"
        className="w-full resize-y rounded-md border bg-background p-3 font-mono text-base leading-relaxed md:text-xs"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" type="submit" disabled={pending || text === notes}>{pending ? 'Saving…' : 'Save preferences'}</Button>
        {text !== notes && !pending && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
      </div>
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
      <div className="flex flex-wrap items-center gap-2">
        <MapPin aria-hidden className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{saved ? saved.place.name : 'Loading…'}</span>
        {saved?.isDefault && <span className="text-xs text-muted-foreground">(default)</span>}
        {saved && !saved.isDefault && (
          <Button size="sm" variant="ghost" className="ml-auto" disabled={saving} onClick={() => save(null)}>Use the default</Button>
        )}
      </div>
      <form
        className="flex gap-2 sm:max-w-md"
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
        <ul className="divide-y rounded-md border sm:max-w-md" aria-label="Places found">
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
    </div>
  );
}
