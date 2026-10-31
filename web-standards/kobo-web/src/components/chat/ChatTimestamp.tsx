import * as React from 'react'
import { cn } from '../../lib/cn'
import { timestampLabel } from './chatTimestamps'

/**
 * A quiet, centred time line between messages ("Today 11:33"). Put it above the messages `timestampIndexes` picks.
 *
 *     {timestampIndexes(times).has(i) && <ChatTimestamp at={m.createdAt} />}
 */
export function ChatTimestamp({ at, now, className }: { at: string; now?: Date; className?: string }) {
  return (
    <p className={cn('text-center text-caption text-ink-faint', className)}>
      <time dateTime={at}>{timestampLabel(at, now)}</time>
    </p>
  )
}
