'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from '@kobo/web';
import { upcomingWeeks } from '@/lib/plan/planner-steps.mjs';

/**
 * The weeks Paolo can plan, this week and the seven after it, as a menu. Picking one opens the planning screen on
 * it. `children` is the trigger button.
 */
export default function PlanWeekMenu({ weekStart, today, align = 'start', children }: {
  weekStart: string | null; today: string; align?: 'start' | 'end'; children: ReactNode;
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="z-[70] min-w-56 data-[state=closed]:animate-none!">
        <DropdownMenuLabel>Plan a week</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={weekStart ?? ''} onValueChange={(w) => router.push(`/plan/week?week=${w}`)}>
          {upcomingWeeks(today).map((w) => (
            <DropdownMenuRadioItem key={w.monday} value={w.monday} className="justify-between gap-6">
              <span>{w.label}</span>
              {w.label !== w.datesText && <span className="text-xs tabular-nums text-muted-foreground">{w.datesText}</span>}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
