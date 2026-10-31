'use client'

import * as React from 'react'
import { ArrowDown } from 'lucide-react'
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'
import { farFromBottom } from './chatScroll'

export interface ChatConversationProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  children: React.ReactNode
  /** Names the log for screen readers ("Conversation with your assistant"). */
  label?: string
}

/**
 * The scrolling transcript of a chat. It stays pinned to the newest message while a reply streams in, and lets go when
 * the reader scrolls up (it wraps `use-stick-to-bottom`, as Vercel's AI Elements `Conversation` does). Put a
 * `ChatConversationContent` inside, and a `ChatScrollButton` for the jump arrow.
 *
 *     <ChatConversation label="Conversation">
 *       <ChatConversationContent>{messages}</ChatConversationContent>
 *       <ChatScrollButton />
 *     </ChatConversation>
 */
export function ChatConversation({ className, children, label = 'Conversation', ...props }: ChatConversationProps) {
  return (
    <StickToBottom
      className={cn('relative min-h-0 flex-1 overflow-y-hidden', className)}
      initial="instant"
      resize="smooth"
      role="log"
      aria-label={label}
      {...props}
    >
      {children}
    </StickToBottom>
  )
}

/** The column of messages inside a `ChatConversation`. */
export function ChatConversationContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <StickToBottom.Content className={cn('mx-auto flex w-full flex-col gap-5 px-4 py-6', className)}>
      {children}
    </StickToBottom.Content>
  )
}

/**
 * The round arrow that jumps back to the newest message. It shows only when the reader is well away from the bottom
 * (more than `screens` heights of the transcript), so it never flickers while a reply streams.
 */
export function ChatScrollButton({ className, label = 'Jump to latest', screens = 1.5 }: { className?: string; label?: string; screens?: number }) {
  const { isAtBottom, scrollToBottom, scrollRef } = useStickToBottomContext()
  const [far, setFar] = React.useState(false)

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => setFar(farFromBottom(el, screens))
    update()
    el.addEventListener('scroll', update, { passive: true })
    return () => el.removeEventListener('scroll', update)
  }, [scrollRef, screens])

  if (isAtBottom || !far) return null
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => void scrollToBottom()}
      className={cn(
        'absolute bottom-3 left-1/2 inline-flex size-9 -translate-x-1/2 animate-fade-in items-center justify-center rounded-full',
        'border border-line bg-surface text-ink-muted shadow-float hover:text-ink',
        focusRing,
        className,
      )}
    >
      <ArrowDown aria-hidden="true" className="size-4" />
    </button>
  )
}
