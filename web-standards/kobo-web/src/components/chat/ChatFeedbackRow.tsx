'use client'

import * as React from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'
import { CopyButton } from '../controls/CopyButton'

export type ChatRating = 'up' | 'down' | null

export interface ChatFeedbackRowProps {
  /** The reply's text, for Copy. */
  text: string
  rating?: ChatRating
  /** A thumb tap. Tapping the chosen thumb again clears it (null). Leave it out for Copy only. */
  onRate?: (rating: ChatRating) => void
  className?: string
}

const thumb = cn(
  'inline-flex size-7 items-center justify-center rounded-badge text-ink-faint transition-colors duration-(--motion-state) ease-standard hover:text-ink',
  focusRing,
)

/**
 * The quiet row under an assistant's reply: Copy, thumbs up, thumbs down. The chosen thumb is filled and pressed.
 *
 *     <ChatFeedbackRow text={reply} rating={rating} onRate={rate} />
 */
export function ChatFeedbackRow({ text, rating = null, onRate, className }: ChatFeedbackRowProps) {
  return (
    <div className={cn('-ml-1 flex items-center gap-0.5', className)}>
      <span className="inline-flex size-7 items-center justify-center">
        <CopyButton value={text} copyLabel="Copy reply" className="text-ink-faint [&_svg]:size-3.5" />
      </span>
      {onRate && (
        <>
          <button
            type="button"
            aria-label="Good reply"
            aria-pressed={rating === 'up'}
            onClick={() => onRate(rating === 'up' ? null : 'up')}
            className={cn(thumb, rating === 'up' && 'text-ink')}
          >
            <ThumbsUp aria-hidden="true" className={cn('size-3.5', rating === 'up' && 'fill-current')} />
          </button>
          <button
            type="button"
            aria-label="Bad reply"
            aria-pressed={rating === 'down'}
            onClick={() => onRate(rating === 'down' ? null : 'down')}
            className={cn(thumb, rating === 'down' && 'text-ink')}
          >
            <ThumbsDown aria-hidden="true" className={cn('size-3.5', rating === 'down' && 'fill-current')} />
          </button>
        </>
      )}
    </div>
  )
}
