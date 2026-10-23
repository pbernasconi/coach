import { cn } from '@/lib/utils';

/**
 * The Coach logo mark: a progress ring, mostly filled in the brand orange, with a dot where it ends, on a rounded
 * tile. The same drawing as src/app/icon.svg (the favicon) and the iOS app icon (lift/ios/Design/AppIcon.svg), but
 * the tile follows the theme (dark on light, light on dark). Decorative: put the name next to it.
 */
export default function CoachMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-6 shrink-0', className)}>
      <rect width="32" height="32" rx="7.5" className="fill-foreground" />
      <circle cx="16" cy="16" r="8" fill="none" strokeWidth="3.2" strokeOpacity="0.14" className="stroke-background" />
      <path
        d="M16 8A8 8 0 1 0 23.6 18.5"
        fill="none"
        strokeWidth="3.2"
        strokeLinecap="round"
        stroke="var(--coach-accent)"
      />
      <circle cx="23.6" cy="18.5" r="1.25" className="fill-background" />
    </svg>
  );
}
