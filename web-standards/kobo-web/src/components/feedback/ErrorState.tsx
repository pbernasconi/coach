import * as React from 'react'
import { CircleAlert, Lock, SearchX, type LucideIcon } from 'lucide-react'
import { Button } from '../controls/Button'
import { EmptyState } from './EmptyState'

/** How a failure behaves. Permission and not-found are final: a retry cannot fix them. */
export type ErrorKind = 'retryable' | 'permission' | 'not-found'

interface ErrorLike {
  status?: unknown
  data?: { code?: unknown; httpStatus?: unknown } | null
}

/**
 * The default classifier. It reads an HTTP `status` (403, 404) or a tRPC `data.code` (FORBIDDEN, NOT_FOUND).
 * Pass your own to `ErrorState` and `QueryBoundary` when your errors have another shape.
 */
export function classifyError(error: unknown): ErrorKind {
  if (typeof error !== 'object' || error === null) return 'retryable'
  const { status, data } = error as ErrorLike
  const code = data?.code
  const http = typeof status === 'number' ? status : data?.httpStatus
  if (http === 403 || code === 'FORBIDDEN') return 'permission'
  if (http === 404 || code === 'NOT_FOUND') return 'not-found'
  return 'retryable'
}

export interface ErrorStateProps {
  error: unknown
  /** The title of a retryable failure, for example "We could not load your notes". */
  title: React.ReactNode
  description?: React.ReactNode
  icon?: LucideIcon
  onRetry?: () => void
  retrying?: boolean
  /** The way back from a not-found state, for example a link to the list. Never a retry. */
  notFoundAction?: React.ReactNode
  classify?: (error: unknown) => ErrorKind
  fullPage?: boolean
  className?: string
}

/**
 * The state of a failed load. A failure never looks like "no data".
 * A retryable failure shows Retry. Permission and not-found show their own words and no Retry.
 */
export function ErrorState({
  error,
  title,
  description,
  icon,
  onRetry,
  retrying = false,
  notFoundAction,
  classify = classifyError,
  fullPage,
  className,
}: ErrorStateProps) {
  const kind = classify(error)
  const shared = { fullPage, className }
  if (kind === 'permission') {
    return (
      <EmptyState
        icon={Lock}
        title="You do not have access to this"
        description="Ask an administrator for access."
        {...shared}
      />
    )
  }
  if (kind === 'not-found') {
    return (
      <EmptyState
        icon={SearchX}
        title="We could not find this"
        description="It was removed, or it is not available to you."
        action={notFoundAction}
        {...shared}
      />
    )
  }
  return (
    <div role="alert" className="contents">
      <EmptyState
        icon={icon ?? CircleAlert}
        title={title}
        description={description}
        action={
          onRetry && (
            <Button variant="secondary" size="compact" onClick={onRetry} loading={retrying}>
              Try again
            </Button>
          )
        }
        {...shared}
      />
    </div>
  )
}
