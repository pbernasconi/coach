'use client'

import * as React from 'react'
import { CalendarDays } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from '../controls/Button'
import { Popover, PopoverContent, PopoverTrigger } from '../overlays/Popover'
import { Calendar } from './Calendar'
import { dateToIso, formatMediumDate, isoToDate } from './dateText'

export interface DatePickerProps {
  /** The picked day as an ISO `yyyy-MM-dd` string. An empty string is no day. */
  value: string
  /** Fires with the new ISO day, or '' when the day is cleared. */
  onChange: (value: string) => void
  /** The first day that can be picked (ISO), inclusive. */
  min?: string
  /** The last day that can be picked (ISO), inclusive. */
  max?: string
  placeholder?: string
  disabled?: boolean
  /** Show a Clear button under the calendar when a day is picked. */
  clearable?: boolean
  /** The label of the Clear button. */
  clearLabel?: string
  /** 'dropdown' shows month and year menus, for days far away (a birthday). */
  captionLayout?: 'label' | 'dropdown'
  id?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  className?: string
}

/**
 * A button that shows the picked day ("Jul 15, 2026") and opens a calendar. Use `DateTextInput` when people
 * also type the date.
 *
 *     <DatePicker aria-label="Trip start" value={start} onChange={setStart} min={todayIso()} clearable />
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = 'Select a date',
  disabled = false,
  clearable = false,
  clearLabel = 'Clear',
  captionLayout = 'label',
  id,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = isoToDate(value)
  const minDate = isoToDate(min)
  const maxDate = isoToDate(max)
  // Bound the months people can page to, so they never page into months with no day to pick.
  const disabledMatchers = [...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]
  const label = (value && formatMediumDate(value)) || placeholder

  const pick = (next: Date | undefined) => {
    onChange(next ? dateToIso(next) : '')
    // Close on any pick: a new day, or the same day again (single mode turns it off).
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          disabled={disabled}
          className={cn(
            'w-full justify-start gap-2 px-3 font-normal',
            'aria-[invalid=true]:border-danger-ink',
            !value && 'text-ink-faint',
            className,
          )}
        >
          <CalendarDays aria-hidden="true" className="text-ink-muted" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto overflow-hidden p-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={pick}
          defaultMonth={selected ?? minDate}
          disabled={disabledMatchers.length ? disabledMatchers : undefined}
          startMonth={minDate}
          endMonth={maxDate}
          captionLayout={captionLayout}
          autoFocus
        />
        {clearable && value && (
          <div className="border-t border-line p-2">
            <Button
              variant="plain"
              size="compact"
              className="w-full text-ink-muted"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              {clearLabel}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
