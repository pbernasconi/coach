import { cn } from '../../lib/cn'
import { TONE_CLASS, type Tone } from '../../lib/tone'
import { clampFraction } from './meterMath'

export interface MeterProps {
  /** The fill, from 0 to 1. Values outside clamp. */
  value: number
  /** The fill colour. Use `meterTone()` to pick it from thresholds. */
  tone?: Tone
  size?: 'sm' | 'md'
  /** What the meter measures. Required: a bar alone says nothing to a screen reader. */
  label: string
  /** The spoken value, for example "62 percent used". Default: the percent. */
  valueText?: string
  className?: string
}

/**
 * A horizontal fill bar for a part of a whole (storage used, a budget spent).
 * Show the number next to it too: the bar never carries the meaning alone.
 */
export function Meter({ value, tone = 'brand', size = 'sm', label, valueText, className }: MeterProps) {
  const fraction = clampFraction(value)
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
      aria-valuetext={valueText ?? `${Math.round(fraction * 100)} percent`}
      className={cn('w-full overflow-hidden rounded-full bg-surface-sunken', size === 'sm' ? 'h-1.5' : 'h-2.5', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-(--motion-enter) ease-standard', TONE_CLASS[tone].solid)}
        style={{ width: `${fraction * 100}%` }}
      />
    </div>
  )
}
