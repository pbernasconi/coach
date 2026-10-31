import * as React from 'react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'
import { historyGroups, type ChatHistoryItem } from './chatHistory'

export interface ChatHistoryListProps {
  items: ChatHistoryItem[]
  /** The chat open now: its row is highlighted. */
  activeId?: string | null
  onSelect: (id: string) => void
  /** Shown when there are no past chats. */
  empty?: React.ReactNode
  /** Rows can't be picked while an answer streams. */
  disabled?: boolean
  className?: string
}

/**
 * A sidebar list of past chats, grouped by age (Today, Yesterday, Previous 7 days…), one line each. The open chat
 * is highlighted. Put it under a "New chat" button in a chat app's left column.
 *
 *     <ChatHistoryList items={threads} activeId={threadId} onSelect={open} />
 */
export function ChatHistoryList({ items, activeId, onSelect, empty = 'No chats yet.', disabled = false, className }: ChatHistoryListProps) {
  if (!items.length) return <p className={cn('px-2 py-1.5 text-footnote text-ink-faint', className)}>{empty}</p>
  return (
    <nav aria-label="Past chats" className={cn('flex flex-col gap-4', className)}>
      {historyGroups(items).map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h3 className="px-2 pb-1 text-caption font-semibold text-ink-faint">{group.label}</h3>
          <ul className="flex flex-col">
            {group.items.map((item) => {
              const active = item.id === activeId
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-current={active ? 'page' : undefined}
                    title={item.title}
                    onClick={() => onSelect(item.id)}
                    className={cn(
                      'block w-full truncate rounded-inner px-2 py-1.5 text-left text-subhead text-ink-muted',
                      'transition-colors duration-(--motion-state) ease-standard hover:bg-surface-raised hover:text-ink disabled:opacity-60',
                      active && 'bg-surface-raised text-ink',
                      focusRing,
                    )}
                  >
                    {item.title}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </nav>
  )
}
