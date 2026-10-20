'use client';

import { useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { CalendarWorkout } from '@/lib/plan/month';
import type { DayWeather } from '@/lib/plan/weather';
import type { Item } from './ItemPreview';
import ActivityModal from './ActivityModal';
import LiftModal from './LiftModal';
import PlannedModal from './PlannedModal';
import { StepContext } from './ModalParts';

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
};

/**
 * The calendar's item modal, in a Strava style with the TrainingPeaks data: the main numbers, planned against
 * completed, the load change, zones and peak curves, laps and the stream charts. A done item links to its full
 * page. ← and → step to the previous and next item.
 */
export default function ItemModal({ item, onClose, onStep, canStep, onCopy, weather, onLiftChanged }: Props) {
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
  // A done strength workout opens its Lift session; a planned one shows the Lift session's targets.
  const liftId =
    item.kind === 'lift' ? item.l.id
    : planned?.match?.source === 'lift' ? planned.match.id
    : planned?.state === 'done' && planned.lift ? planned.lift.id
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
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[min(52rem,calc(100dvh-3rem))] sm:w-[min(76rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border"
        >
          <StepContext.Provider value={{ onStep, prev: canStep.prev, next: canStep.next }}>
          {activityId ? (
            <ActivityModal key={`a-${activityId}`} id={activityId} planned={planned} onClose={onClose} />
          ) : liftId ? (
            <LiftModal key={`l-${liftId}`} id={liftId} planned={planned} onClose={onClose} />
          ) : planned ? (
            <PlannedModal key={planned.id} w={planned} onClose={onClose} onCopy={onCopy} wx={weather?.[planned.date]} onLiftChanged={onLiftChanged} />
          ) : null}
          </StepContext.Provider>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
