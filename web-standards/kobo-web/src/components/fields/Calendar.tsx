'use client'

import * as React from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { type DayButton, DayPicker, getDefaultClassNames } from 'react-day-picker'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'

const navButton = cn(
  'inline-flex size-(--cell-size) items-center justify-center rounded-control p-0 text-ink select-none',
  'hover:bg-surface-raised aria-disabled:pointer-events-none aria-disabled:opacity-45',
  'transition-colors duration-(--motion-instant) ease-standard',
  focusRing,
)

const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'short' })

/**
 * A month grid (react-day-picker v9) in Kobo tokens. Days are buttons with full spoken dates; the arrow keys
 * move between days. Use it in a `DatePicker` or a popover. Set the cell size with `[--cell-size:2.25rem]`.
 *
 *     <Calendar mode="single" selected={day} onSelect={setDay} disabled={{ before: today }} />
 */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaults = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        'group/calendar bg-surface p-3 text-ink [--cell-size:2rem]',
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      formatters={{ formatMonthDropdown: (date) => monthFormat.format(date), ...formatters }}
      classNames={{
        root: cn('w-fit', defaults.root),
        months: cn('relative flex flex-col gap-4 md:flex-row', defaults.months),
        month: cn('flex w-full flex-col gap-4', defaults.month),
        nav: cn('absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1', defaults.nav),
        button_previous: cn(navButton, defaults.button_previous),
        button_next: cn(navButton, defaults.button_next),
        month_caption: cn(
          'flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)',
          defaults.month_caption,
        ),
        dropdowns: cn(
          'flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-body font-semibold',
          defaults.dropdowns,
        ),
        dropdown_root: cn(
          'relative rounded-control border border-line-strong',
          'has-focus:border-ring has-focus:ring-2 has-focus:ring-ring/30',
          defaults.dropdown_root,
        ),
        dropdown: cn('absolute inset-0 bg-surface opacity-0', defaults.dropdown),
        caption_label: cn(
          'font-semibold select-none',
          captionLayout === 'label'
            ? 'text-body'
            : 'flex h-8 items-center gap-1 rounded-control pr-1 pl-2 text-body [&>svg]:size-3.5 [&>svg]:text-ink-muted',
          defaults.caption_label,
        ),
        month_grid: cn('w-full border-collapse', defaults.month_grid),
        weekdays: cn('flex', defaults.weekdays),
        weekday: cn('flex-1 rounded-inner text-footnote font-normal text-ink-muted select-none', defaults.weekday),
        week: cn('mt-2 flex w-full', defaults.week),
        week_number_header: cn('w-(--cell-size) select-none', defaults.week_number_header),
        week_number: cn('text-footnote text-ink-muted select-none', defaults.week_number),
        day: cn(
          // max-w keeps a cell at 1/7 of the row, so a short last week (no outside days after endMonth) does not stretch.
          'group/day relative aspect-square size-full max-w-[calc(100%/7)] p-0 text-center select-none',
          '[&:first-child[data-selected=true]_button]:rounded-l-inner [&:last-child[data-selected=true]_button]:rounded-r-inner',
          defaults.day,
        ),
        range_start: cn('rounded-l-inner bg-brand-soft', defaults.range_start),
        range_middle: cn('rounded-none', defaults.range_middle),
        range_end: cn('rounded-r-inner bg-brand-soft', defaults.range_end),
        today: cn('rounded-inner bg-surface-raised data-[selected=true]:rounded-none', defaults.today),
        outside: cn('text-ink-faint aria-selected:text-ink-faint', defaults.outside),
        disabled: cn('text-ink-faint opacity-45', defaults.disabled),
        hidden: cn('invisible', defaults.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className: rootClassName, rootRef, ...rootProps }) => (
          <div data-slot="calendar" ref={rootRef} className={cn(rootClassName)} {...rootProps} />
        ),
        Chevron: ({ className: chevronClassName, orientation }) => {
          const Icon = orientation === 'left' ? ChevronLeft : orientation === 'right' ? ChevronRight : ChevronDown
          return <Icon aria-hidden="true" className={cn('size-4', chevronClassName)} />
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...cellProps }) => (
          <td {...cellProps}>
            <div className="flex size-(--cell-size) items-center justify-center text-center">{children}</div>
          </td>
        ),
        ...components,
      }}
      {...props}
    />
  )
}

/** One day of a `Calendar`. It takes focus when the grid moves the keyboard focus to its day. */
function CalendarDayButton({ className, day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  const defaults = getDefaultClassNames()
  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  const single = modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.isoDate}
      data-selected-single={single || undefined}
      data-range-start={modifiers.range_start || undefined}
      data-range-end={modifiers.range_end || undefined}
      data-range-middle={modifiers.range_middle || undefined}
      className={cn(
        'flex aspect-square h-auto w-full min-w-(--cell-size) flex-col items-center justify-center gap-1 rounded-inner',
        'text-body leading-none font-normal text-inherit hover:bg-surface-raised disabled:pointer-events-none',
        'transition-colors duration-(--motion-instant) ease-standard',
        'data-[selected-single=true]:bg-brand data-[selected-single=true]:font-semibold data-[selected-single=true]:text-on-brand',
        'data-[range-start=true]:bg-brand data-[range-start=true]:text-on-brand',
        'data-[range-end=true]:bg-brand data-[range-end=true]:text-on-brand',
        'data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-brand-soft data-[range-middle=true]:text-brand-ink',
        // A focused day sits above its neighbours, so its focus ring is never covered.
        'group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-sticky',
        '[&>span]:text-footnote [&>span]:opacity-70',
        focusRing,
        defaults.day,
        className,
      )}
      {...props}
    />
  )
}
