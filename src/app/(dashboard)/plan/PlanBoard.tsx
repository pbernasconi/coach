'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useOptimistic, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, GripVertical, Undo2 } from 'lucide-react';
import SportIcon from '@/components/SportIcon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import RemoveWorkout from '@/components/plan/RemoveWorkout';
import WeatherBadge from '@/components/plan/WeatherBadge';
import type { Feel, Week, Workout } from '@/lib/plan/queries';
import type { LibraryItem } from '@/lib/plan/month';
import type { DayWeather } from '@/lib/plan/weather';
import { applyChange } from '@/lib/plan/remove.mjs';
import { addDays } from '@/lib/plan/week.mjs';
import { addFromLibraryAction, feelAction, moveWorkoutAction, removeWorkoutAction, skipWorkoutAction, undoAction } from './actions';
import WorkoutLibrary, { LIBRARY_MIME, WORKOUT_MIME } from './WorkoutLibrary';

const FEEL_OPTIONS: { feel: Feel; label: string; hint: string }[] = [
  { feel: 'wrecked', label: 'Wrecked', hint: 'Today becomes rest, tomorrow gets easier' },
  { feel: 'tired', label: 'Tired', hint: 'Quality work moves later or gets easier' },
  { feel: 'ok', label: 'OK', hint: 'Keep the plan' },
  { feel: 'fresh', label: 'Fresh', hint: 'Undo any changes from today on' },
];


function dayLabel(key: string) {
  const d = new Date(`${key}T12:00:00Z`);
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
  };
}

function stripEmoji(title: string) {
  return title.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '');
}

