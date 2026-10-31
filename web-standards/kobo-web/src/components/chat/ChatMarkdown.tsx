'use client'

import * as React from 'react'
import { Streamdown, type Components } from 'streamdown'
import { cn } from '../../lib/cn'

/** Kobo type and colour for each Markdown element, so a reply reads like the rest of the app. */
const COMPONENTS: Components = {
  p: ({ node: _node, className, ...props }) => <p className={cn('my-3 first:mt-0 last:mb-0', className)} {...props} />,
  h1: ({ node: _node, className, ...props }) => <h3 className={cn('mt-5 mb-2 text-title2 first:mt-0', className)} {...props} />,
  h2: ({ node: _node, className, ...props }) => <h3 className={cn('mt-5 mb-2 text-headline first:mt-0', className)} {...props} />,
  h3: ({ node: _node, className, ...props }) => <h4 className={cn('mt-4 mb-1 font-semibold first:mt-0', className)} {...props} />,
  ul: ({ node: _node, className, ...props }) => <ul className={cn('my-3 list-disc space-y-1.5 pl-6 marker:text-ink-faint', className)} {...props} />,
  ol: ({ node: _node, className, ...props }) => <ol className={cn('my-3 list-decimal space-y-1.5 pl-6 marker:text-ink-muted', className)} {...props} />,
  li: ({ node: _node, className, ...props }) => <li className={cn('pl-0.5 [&>p]:my-0', className)} {...props} />,
  strong: ({ node: _node, className, ...props }) => <strong className={cn('font-semibold', className)} {...props} />,
  a: ({ node: _node, className, ...props }) => (
    <a className={cn('text-brand-ink underline underline-offset-2', className)} target="_blank" rel="noreferrer" {...props} />
  ),
  inlineCode: ({ node: _node, className, ...props }) => (
    <code className={cn('rounded-badge bg-surface-raised px-1 py-0.5 font-mono text-subhead', className)} {...props} />
  ),
  hr: ({ node: _node, className, ...props }) => <hr className={cn('my-4 border-line', className)} {...props} />,
  blockquote: ({ node: _node, className, ...props }) => (
    <blockquote className={cn('my-2 border-l-2 border-line-strong pl-3 text-ink-muted', className)} {...props} />
  ),
}

export interface ChatMarkdownProps {
  /** The reply, in Markdown. It may be cut mid-word while it streams. */
  children: string
  /** True while words are still arriving: unfinished marks (an open `**`) are closed so they don't flash. */
  streaming?: boolean
  className?: string
}

/**
 * An assistant's reply as formatted text: paragraphs, lists, bold, links, tables and code. It wraps Vercel's
 * `streamdown` (the renderer behind AI Elements' `Response`), which reads Markdown that is still streaming in. Raw
 * HTML in the reply is not rendered.
 *
 *     <ChatMarkdown streaming={isAnswering}>{reply}</ChatMarkdown>
 */
export const ChatMarkdown = React.memo(function ChatMarkdown({ children, streaming = false, className }: ChatMarkdownProps) {
  return (
    <div className={cn('text-reading text-ink break-words', className)}>
      <Streamdown
        mode={streaming ? 'streaming' : 'static'}
        parseIncompleteMarkdown
        isAnimating={streaming}
        controls={false}
        linkSafety={{ enabled: false }}
        skipHtml
        components={COMPONENTS}
      >
        {children}
      </Streamdown>
    </div>
  )
})
