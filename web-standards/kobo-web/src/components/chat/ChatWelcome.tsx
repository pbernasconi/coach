import * as React from 'react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'

/** A starter prompt on an empty chat: what to ask, with an icon. */
export type ChatPrompt = { title: string; icon?: React.ReactNode }

export interface ChatWelcomeProps {
  /** The greeting, one big line ("Good evening, Sam"). */
  title: string
  /** A quiet line under it, if any. */
  greeting?: string
  /** The app's mark, left of the title. */
  mark?: React.ReactNode
  prompts?: ChatPrompt[]
  /** A tap on a starter prompt. */
  onPrompt?: (prompt: ChatPrompt) => void
  /** The composer, between the greeting and the starter prompts. */
  children?: React.ReactNode
  className?: string
}

/**
 * The empty state of a chat, as the big assistants do it: the app's mark and a one-line greeting in the middle, the
 * composer right under it, then up to four starter prompts as small pills. A pill fills the composer (or sends, as
 * the app decides).
 *
 *     <ChatWelcome mark={<Logo />} title="Good evening, Sam" prompts={prompts} onPrompt={(p) => setText(p.title)}>
 *       <ChatComposer … />
 *     </ChatWelcome>
 */
export function ChatWelcome({ title, greeting, mark, prompts = [], onPrompt, children, className }: ChatWelcomeProps) {
  return (
    <div className={cn('flex w-full flex-col items-center gap-6 py-6', className)}>
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="flex items-center gap-3 text-title text-ink">
          {mark && <span aria-hidden="true" className="shrink-0">{mark}</span>}
          {title}
        </h2>
        {greeting && <p className="text-body text-ink-muted">{greeting}</p>}
      </div>
      {children}
      {prompts.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-2">
          {prompts.slice(0, 4).map((p) => (
            <li key={p.title}>
              <button
                type="button"
                onClick={() => onPrompt?.(p)}
                className={cn(
                  'inline-flex h-8 items-center gap-2 rounded-full border border-line bg-surface px-3 text-subhead text-ink-muted',
                  'transition-colors duration-(--motion-state) ease-standard hover:border-line-strong hover:bg-surface-raised hover:text-ink',
                  focusRing,
                )}
              >
                {p.icon && (
                  <span aria-hidden="true" className="text-ink-faint [&_svg]:size-3.5">
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
