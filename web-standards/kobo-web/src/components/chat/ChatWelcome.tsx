import * as React from 'react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'

/** A starter prompt on an empty chat: what to ask, with an icon. */
export type ChatPrompt = { title: string; icon?: React.ReactNode }

export interface ChatWelcomeProps {
  /** The first line, quiet ("Hi Sam,"). */
  greeting?: string
  /** The second line, big ("How can I help?"). */
  title: string
  /** A small mark above the words (the app's logo). */
  mark?: React.ReactNode
  prompts?: ChatPrompt[]
  /** A tap on a starter prompt. */
  onPrompt?: (prompt: ChatPrompt) => void
  className?: string
}

/**
 * The empty state of a chat: a small mark, a two-line greeting in the middle, and up to four starter cards. A card
 * fills the composer (or sends, as the app decides).
 *
 *     <ChatWelcome greeting="Hi Sam," title="How can I help?" prompts={prompts} onPrompt={(p) => setText(p.title)} />
 */
export function ChatWelcome({ greeting, title, mark, prompts = [], onPrompt, className }: ChatWelcomeProps) {
  return (
    <div className={cn('flex flex-col items-center gap-6 py-6 text-center', className)}>
      {mark}
      <div>
        {greeting && <p className="text-title2 font-normal text-ink-muted">{greeting}</p>}
        <h2 className="text-title text-ink">{title}</h2>
      </div>
      {prompts.length > 0 && (
        <ul className="grid w-full max-w-xl gap-2 sm:grid-cols-3">
          {prompts.slice(0, 4).map((p) => (
            <li key={p.title}>
              <button
                type="button"
                onClick={() => onPrompt?.(p)}
                className={cn(
                  'flex h-full w-full flex-col items-start gap-3 rounded-card border border-line bg-surface p-3 text-left',
                  'text-subhead text-ink transition-colors duration-(--motion-state) ease-standard hover:bg-surface-raised',
                  focusRing,
                )}
              >
                {p.icon && (
                  <span aria-hidden="true" className="text-brand-ink [&_svg]:size-4">
                    {p.icon}
                  </span>
                )}
                {p.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
