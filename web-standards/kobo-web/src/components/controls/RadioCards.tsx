'use client'

import { cn } from '../../lib/cn'
import { RadioGroup, RadioGroupItem } from './RadioGroup'

export interface RadioCardOption {
  id: string
  label: string
  disabled?: boolean
}

export interface RadioCardsProps {
  options: RadioCardOption[]
  value: string
  onValueChange: (value: string) => void
  className?: string
  /** The name of the group. */
  'aria-label'?: string
  'aria-labelledby'?: string
}

/**
 * A radio group drawn as cards. The whole card is the click target and its text does not select.
 *
 *     <RadioCards aria-label="Repeat" value={repeat} onValueChange={setRepeat}
 *       options={[{ id: 'daily', label: 'Every day' }, { id: 'weekly', label: 'Every week' }]} />
 */
export function RadioCards({ options, value, onValueChange, className, ...aria }: RadioCardsProps) {
  return (
    <RadioGroup value={value} onValueChange={onValueChange} className={cn('grid gap-2.5', className)} {...aria}>
      {options.map((option) => {
        const selected = value === option.id
        return (
          <label
            key={option.id}
            className={cn(
              'relative flex cursor-pointer items-center gap-2.5 rounded-control border bg-surface px-3.5 py-2.5 select-none',
              'transition-colors duration-(--motion-state) ease-standard',
              selected ? 'border-brand bg-brand-soft' : 'border-line-strong hover:bg-surface-raised',
              option.disabled && 'cursor-not-allowed opacity-45',
            )}
          >
            <RadioGroupItem value={option.id} disabled={option.disabled} className="shrink-0" />
            <span className="text-body leading-none font-semibold text-ink">{option.label}</span>
          </label>
        )
      })}
    </RadioGroup>
  )
}
