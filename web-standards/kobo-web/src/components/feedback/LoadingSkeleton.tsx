import type { JSX } from 'react'
import { cn } from '../../lib/cn'
import { SkeletonRegion } from '../../patterns/SkeletonRegion'
import { Skeleton } from './Skeleton'

export type LoadingSkeletonVariant = 'page' | 'table' | 'card' | 'profile'

export interface LoadingSkeletonProps {
  variant: LoadingSkeletonVariant
  /** The words a screen reader says while the region loads. */
  label?: string
  className?: string
}

function PageBars() {
  return (
    <div className="flex flex-col gap-6" data-shape="page">
      <Skeleton className="h-8 w-[260px] max-w-full" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[85%]" />
        <Skeleton className="h-4 w-[70%]" />
      </div>
    </div>
  )
}

function TableRowBars({ header = false }: { header?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 border-b border-line px-4 py-3 last:border-0',
        header && 'bg-surface-raised/40',
      )}
    >
      <Skeleton className="h-4 w-[100px]" />
      <Skeleton className="h-4 w-[140px]" />
      <Skeleton className="h-4 w-[80px]" />
      <Skeleton className="ml-auto h-4 w-[100px]" />
    </div>
  )
}

function TableBars() {
  return (
    <div className="rounded-card border border-line" data-shape="table">
      <TableRowBars header />
      {Array.from({ length: 5 }, (_, row) => (
        <TableRowBars key={row} />
      ))}
    </div>
  )
}

function CardBars() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-shape="card">
      {Array.from({ length: 3 }, (_, card) => (
        <div key={card} className="flex flex-col gap-4 rounded-card border border-line p-6">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-[120px]" />
            <Skeleton className="h-7 w-[180px] max-w-full" />
          </div>
          <Skeleton className="h-px w-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-[75%]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ProfileBars() {
  return (
    <div className="flex items-start gap-4" data-shape="profile">
      <Skeleton className="size-12 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-[160px]" />
        <Skeleton className="h-3 w-[220px] max-w-full" />
      </div>
    </div>
  )
}

const SHAPES: Record<LoadingSkeletonVariant, () => JSX.Element> = {
  page: PageBars,
  table: TableBars,
  card: CardBars,
  profile: ProfileBars,
}

/**
 * A ready-made loading placeholder in one of four shapes. It fades in and says "Loading" one time.
 *
 *     <LoadingSkeleton variant="table" />
 */
export function LoadingSkeleton({ variant, label, className }: LoadingSkeletonProps) {
  const Shape = SHAPES[variant]
  return (
    <SkeletonRegion label={label} className={cn('animate-fade-in', className)}>
      <Shape />
    </SkeletonRegion>
  )
}
