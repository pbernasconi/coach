import * as React from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'
import { formatPillCount } from './pillCount'

export interface FilterPill {
  id: string
  label: string
  count?: number
  /** False when `count` is a floor, not a total. The pill then reads "200+". */
  countIsExact?: boolean
}

export interface FilterPillsProps {
  filters: FilterPill[]
  activeFilter: string
  onFilterChange: (id: string) => void
  /** Shows a remove (×) button on the active pill. */
  onRemoveFilter?: (id: string) => void
  /** Shows an "Add filter" pill at the end. */
  onAddFilter?: () => void
  addLabel?: string
  /** The name of the remove button. */
  removeLabel?: (label: string) => string
  className?: string
}

const pillBase = cn(
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-body font-semibold',
  'transition-colors duration-(--motion-state) ease-standard',
  focusRing,
)

/**
 * A row of single-choice filter pills. The active pill is filled and has `aria-pressed`. Counts read "N+"
 * when they are a floor.
 *
 *     <FilterPills filters={[{ id: 'all', label: 'All' }, { id: 'open', label: 'Open', count: 4 }]}
 *       activeFilter={filter} onFilterChange={setFilter} />
 */
export function FilterPills({
  filters,
  activeFilter,
  onFilterChange,
  onRemoveFilter,
  onAddFilter,
  addLabel = 'Add filter',
  removeLabel = (label) => `Remove ${label}`,
  className,
}: FilterPillsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {filters.map((filter) => {
        const isActive = filter.id === activeFilter
        const pill = (
          <button
            key={filter.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              pillBase,
              'border',
              isActive
                ? 'border-brand bg-brand text-on-brand hover:bg-brand/90'
                : 'border-line bg-surface text-ink hover:bg-surface-raised',
              isActive && onRemoveFilter && 'rounded-l-none border-l-0 pl-1.5',
            )}
          >
            {filter.label}
            {filter.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-footnote tabular-nums',
                  isActive ? 'bg-on-brand/20 text-on-brand' : 'bg-surface-raised text-ink-muted',
                )}
              >
                {formatPillCount(filter.count, filter.countIsExact)}
              </span>
            )}
          </button>
        )
        if (!isActive || !onRemoveFilter) return pill
        // The remove button sits beside the pill, never inside it: a button cannot hold another button.
        return (
          <span key={filter.id} className="group inline-flex">
            <button
              type="button"
              aria-label={removeLabel(filter.label)}
              onClick={() => onRemoveFilter(filter.id)}
              className={cn(
                pillBase,
                'rounded-r-none border border-r-0 border-brand bg-brand pr-0 pl-2.5 text-on-brand hover:bg-brand/90',
              )}
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
            {pill}
          </span>
        )
      })}

      {onAddFilter && (
        <button
          type="button"
          onClick={onAddFilter}
          className={cn(
            pillBase,
            'border border-dashed border-line-strong text-ink-muted hover:border-ink hover:text-ink',
          )}
        >
          <Plus aria-hidden="true" className="size-3.5" />
          {addLabel}
        </button>
      )}
    </div>
  )
}
