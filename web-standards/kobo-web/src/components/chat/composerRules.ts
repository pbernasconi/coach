/** What a key press in the composer does: send the message, or nothing special (a newline, typing). */
export function composerKeyAction(e: { key: string; shiftKey?: boolean; altKey?: boolean; isComposing?: boolean }): 'send' | null {
  if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.isComposing) return null
  return 'send'
}

/** Whether Send is ready: words or a finished file to send, nothing uploading, and no answer on its way. */
export function canSend(text: string, files: { state: 'uploading' | 'ready' | 'failed' }[], busy: boolean): boolean {
  if (busy) return false
  if (files.some((f) => f.state === 'uploading')) return false
  return text.trim().length > 0 || files.some((f) => f.state === 'ready')
}

/** The files among `list` that the composer takes (by MIME type or extension in `accept`), at most `max` of them. */
export function acceptedFiles<T extends { name: string; type: string }>(list: T[], accept: string, max: number): T[] {
  const rules = accept.split(',').map((r) => r.trim().toLowerCase()).filter(Boolean)
  const ok = (f: T) =>
    !rules.length ||
    rules.some((r) =>
      r.startsWith('.') ? f.name.toLowerCase().endsWith(r) : r.endsWith('/*') ? f.type.startsWith(r.slice(0, -1)) : f.type === r,
    )
  return list.filter(ok).slice(0, Math.max(0, max))
}
