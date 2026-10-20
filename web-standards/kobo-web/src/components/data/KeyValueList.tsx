'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** `compact`: the content sets the height (dense detail pages). `comfortable`: tall, even rows (settings pages). */
export type KeyValueRowDensity = 'compact' | 'comfortable'

const DensityContext = createContext<KeyValueRowDensity>('compact')

/** The density that a `KeyValueList` gives to its rows. */
export const useKeyValueRowDensity = (): KeyValueRowDensity => useContext(DensityContext)

export interface KeyValueListProps {
  children: ReactNode
  /** The density of every `KeyValueRow` in the list. A row can still set its own. */
  density?: KeyValueRowDensity
  className?: string
}

/**
 * A stack of `KeyValueRow`s. The last row has no bottom border.
 *
 *     <KeyValueList>
 *       <KeyValueRow label="Email" value="rosa@example.com" />
 *       <KeyValueRow label="Name" value="Rosa Diaz" action={<Button variant="plain" size="compact">Edit</Button>} />
 *     </KeyValueList>
 */
export function KeyValueList({ children, density = 'compact', className }: KeyValueListProps) {
  return (
    <DensityContext.Provider value={density}>
      <div className={cn('[&>*:last-child]:border-b-0', className)}>{children}</div>
    </DensityContext.Provider>
  )
}
