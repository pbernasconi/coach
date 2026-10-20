/** The words of the footer under a paged list. Pass your own to `LoadMoreRow` to change any of them. */
export interface LoadMoreCopy {
  loadMore: string
  retry: string
  failed: string
  /** The notice when the server stopped the list at a limit. */
  ceiling: string
  /** The count line. `total` is null when the list has no total. */
  showing: (loaded: number, total: number | null) => string
}

export const LOAD_MORE_COPY: LoadMoreCopy = {
  loadMore: 'Load more',
  retry: 'Try again',
  failed: 'We could not load more',
  ceiling: 'Narrow your filters to see older results.',
  showing: (loaded, total) => (total === null ? `Showing ${loaded}` : `Showing ${loaded} of ${total}`),
}

/** The paging state a server sends with a page of a list. */
export interface PageInfo {
  hasMore: boolean
  nextCursor: string | null
  /** The server stopped the list at a limit. Missing means false. */
  bounded?: boolean
}

/**
 * What the footer of a paged list offers. `loadMore`: a cursor is present. `ceiling`: the server stopped the
 * list and says so with `bounded`. `end`: nothing more. A null cursor never loads more, whatever `hasMore` says.
 */
export function pageFooterAction(pageInfo: PageInfo): 'loadMore' | 'ceiling' | 'end' {
  if (pageInfo.nextCursor !== null) return 'loadMore'
  if (pageInfo.bounded === true) return 'ceiling'
  return 'end'
}

export interface LoadMoreInput {
  hasMore: boolean
  bounded?: boolean
  error?: unknown
  count?: { loaded: number; total: number | null }
  summary?: string
}

/** The parts of the footer. A null part is not drawn. */
export interface LoadMoreModel {
  countLine: string | null
  ceiling: string | null
  failed: boolean
  /** The one button: Retry after a failure, Load more while there is more, or none. */
  button: { label: string; action: 'retry' | 'loadMore' } | null
}

/** The words and the one control of the footer, from its state. */
export function loadMoreModel(input: LoadMoreInput, copy: LoadMoreCopy = LOAD_MORE_COPY): LoadMoreModel {
  const failed = input.error !== undefined && input.error !== null && input.error !== false
  const ceilingShown = input.bounded === true && !input.hasMore
  return {
    countLine: input.summary ?? (input.count ? copy.showing(input.count.loaded, input.count.total) : null),
    ceiling: ceilingShown ? copy.ceiling : null,
    failed,
    button: failed
      ? { label: copy.retry, action: 'retry' }
      : input.hasMore
        ? { label: copy.loadMore, action: 'loadMore' }
        : null,
  }
}

/** True when the footer has nothing to show. */
export function isEmptyFooter(model: LoadMoreModel): boolean {
  return model.countLine === null && model.ceiling === null && model.button === null
}
