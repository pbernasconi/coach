/** The words of `RouteErrorScreen`. Pass your own to change any of them. */
export interface RouteErrorCopy {
  title: string
  description: string
  retry: string
  staleTitle: string
  staleDescription: string
  reload: string
}

export const ROUTE_ERROR_COPY: RouteErrorCopy = {
  title: 'Something went wrong',
  description: 'An error stopped this page. Try again, or contact support if it keeps happening.',
  retry: 'Try again',
  staleTitle: 'A new version is available',
  staleDescription: 'Reload to get the latest update.',
  reload: 'Reload',
}

const STALE_BUILD = [
  /ChunkLoadError/i,
  /Loading (?:CSS )?chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
]

/**
 * True when the error comes from a code file of an old build that the server no longer has: a new version
 * shipped while the tab was open. A reload fixes it, so the screen offers Reload, not "Something went wrong".
 */
export function isStaleBuildError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { name, message } = error as { name?: unknown; message?: unknown }
  const text = `${typeof name === 'string' ? name : ''} ${typeof message === 'string' ? message : ''}`
  return STALE_BUILD.some((pattern) => pattern.test(text))
}