export default function PlanBoard({
  week, timeZone, weather = {}, library = [], importedIds = [],
}: {
  week: Week;
  timeZone: string;
  importedIds?: string[];
  weather?: Record<string, DayWeather>;
  library?: LibraryItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [workouts, changeLocal] = useOptimistic(week.workouts, (state: Workout[], c: { id: string; date?: string; remove?: boolean }) =>
    applyChange(state, c)
  );
  const imported = new Set(importedIds);

  // The server picks "today" from the tz cookie. Set it from this browser so travel days line up.
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== timeZone) {
      document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [timeZone, router]);

  // A link like /plan#w-<id> (from the start page) opens that workout. On a phone (one column), the
  // page otherwise opens at today, because past days are above it.
  useEffect(() => {
    const m = /^#w-(.+)$/.exec(window.location.hash);
    if (m) setOpen(m[1]);
    else if (!window.location.hash && window.matchMedia('(max-width: 767px)').matches) {
      document.getElementById(`day-${week.today}`)?.scrollIntoView({ block: 'start' });
    }
  }, [week.today]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(week.weekStart, i));
  const prev = addDays(week.weekStart, -7);
  const next = addDays(week.weekStart, 7);
  const isThisWeek = days.includes(week.today);

  function move(id: string, date: string) {
    const w = workouts.find((x) => x.id === id);
    if (!w || w.date === date) return;
    startTransition(async () => {
      changeLocal({ id, date });
      try {
        await moveWorkoutAction(id, date);
      } catch {
        toast.error('Could not move the workout');
      }
    });
  }

  function addFromLibrary(itemId: string, date: string) {
    const item = library.find((x) => x.id === itemId);
    startTransition(async () => {
      try {
        await addFromLibraryAction(itemId, date);
        toast.success(`Added ${item?.title ?? 'workout'}`);
      } catch {
        toast.error('Could not add the workout');
      }
    });
  }

  const weatherUntil = addDays(week.today, 14);

  function feel(f: Feel) {
    startTransition(async () => {
      try {
        const changed = await feelAction(week.weekStart, week.today, f);
        const label = FEEL_OPTIONS.find((o) => o.feel === f)!.label;
        toast.success(changed ? `${label}: changed ${changed} workout${changed === 1 ? '' : 's'}` : `${label}: no changes`, {
          action: changed && f !== 'fresh' ? { label: 'Undo', onClick: () => undo() } : undefined,
        });
      } catch {
        toast.error('Could not save how you feel');
      }
    });
  }

  function undo() {
    startTransition(async () => {
      const changed = await undoAction(week.weekStart, week.today);
      toast.success(changed ? `Restored ${changed} workout${changed === 1 ? '' : 's'}` : 'Nothing to undo');
    });
  }

  function remove(w: Workout) {
    startTransition(async () => {
      changeLocal({ id: w.id, remove: true });
      try {
        await removeWorkoutAction(w.id);
        toast.success('Workout removed');
      } catch {
        toast.error('Could not remove the workout');
      }
    });
  }

  function skip(w: Workout) {
    startTransition(async () => {
      await skipWorkoutAction(w.id, w.status !== 'skipped');
    });
  }

  const adapted = workouts.some((w) => w.adaptedFrom && w.date >= week.today);
  const weekTss = workouts.filter((w) => w.status !== 'skipped').reduce((n, w) => n + (w.tss ?? 0), 0);
  const doneCount = workouts.filter((w) => w.state === 'done' && w.sport !== 'rest').length;
  const plannedCount = workouts.filter((w) => w.sport !== 'rest' && w.status !== 'skipped').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Week of {dayLabel(week.weekStart).date}
          </h1>
          <p className="text-muted-foreground">
            {week.title ?? (week.planId ? 'Training plan' : 'No plan for this week')}
            {plannedCount > 0 && ` · ${doneCount}/${plannedCount} done · ${Math.round(weekTss)} TSS planned`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild aria-label="Previous week">
            <Link href={`/plan?week=${prev}`}><ChevronLeft className="h-4 w-4" /></Link>
          </Button>
          {!isThisWeek && (
            <Button variant="outline" asChild>
              <Link href="/plan">This week</Link>
            </Button>
          )}
          <Button variant="outline" size="icon" asChild aria-label="Next week">
            <Link href={`/plan?week=${next}`}><ChevronRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>

      {isThisWeek && week.planId && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
          <span className="w-full text-sm font-medium md:w-auto">How do you feel today?</span>
          <div className="grid w-full grid-cols-4 gap-2 md:flex md:w-auto">
            {FEEL_OPTIONS.map((o) => (
              <Button
                key={o.feel}
                size="sm"
                className="h-10 md:h-8"
                variant={week.feel === o.feel ? 'default' : 'outline'}
                title={o.hint}
                disabled={pending}
                onClick={() => feel(o.feel)}
              >
                {o.label}
              </Button>
            ))}
          </div>
          {adapted && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={undo} className="ml-auto">
              <Undo2 className="mr-1 h-4 w-4" /> Undo changes
            </Button>
          )}
        </div>
      )}

      {!week.planId && (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No plan for this week yet. In Claude Code, open the <code>coach</code> repo and run <code>/plan</code>. It
          writes the plan and copies it here.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
        {days.map((d) => {
          const label = dayLabel(d);
          const dayWorkouts = workouts.filter((w) => w.date === d).sort((a, b) => (a.startTime ?? '99').localeCompare(b.startTime ?? '99'));
          const matchedIds = new Set(dayWorkouts.map((w) => w.match?.id).filter(Boolean));
          const extras = [
            ...week.activities.filter((a) => a.date === d && !matchedIds.has(a.id)).map((a) => ({ id: a.id, sport: a.sport, text: `${a.name}${a.km ? ` · ${a.km} km` : ` · ${a.min} min`}` })),
            ...week.lifts.filter((l) => l.date === d && !matchedIds.has(l.id)).map((l) => ({ id: l.id, sport: 'strength', text: `${l.name} · ${l.setsLogged} sets` })),
          ];
          return (
            <div
              key={d}
              id={`day-${d}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(d); }}
              onDragLeave={() => setDragOver((x) => (x === d ? null : x))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const lib = e.dataTransfer.getData(LIBRARY_MIME);
                if (lib) addFromLibrary(lib, d);
                else move(e.dataTransfer.getData(WORKOUT_MIME) || e.dataTransfer.getData('text/plain'), d);
              }}
              className={cn(
                'scroll-mt-24 rounded-lg border p-2 md:min-h-32 transition-colors target:ring-2 target:ring-primary',
                d === week.today && 'border-primary',
                d < week.today && 'bg-muted/40',
                dragOver === d && 'bg-accent'
              )}
            >
              <div className="mb-2 px-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn('text-sm font-semibold', d === week.today && 'text-primary')}>{label.weekday}</span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">{d === week.today ? 'Today' : label.date}</span>
                </div>
                {d >= week.today && d <= weatherUntil && weather[d] && (
                  <div className="mt-0.5">
                    <WeatherBadge w={weather[d]} compact />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {dayWorkouts.map((w) => (
                  <WorkoutCard
                    key={w.id}
                    w={w}
                    days={days}
                    open={open === w.id}
                    onToggle={() => setOpen(open === w.id ? null : w.id)}
                    onMove={(to) => move(w.id, to)}
                    onSkip={() => skip(w)}
                    onRemove={() => remove(w)}
                    imported={imported.has(w.id)}
                    disabled={pending}
                  />
                ))}
                {extras.map((x) => (
                  <div key={x.id} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground">
                    <SportIcon id={x.sport} className="h-3 w-3" />
                    <span>Extra: {x.text}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {library.length > 0 && (
        <WorkoutLibrary items={library} today={week.today} onAdd={addFromLibrary} disabled={pending} defaultCollapsed className="lg:static lg:w-full" />
      )}
    </div>
  );
}

function WorkoutCard({
  w, days, open, onToggle, onMove, onSkip, onRemove, imported, disabled,
}: {
  w: Workout;
  days: string[];
  open: boolean;
  onToggle: () => void;
  onMove: (to: string) => void;
  onSkip: () => void;
  onRemove: () => void;
  imported: boolean;
  disabled: boolean;
}) {
  const hard = /hard|threshold|vo2|tempo|race/i.test(`${w.intensity} ${w.workoutType} ${w.title}`);
  return (
    <div
      id={`w-${w.id}`}
      draggable={w.state !== 'done'}
      onDragStart={(e) => {
        e.dataTransfer.setData(WORKOUT_MIME, w.id);
        e.dataTransfer.setData('text/plain', w.id);
      }}
      className={cn(
        'group scroll-mt-24 rounded-md border bg-card p-2 text-sm shadow-sm target:ring-2 target:ring-primary',
        w.state !== 'done' && 'cursor-grab active:cursor-grabbing',
        w.state === 'done' && 'border-green-600/40 bg-green-600/5',
        w.state === 'missed' && 'opacity-60',
        w.state === 'skipped' && 'opacity-50 line-through',
        hard && w.state !== 'done' && 'border-l-4 border-l-orange-500'
      )}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-1 text-left">
        {w.state !== 'done' && <GripVertical className="mt-0.5 hidden h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 md:block" />}
        <span className="flex-1">
          <span className="flex items-center gap-1.5 font-medium"><SportIcon id={w.sport} />{stripEmoji(w.title)}</span>
          <span className="block text-xs text-muted-foreground">
            {[w.startTime, w.duration ? `${w.duration} min` : null, w.tss ? `${Math.round(w.tss)} TSS` : null].filter(Boolean).join(' · ')}
          </span>
          {w.state === 'done' && w.match && (
            <span className="mt-1 flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
              <Check className="h-3 w-3" /> {w.match.source === 'lift' ? 'Lift' : 'Strava'}: {w.match.name}
            </span>
          )}
          {w.state === 'missed' && <span className="mt-1 block text-xs text-muted-foreground">Not done</span>}
          {w.adaptedFrom && <span className="mt-1 block text-xs text-amber-600">Changed for how you feel</span>}
        </span>
      </button>
      {w.state !== 'done' && (
        // Touch screens cannot drag: one tap moves the workout a day. Shown on phones, and on hover.
        <div className="mt-1 flex justify-end gap-1 md:hidden md:group-hover:flex">
          <Button size="sm" variant="ghost" className="h-10 w-10 p-0 md:h-6 md:w-6" aria-label="Move a day earlier"
            disabled={disabled || w.date <= days[0]} onClick={() => onMove(addDays(w.date, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-10 w-10 p-0 md:h-6 md:w-6" aria-label="Move a day later"
            disabled={disabled || w.date >= days[6]} onClick={() => onMove(addDays(w.date, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      {open && (
        <div className="mt-2 space-y-2 border-t pt-2 text-xs">
          {w.description && <p className="whitespace-pre-wrap">{w.description}</p>}
          {w.why && <p className="text-muted-foreground">Why: {w.why}</p>}
          {w.state !== 'done' && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1">
                Move to
                <select
                  className="h-9 rounded border bg-background px-1 text-base sm:h-auto sm:py-0.5 sm:text-xs"
                  value={w.date}
                  disabled={disabled}
                  onChange={(e) => onMove(e.target.value)}
                >
                  {days.map((d) => (
                    <option key={d} value={d}>{dayLabel(d).weekday} {dayLabel(d).date}</option>
                  ))}
                </select>
              </label>
              <Button size="sm" variant="outline" className="h-9 px-3 text-xs md:h-6 md:px-2" disabled={disabled} onClick={onSkip}>
                {w.status === 'skipped' ? 'Unskip' : 'Skip'}
              </Button>
            </div>
          )}
          <RemoveWorkout workout={{ title: stripEmoji(w.title), date: w.date, state: w.state, imported }} onRemove={onRemove} disabled={disabled} />
        </div>
      )}
    </div>
  );
}
