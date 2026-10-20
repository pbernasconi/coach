import { Lock } from 'lucide-react'
import { Skeleton } from '../components/feedback/Skeleton'
import { EmptyState } from '../components/feedback/EmptyState'
import { ErrorState, type ErrorKind } from '../components/feedback/ErrorState'
import { SkeletonRegion } from './SkeletonRegion'
import type { PageGateStatus } from './pageGate'

export interface PageGateStateProps {
  status: Exclude<PageGateStatus, 'allowed'>
  error?: unknown
  onRetry?: () => void
  /** The name of the page, for example "Shared notes". */
  title: string
  /** The words under the denied title. */
  deniedDescription?: string
  /** Classifies the error of a failed session load. The default is `classifyError`. */
  classify?: (error: unknown) => ErrorKind
}

/**
 * The state of a page that needs a permission, while it is not `allowed`: a placeholder while the session
 * loads, an error with Try again when the load fails, and a "not available" state when access is denied.
 * The page stays in place: it does not redirect to a blank page.
 *
 *     const status = pageGateStatus(session, can('notes.share'))
 *     if (status !== 'allowed') return <PageGateState status={status} error={session.error} onRetry={session.refetch} title="Shared notes" />
 */
export function PageGateState({
  status,
  error,
  onRetry,
  title,
  deniedDescription = 'Your access does not include this page. Ask an administrator if you need it.',
  classify,
}: PageGateStateProps) {
  if (status === 'loading') {
    return (
      <SkeletonRegion label={`Loading ${title}`} className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-64 w-full rounded-card" />
      </SkeletonRegion>
    )
  }
  if (status === 'error') {
    return <ErrorState error={error} title={`We could not load ${title}`} onRetry={onRetry} classify={classify} />
  }
  return <EmptyState icon={Lock} title={`${title} is not available`} description={deniedDescription} />
}
