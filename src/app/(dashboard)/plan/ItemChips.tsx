'use client';

import CalendarCard from '@/components/plan/CalendarCard';
import type { Item } from './ItemPreview';
import { WORKOUT_MIME } from './WorkoutLibrary';
import type { Handlers } from './calendarShared';

/** A calendar card on /plan: opens the item preview on click; a planned workout drags to another day. */
export function Chip({ item, h, roomy = false }: { item: Item; h: Handlers; roomy?: boolean }) {
  return (
    <CalendarCard
      item={item}
      roomy={roomy}
      action={{ onClick: (e) => h.open({ kind: 'item', key: item.key }, e.currentTarget) }}
      drag={
        item.kind === 'planned'
          ? {
              onDragStart: (e) => {
                e.dataTransfer.setData(WORKOUT_MIME, item.w.id);
                e.dataTransfer.setData('text/plain', item.w.id);
                e.dataTransfer.effectAllowed = 'move';
                e.currentTarget.classList.add('plan-dragging');
              },
              onDragEnd: (e) => e.currentTarget.classList.remove('plan-dragging'),
            }
          : undefined
      }
    />
  );
}
