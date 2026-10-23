'use client';

import { useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import type { CalendarWorkout } from '@/lib/plan/month';
import type { DayWeather } from '@/lib/plan/weather';
import type { Item } from './ItemPreview';
import ActivityModal from './ActivityModal';
import LiftModal from './LiftModal';
import PlannedModal from './PlannedModal';
import { isTextSession } from './SetTable';

type Props = {
  item: Item;
  onClose: () => void;
  /** The previous / next item in the calendar, or null at the ends. */
  onStep: (dir: -1 | 1) => void;
  canStep: { prev: boolean; next: boolean };
  /** Copies a planned workout, for Paste in a day's menu. */
  onCopy?: (w: CalendarWorkout) => void;
  /** The forecast by day, for a planned workout in the next two weeks. */
  weather?: Record<string, DayWeather>;
  /** After an edit of a Lift session: loads the day again, so the modal shows the change. */
  onLiftChanged?: (date: string) => Promise<void> | void;
  /** After an edit of a planned workout: loads its old and new week again. */
  onEdited?: (days: { from: string; to: string }) => void;
  /** Skips a planned workout with why, or puts a skipped one back (no reason). */
  onSkip?: (w: CalendarWorkout, reason?: string | null) => void;
  /** Marks a planned workout done by hand, or back to planned. */
  onMarkDone?: (w: CalendarWorkout, done: boolean) => void;
};

/**
 * The calendar's item modal, in a Strava style with the TrainingPeaks data: the main numbers, planned against
 * completed, the load change, zones and peak curves, laps and the stream charts. A done item links to its full
 * page. The ← and → keys step to the previous and next item.
 */
export default function ItemModal({ item, onClose, onStep, canStep, onCopy, weather, onLiftChanged, onEdited, onSkip, onMarkDone }: Props) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.closest('[role="img"]'))) return;
      if (e.key === 'ArrowLeft' && canStep.prev) onStep(-1);
      if (e.key === 'ArrowRight' && canStep.next) onStep(1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onStep, canStep]);

  const planned = item.kind === 'planned' ? item.w : null;
  const activityId = item.kind === 'activity' ? item.a.id : planned?.match?.source === 'strava' ? planned.match.id : null;
  // A done strength workout opens its Lift session; a planned one shows the Lift session's targets. A home session
  // written as text keeps its own window with the set table, logged or not.
  const home = planned != null && isTextSession(planned) && (planned.match?.source !== 'lift' || planned.match.id === planned.lift?.id);
  const liftId =
    item.kind === 'lift' ? item.l.id
    : home ? null
    : planned?.match?.source === 'lift' ? planned.match.id
    : planned?.state === 'done' && planned.status !== 'done' && planned.lift ? planned.lift.id
    : null;

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
          className={cn(
            'fixed inset-0 z-50 flex flex-col overflow-hidden bg-background shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(76rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border',
            // A rest day is a title and a note: the window fits it instead of a full-height empty sheet.
            planned?.sport === 'rest' && !activityId && !liftId ? 'sm:max-h-[min(52rem,calc(100dvh-3rem))] sm:w-[min(40rem,calc(100vw-3rem))]' : 'sm:h-[min(52rem,calc(100dvh-3rem))]',
          )}
        >
          {activityId ? (
            <ActivityModal key={`a-${activityId}`} id={activityId} planned={planned} onClose={onClose} />
          ) : liftId ? (
            <LiftModal key={`l-${liftId}`} id={liftId} planned={planned} watch={item.kind === 'lift' ? item.a : item.kind === 'planned' ? item.actual : null} onClose={onClose} onLiftChanged={onLiftChanged} />
          ) : planned ? (
            <PlannedModal key={planned.id} w={planned} onClose={onClose} onCopy={onCopy} wx={weather?.[planned.date]} onLiftChanged={onLiftChanged} onEdited={onEdited} onSkip={onSkip} onMarkDone={onMarkDone} />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
