import * as React from 'react'

export interface SkeletonRegionProps {
  /** The words a screen reader says while the region loads. */
  label?: string
  className?: string
  /** Skeleton bars or a spinner. They are decorative. */
  children: React.ReactNode
}

/**
 * The container of a loading placeholder. It sets `aria-busy`, and one `role="status"` node says the label,
 * so a screen reader hears "Loading" one time, not one time for each bar.
 */
export function SkeletonRegion({ label = 'Loading', className, children }: SkeletonRegionProps) {
  return (
    <div aria-busy="true" className={className}>
      {children}
      <span role="status" className="sr-only">
        {label}
      </span>
    </div>
  )
}
