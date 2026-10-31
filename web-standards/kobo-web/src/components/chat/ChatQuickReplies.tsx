import * as React from 'react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'

export interface ChatQuickRepliesProps {
  replies: string[]
  /** A tap sends the reply as the person's message. */
  onReply: (reply: string) => void
  disabled?: boolean
  className?: string
}

/**
 * One-tap answers under the assistant's question, as outlined chips. Show them on the latest reply only.
 *
 *     <ChatQuickReplies replies={['Yes, move it', 'Keep it']} onReply={send} />
 */
export function ChatQuickReplies({ replies, onReply, disabled = false, className }: ChatQuickRepliesProps) {
  if (!replies.length) return null
  return (
    <div role="group" aria-label="Quick replies" className={cn('flex flex-wrap gap-2', className)}>
      {replies.map((r) => (
        <button
          key={r}
          type="button"
          disabled={disabled}
          onClick={() => onReply(r)}
          className={cn(
            'rounded-full border border-line-strong bg-surface px-3 py-1.5 text-subhead text-ink',
            'transition-colors duration-(--motion-state) ease-standard hover:bg-surface-raised disabled:opacity-45',
            focusRing,
          )}
        >
          {r}
        </button>
      ))}
    </div>
  )
}
