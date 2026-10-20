import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Spinner } from '../components/controls/Spinner'
import { ErrorState, type ErrorKind } from '../components/feedback/ErrorState'
import { SkeletonRegion } from './SkeletonRegion'

/** The part of a React Query (or tRPC) result that `QueryBoundary` reads. */
export interface QueryLike<TData> {
  data: TData | undefined
  error: unknown
  isError: boolean
  isFetching: boolean
  refetch: () => unknown
}

export interface QueryBoundaryProps<TData> {
  query: QueryLike<TData>
  /** The placeholder while there is no data. Default: a centred spinner. */
  loading?: React.ReactNode
  loadingLabel?: string
  /** The title of a retryable failure, for example "We could not load your notes". */
  errorTitle: React.ReactNode
  errorDescription?: React.ReactNode
  errorIcon?: LucideIcon
  classifyError?: (error: unknown) => ErrorKind
  /** When this returns true, `empty` shows in place of `children`. */
  isEmpty?: (data: TData) => boolean
  empty?: React.ReactNode
  children: (data: TData) => React.ReactNode
}

/**
 * The four states of a data screen from one query: loading, error, empty and ready (Kobo `LoadableView`).
 *
 * - A failed query with no data shows `ErrorState`. Permission and not-found are final and show no Retry.
 * - A failed background refetch keeps the data on the screen.
 *
 *     <QueryBoundary query={notes} errorTitle="We could not load your notes" isEmpty={(n) => n.length === 0}
 *       empty={<EmptyState title="No notes yet" />} loading={<RowsSkeleton />}>
 *       {(items) => <NoteList items={items} />}
 *     </QueryBoundary>
 */
export function QueryBoundary<TData>({
  query,
  loading,
  loadingLabel,
  errorTitle,
  errorDescription,
  errorIcon,
  classifyError,
  isEmpty,
  empty,
  children,
}: QueryBoundaryProps<TData>) {
  if (query.data === undefined) {
    if (query.isError) {
      return (
        <ErrorState
          error={query.error}
          title={errorTitle}
          description={errorDescription}
          icon={errorIcon}
          classify={classifyError}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      )
    }
    return (
      <SkeletonRegion
        label={loadingLabel}
        className={loading === undefined ? 'flex items-center justify-center py-12 text-ink-muted' : undefined}
      >
        {loading ?? <Spinner size="lg" />}
      </SkeletonRegion>
    )
  }
  if (isEmpty?.(query.data)) return <>{empty}</>
  return <>{children(query.data)}</>
}
