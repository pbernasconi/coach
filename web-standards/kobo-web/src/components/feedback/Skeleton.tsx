import * as React from 'react'
import { cn } from '../../lib/cn'

/** A placeholder bar. It is decorative: wrap a group of them in `SkeletonRegion`, which announces the load. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn('animate-shimmer rounded-inner bg-surface-raised', className)} {...props} />
}

/** Placeholder rows for a list or table. */
export function RowsSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('flex flex-col', className)}>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-3 border-b border-line py-row last:border-b-0">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  )
}
