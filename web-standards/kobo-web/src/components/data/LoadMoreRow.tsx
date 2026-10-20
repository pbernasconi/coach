import { cn } from '../../lib/cn'
import { Button } from '../controls/Button'
import { isEmptyFooter, LOAD_MORE_COPY, loadMoreModel, type LoadMoreCopy } from './loadMoreModel'

export interface LoadMoreRowProps {
  /** A cursor is present: Load more can ask for the next page. */
  hasMore: boolean
  /** The server stopped the list at a limit. The notice shows once no cursor is left. */
  bounded?: boolean
  /** The next page is loading. The button spins and keeps its width. */
  isLoading: boolean
  /** The last Load more failed. The loaded rows stay, a line says so, and the button reads "Try again". */
  error?: unknown
  onLoadMore: () => void
  /** The default is `onLoadMore`. */
  onRetry?: () => void
  /** Shows "Showing N of total" (or "Showing N" when `total` is null). */
  count?: { loaded: number; total: number | null }
  /** A list with its own count line passes it here in place of `count`. */
  summary?: string
  /** Change any of the words. */
  copy?: Partial<LoadMoreCopy>
  className?: string
}

/**
 * The footer under a paged list: a count line with tabular digits, a small Load more button that spins in
 * place, a failure line with Try again that keeps the loaded rows, and the notice when the server stops the list.
 *
 *     <LoadMoreRow hasMore={Boolean(cursor)} isLoading={fetching} error={pageError}
 *       onLoadMore={fetchNext} count={{ loaded: notes.length, total }} />
 */
export function LoadMoreRow({
  hasMore,
  bounded,
  isLoading,
  error,
  onLoadMore,
  onRetry,
  count,
  summary,
  copy,
  className,
}: LoadMoreRowProps) {
  const words = { ...LOAD_MORE_COPY, ...copy }
  const model = loadMoreModel({ hasMore, bounded, error, count, summary }, words)
  if (isEmptyFooter(model)) return null
  const onClick = model.button?.action === 'retry' ? (onRetry ?? onLoadMore) : onLoadMore
  return (
    <div className={cn('flex flex-col gap-3 border-t border-line px-4 py-3 text-body text-ink-muted', className)}>
      {(model.countLine !== null || model.ceiling !== null) && (
        <div className="flex items-center justify-between gap-3">
          <span className="tabular-nums">{model.countLine}</span>
          {model.ceiling && <span className="text-footnote">{model.ceiling}</span>}
        </div>
      )}
      {model.failed && (
        <p role="alert" className="text-center text-footnote text-danger-ink">
          {words.failed}
        </p>
      )}
      {model.button && (
        <div className="flex justify-center">
          <Button size="compact" variant="outline" loading={isLoading} onClick={onClick}>
            {model.button.label}
          </Button>
        </div>
      )}
    </div>
  )
}
