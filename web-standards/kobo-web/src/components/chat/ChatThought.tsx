'use client'

import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../display/Collapsible'

export interface ChatThoughtProps {
  /** The summary of the assistant's thinking. */
  children: string
  /** True while it is still thinking: the row says "Thinking" and starts open. */
  thinking?: boolean
  label?: string
  thinkingLabel?: string
  className?: string
}

/**
 * The folded "Thought ›" row above a reply (AI Elements calls it `Reasoning`). A click opens the summary of what the
 * assistant considered, in quiet text. While it is still thinking the row reads "Thinking" and stays open.
 *
 *     <ChatThought>{message.thought}</ChatThought>
 */
export function ChatThought({ children, thinking = false, label = 'Thought', thinkingLabel = 'Thinking', className }: ChatThoughtProps) {
  const [open, setOpen] = React.useState(thinking)
  React.useEffect(() => {
    if (!thinking) setOpen(false)
  }, [thinking])
  if (!children.trim()) return null
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn('w-full', className)}>
      <CollapsibleTrigger
        className={cn(
          'inline-flex items-center gap-1 rounded-badge text-subhead text-ink-muted transition-colors duration-(--motion-state) ease-standard hover:text-ink',
          focusRing,
        )}
      >
        <span className={cn(thinking && 'animate-shimmer')}>{thinking ? thinkingLabel : label}</span>
        <ChevronRight
          aria-hidden="true"
          className={cn('size-3.5 transition-transform duration-(--motion-state) ease-standard', open && 'rotate-90')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 border-l-2 border-line pl-3 text-subhead whitespace-pre-wrap text-ink-muted">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
