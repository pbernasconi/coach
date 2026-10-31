import * as React from 'react'
import { cn } from '../../lib/cn'

export interface ChatMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `user`: a grey bubble on the right. `assistant`: plain text across the column, like a document. */
  from: 'user' | 'assistant'
  /** What goes above the bubble or text: the photos and files sent with it, or a "Thought" row. */
  header?: React.ReactNode
  /** What goes under the text: cards, quick replies, the feedback row. */
  footer?: React.ReactNode
}

/**
 * One message of a chat. The person's words sit in a soft bubble on the right; the assistant's answer is plain text
 * on the page with its cards under it.
 *
 *     <ChatMessage from="user">Can we move the review to Thursday?</ChatMessage>
 *     <ChatMessage from="assistant" footer={<ChatFeedbackRow … />}><ChatMarkdown>{reply}</ChatMarkdown></ChatMessage>
 */
export function ChatMessage({ from, header, footer, className, children, ...props }: ChatMessageProps) {
  const user = from === 'user'
  return (
    <div
      data-from={from}
      className={cn('group/message flex w-full flex-col gap-3', user ? 'items-end' : 'items-start', className)}
      {...props}
    >
      {header}
      {children != null && children !== '' && (
        <div
          className={cn(
            'text-reading text-ink',
            user ? 'max-w-[80%] rounded-sheet bg-surface-raised px-4 py-2 whitespace-pre-wrap break-words' : 'w-full',
          )}
        >
          {children}
        </div>
      )}
      {footer}
    </div>
  )
}
