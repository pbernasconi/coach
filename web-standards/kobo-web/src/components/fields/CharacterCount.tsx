import { cn } from '../../lib/cn'
import { isNearLimit } from './characterLimit'

/**
 * A quiet "12/40" counter. It shows while the field has focus, and always from 80% of the limit.
 * Put `group/character-field` on the element that holds the field and the counter.
 *
 *     <div className="group/character-field"><Input maxLength={40} … /><CharacterCount current={title.length} max={40} /></div>
 */
export function CharacterCount({ current, max, className }: { current: number; max: number; className?: string }) {
  return (
    <span
      aria-live="polite"
      className={cn(
        'text-body text-ink-muted tabular-nums',
        !isNearLimit(current, max) && 'opacity-0 group-focus-within/character-field:opacity-100',
        className,
      )}
    >
      {current}/{max}
    </span>
  )
}
