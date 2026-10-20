'use client';

import { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZES = { xs: 'h-7 w-7', sm: 'h-12 w-12', md: 'h-20 w-20', lg: 'h-36 w-36' } as const;

/**
 * The exercise picture from the Lift catalog: the still image, and the animation while the pointer or focus is on
 * it (always animated with `play`). Without catalog media it shows a dumbbell tile. Plain <img>: the media is
 * loaded from the dataset at its pinned commit and never proxied (src/lib/lift/catalog.ts).
 */
export default function ExerciseThumb({
  image, gif, name, size = 'md', play = false, className,
}: {
  image: string | null | undefined;
  gif?: string | null;
  name: string;
  size?: keyof typeof SIZES;
  play?: boolean;
  className?: string;
}) {
  const [active, setActive] = useState(false);
  const box = cn('relative shrink-0 overflow-hidden rounded-lg border bg-white', SIZES[size], className);
  if (!image) {
    return (
      <div className={cn(box, 'grid place-items-center bg-[color-mix(in_oklab,var(--sport-strength)_10%,transparent)]')} aria-hidden>
        <Dumbbell className={cn(size === 'xs' ? 'h-3.5 w-3.5' : 'h-1/3 w-1/3')} style={{ color: 'var(--sport-strength)' }} />
      </div>
    );
  }
  const animate = Boolean(gif) && (play || active);
  return (
    <div
      className={box}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      tabIndex={gif && !play ? 0 : undefined}
      title={gif && !play ? `${name}: hover to play` : name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- third-party media, never proxied (catalog.ts) */}
      <img src={animate ? gif! : image} alt={name} loading="lazy" decoding="async" className="h-full w-full object-contain" />
    </div>
  );
}
