'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '../lib/cn'
import { Button } from '../components/controls/Button'
import { isStaleBuildError, ROUTE_ERROR_COPY, type RouteErrorCopy } from './routeError'

export interface RouteErrorScreenProps {
  error: Error & { digest?: string }
  /** Renders the page again. */
  reset: () => void
  /** Sends the error to your error tracker. It runs one time for each error. */
  onReport?: (error: Error & { digest?: string }) => void
  /** Fill the screen (a page with no app frame). The default is 60% of the screen height. */
  fullScreen?: boolean
  /** A second way out next to Try again, for example a link home. */
  secondaryAction?: ReactNode
  /** Decides if the error comes from an old build. A reload fixes those. */
  isStaleBuild?: (error: unknown) => boolean
  /** The default reloads the page. */
  onReload?: () => void
  copy?: Partial<RouteErrorCopy>
  className?: string
}

/**
 * The screen of a route error boundary. It reports the error one time. An error from an old build (a new
 * version shipped while the tab was open) shows a Reload screen in place of "Something went wrong".
 *
 *     // app/notes/error.tsx
 *     export default function NotesError({ error, reset }) {
 *       return <RouteErrorScreen error={error} reset={reset} onReport={report}
 *         secondaryAction={<Button variant="outline" asChild><a href="/">Go home</a></Button>} />
 *     }
 */
export function RouteErrorScreen({
  error,
  reset,
  onReport,
  fullScreen = false,
  secondaryAction,
  isStaleBuild = isStaleBuildError,
  onReload = () => window.location.reload(),
  copy,
  className,
}: RouteErrorScreenProps) {
  const words = { ...ROUTE_ERROR_COPY, ...copy }
  const stale = isStaleBuild(error)

  // Report each error one time. A new onReport function on a re-render does not report again.
  const report = useRef(onReport)
  report.current = onReport
  useEffect(() => {
    report.current?.(error)
  }, [error])

  const frame = cn(
    'flex flex-col items-center justify-center p-8 text-center',
    fullScreen ? 'min-h-dvh' : 'min-h-[60dvh]',
    className,
  )

  if (stale) {
    return (
      <div className={frame}>
        <RefreshCw aria-hidden="true" className="size-6 text-ink-muted" />
        <h1 className="mt-4 text-title2 text-ink">{words.staleTitle}</h1>
        <p className="mt-1 text-body text-ink-muted">{words.staleDescription}</p>
        <Button className="mt-6" onClick={onReload}>
          {words.reload}
        </Button>
      </div>
    )
  }

  return (
    <div className={frame}>
      <h1 className="text-title text-ink">{words.title}</h1>
      <p className="mt-2 max-w-md text-body text-ink-muted">{words.description}</p>
      <div className="mt-6 flex gap-3">
        <Button onClick={() => reset()}>{words.retry}</Button>
        {secondaryAction}
      </div>
    </div>
  )
}
