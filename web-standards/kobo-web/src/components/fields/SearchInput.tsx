'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Input, type InputProps } from './Input'

export interface SearchInputProps extends Omit<InputProps, 'type' | 'onClear'> {
  /** Runs after the clear button empties the field (the field also fires `onChange` with an empty value). */
  onClear?: () => void
}

/**
 * A search field: a search icon, `type="search"` and a clear button that shows when there is text.
 *
 *     <SearchInput aria-label="Search notes" value={query} onChange={(e) => setQuery(e.target.value)} />
 */
export function SearchInput({ className, wrapperClassName, onClear, clearLabel = 'Clear search', ...props }: SearchInputProps) {
  return (
    <div className={cn('relative w-full', wrapperClassName)}>
      <Input
        type="search"
        clearLabel={clearLabel}
        onClear={() => onClear?.()}
        className={cn('pl-9 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden', className)}
        {...props}
      />
      {/* After the field in the DOM, so it paints above the field's background without a z-index. */}
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
      />
    </div>
  )
}
