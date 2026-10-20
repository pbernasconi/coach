import { cn } from '@/lib/utils';

/**
 * The Coach logo mark: a "C" ring with a dot, on a rounded tile. The same drawing as src/app/icon.svg (the
 * favicon), but the tile follows the theme (dark on light, light on dark). Decorative: put the name next to it.
 */
export default function CoachMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-6 shrink-0', className)}>
      <rect width="32" height="32" rx="7.5" className="fill-foreground" />
      <path
        d="M21.09 10.35A7.6 7.6 0 1 0 21.09 21.65"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        className="stroke-background"
      />
      <circle cx="23.6" cy="16" r="1.9" fill="var(--coach-accent)" />
    </svg>
  );
}
