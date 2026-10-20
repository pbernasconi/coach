'use client'

import * as React from 'react'
import { CalendarDays, TriangleAlert } from 'lucide-react'
import { NumberFormatBase } from 'react-number-format'
import { cn } from '../../lib/cn'
import { Button, focusRing } from '../controls/Button'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '../overlays/Popover'
import { Calendar } from './Calendar'
import { dateToIso, isoToDate, maskDateDigits, type DateMessages } from './dateText'
import { Input } from './Input'
import { useDateTextField } from './useDateTextField'

export interface DateTextInputProps {
  /** The day as an ISO `yyyy-MM-dd` string. `onChange` fires only with real days inside the bounds. */
  value: string
  onChange: (value: string) => void
  /** Let an optional date be emptied: an empty field fires `onChange('')` and is not an error. */
  clearable?: boolean
  /** Fires when the error of the typed text changes. `null` means the text is a valid date. */
  onErrorChange?: (error: string | null) => void
  /** The first day that can be picked (ISO), inclusive. */
  min?: string
  /** The last day that can be picked (ISO), inclusive. */
  max?: string
  /** The error texts: `invalid`, `beforeMin`, `afterMax`. */
  messages?: Partial<DateMessages>
  /** 'dropdown' shows month and year menus in the calendar, to jump years fast (a birthday). */
  captionLayout?: 'label' | 'dropdown'
  /** The month the calendar opens on when there is no value (ISO). The default is `min`. */
  defaultMonth?: string
  /** Shortcut buttons under the calendar, such as `quickDateChips(todayIso(), { min })`. */
  quickActions?: readonly { label: string; value: string }[]
  disabled?: boolean
  /** The label of the calendar button. The default is "Open calendar for {aria-label}". */
  calendarLabel?: string
  className?: string
}

type NativeProps = Pick<
  React.InputHTMLAttributes<HTMLInputElement>,
  'id' | 'aria-label' | 'aria-invalid' | 'aria-describedby' | 'placeholder' | 'autoComplete' | 'name'
>

/**
 * A date field people can type in: eight digits become MM/DD/YYYY. A button opens a calendar. A pasted
 * "2026-07-24" or "Jul 24, 2026" becomes 07/24/2026. A half-typed date shows no red error until the person
 * leaves the field; a full wrong date shows its error at once, under the field.
 *
 *     <DateTextInput aria-label="Birthday" value={day} onChange={setDay} max={todayIso()} captionLayout="dropdown" />
 */
export function DateTextInput({
  value,
  onChange,
  clearable = false,
  onErrorChange,
  min,
  max,
  messages,
  captionLayout = 'label',
  defaultMonth,
  quickActions = [],
  disabled = false,
  calendarLabel,
  className,
  id,
  name,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  placeholder = 'MM/DD/YYYY',
  autoComplete = 'off',
}: DateTextInputProps & NativeProps) {
  const field = useDateTextField({ value, onChange, clearable, onErrorChange, min, max, messages })
  const containerRef = React.useRef<HTMLDivElement>(null)
  const errorId = React.useId()

  const invalid = field.showError || ariaInvalid === true || ariaInvalid === 'true'
  const describedBy = [ariaDescribedBy, field.showError ? errorId : undefined].filter(Boolean).join(' ') || undefined
  const selected = isoToDate(value)
  const minDate = isoToDate(min)
  const maxDate = isoToDate(max)
  const disabledMatchers = [...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]

  return (
    <div ref={containerRef} className={cn('flex flex-col gap-1.5', className)}>
      <Popover open={field.open} onOpenChange={field.setOpen}>
        <PopoverAnchor asChild>
          <div
            className={cn(
              'relative flex items-center rounded-control border border-line-strong bg-surface',
              'transition-[border-color,box-shadow] duration-(--motion-state) ease-standard',
              'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30',
              invalid && 'border-danger-ink focus-within:border-danger-ink focus-within:ring-danger-ink/25',
              disabled && 'cursor-not-allowed opacity-45',
            )}
          >
            <NumberFormatBase
              customInput={Input}
              format={maskDateDigits}
              removeFormatting={(formatted) => formatted.replace(/\D/g, '').slice(0, 8)}
              isValidInputCharacter={(character) => /\d/.test(character)}
              id={id}
              name={name}
              value={field.digits}
              valueIsNumericString
              onValueChange={(values) => field.changeDigits(values.value)}
              onBlur={field.onBlur}
              onKeyDown={field.onKeyDown}
              onPaste={field.onPaste}
              disabled={disabled}
              type="text"
              inputMode="numeric"
              autoComplete={autoComplete}
              placeholder={placeholder}
              aria-label={ariaLabel}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              className="border-0 bg-transparent pr-10 tabular-nums focus-visible:ring-0"
            />
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                aria-label={calendarLabel ?? (ariaLabel ? `Open calendar for ${ariaLabel}` : 'Open calendar')}
                className={cn(
                  'absolute right-1.5 inline-flex size-7 items-center justify-center rounded-inner text-ink-muted',
                  'hover:bg-surface-raised hover:text-ink disabled:pointer-events-none',
                  focusRing,
                )}
              >
                <CalendarDays aria-hidden="true" className="size-4" />
              </button>
            </PopoverTrigger>
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          // Leave room for the error line, so the open calendar never covers the message.
          sideOffset={field.showError ? 32 : 4}
          className="w-auto overflow-hidden p-0"
          onInteractOutside={(event) => {
            if (event.target instanceof Node && containerRef.current?.contains(event.target)) event.preventDefault()
          }}
        >
          <Calendar
            mode="single"
            className="p-2 [--cell-size:1.75rem] sm:p-3 sm:[--cell-size:2rem]"
            captionLayout={captionLayout}
            selected={selected}
            onSelect={(next: Date | undefined) => next && field.commit(dateToIso(next))}
            defaultMonth={selected ?? isoToDate(defaultMonth) ?? minDate}
            disabled={disabledMatchers.length ? disabledMatchers : undefined}
            startMonth={minDate}
            endMonth={maxDate}
          />
          {quickActions.length > 0 && (
            <div className="flex items-center gap-1 border-t border-line p-1.5 sm:p-2">
              {quickActions.map((action) => (
                <Button
                  key={`${action.label}:${action.value}`}
                  variant="plain"
                  size="compact"
                  className="flex-1"
                  onClick={() => field.commitShortcut(action.value)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {field.showError && (
        <p id={errorId} className="flex items-center gap-1.5 text-footnote font-semibold text-danger-ink">
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
          {field.error}
        </p>
      )}
    </div>
  )
}
