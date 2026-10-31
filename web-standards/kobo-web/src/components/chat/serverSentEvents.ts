/** One Server-Sent Event: its `event:` name (`message` when it has none) and its `data:` lines joined. */
export type ServerSentEvent = { event: string; data: string }

/**
 * A parser for a `text/event-stream` body that arrives in pieces. Feed it each decoded chunk; it returns the events
 * that chunk finished. Comment lines (`: padding`) are skipped; a chunk may end mid-line.
 *
 *     const parse = createEventStreamParser()
 *     for (const e of parse(decoder.decode(chunk, { stream: true }))) handle(e.event, JSON.parse(e.data))
 */
export function createEventStreamParser(): (chunk: string) => ServerSentEvent[] {
  let buffer = ''
  let event = ''
  let data: string[] = []
  return (chunk) => {
    buffer += chunk
    const out: ServerSentEvent[] = []
    let nl: number
    while ((nl = buffer.search(/\r?\n/)) >= 0) {
      const line = buffer.slice(0, nl)
      buffer = buffer.slice(buffer[nl] === '\r' ? nl + 2 : nl + 1)
      if (line === '') {
        if (data.length) out.push({ event: event || 'message', data: data.join('\n') })
        event = ''
        data = []
      } else if (line.startsWith(':')) {
        continue
      } else {
        const colon = line.indexOf(':')
        const field = colon < 0 ? line : line.slice(0, colon)
        const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '')
        if (field === 'event') event = value
        else if (field === 'data') data.push(value)
      }
    }
    return out
  }
}
