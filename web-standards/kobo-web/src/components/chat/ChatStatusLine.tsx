import * as React from 'react'
import { cn } from '../../lib/cn'

/** Three dots that pulse one after another: the assistant is writing. Decorative; the status line carries the words. */
export function ChatTypingDots({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('inline-flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-shimmer rounded-full bg-ink-faint"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  )
}

export interface ChatStatusLineProps {
  /** What the assistant is doing now, in a few words ("Reading your week", "Checking the changes"). */
  children: React.ReactNode
  className?: string
}

/**
 * One quiet line while an answer is on its way: typing dots and what is happening. A polite live region, so a
 * screen reader hears each step once.
 *
 *     <ChatStatusLine>Reading your notes</ChatStatusLine>
 */
export function ChatStatusLine({ children, className }: ChatStatusLineProps) {
  return (
    <div role="status" aria-live="polite" className={cn('flex items-center gap-2 text-subhead text-ink-muted', className)}>
      <ChatTypingDots />
      <span className="animate-shimmer">{children}</span>
    </div>
  )
}
