/** The limit checks of `FileDropzone`. */

export type FileRejection = 'maxSize' | 'type'

/** "10 MB", "512 KB", "500 bytes": a size limit in whole units. */
export function formatFileLimit(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} bytes`
}

/**
 * True when a file matches an `accept` list, as the file input reads it: ".pdf" (a name ending),
 * "image/*" (a type family) or "text/csv" (an exact type). An empty list takes every file.
 */
export function matchesAccept(file: Pick<File, 'name' | 'type'>, accept: string | undefined): boolean {
  const tokens = (accept ?? '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
  if (tokens.length === 0) return true
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token)
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1))
    return type === token
  })
}

/** Why a file cannot be taken, or null when it can. A dropped file skips the picker filter, so check its type too. */
export function checkFile(
  file: Pick<File, 'name' | 'type' | 'size'>,
  limits: { accept?: string; maxSize?: number },
): FileRejection | null {
  if (!matchesAccept(file, limits.accept)) return 'type'
  if (limits.maxSize && file.size > limits.maxSize) return 'maxSize'
  return null
}
