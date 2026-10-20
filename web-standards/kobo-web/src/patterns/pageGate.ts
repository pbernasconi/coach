/** Where a page that needs a permission stands while the session loads, fails or decides. */
export type PageGateStatus = 'loading' | 'error' | 'denied' | 'allowed'

/**
 * The gate decision of a page that needs a permission. `allowed` is read only once the session is known.
 * A session that is not there yet is `loading` (or `error` when its load failed), never `denied`, so a slow
 * session never flashes the denied state and a failed one offers a retry.
 */
export function pageGateStatus(session: { data?: unknown; isError?: boolean }, allowed: boolean): PageGateStatus {
  if (session.data === undefined || session.data === null) return session.isError ? 'error' : 'loading'
  return allowed ? 'allowed' : 'denied'
}
