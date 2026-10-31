import * as React from 'react'
import { AlertCircle, FileText, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'
import { Spinner } from '../controls/Spinner'

/** A photo or file on a message, or picked for the next one. */
export type ChatAttachmentItem = {
  id: string
  name: string
  kind: 'image' | 'pdf' | 'text'
  /** A URL to show a photo from (an object URL while it uploads, the server's after). */
  previewUrl?: string | null
  /** Where an upload is. A sent file is `ready`. */
  state?: 'uploading' | 'ready' | 'failed'
  /** Opens the file (a sent message's photo). */
  href?: string | null
}

export interface ChatAttachmentStripProps {
  items: ChatAttachmentItem[]
  /** Leave it out on a sent message: the tiles then have no ×. */
  onRemove?: (id: string) => void
  /** `compact` tiles sit in the composer; `regular` ones show on a sent message. */
  size?: 'compact' | 'regular'
  className?: string
}

/**
 * A row of photo and file tiles: in the composer while they upload (spinner, ×), or on a sent message (a photo
 * opens full size). A failed upload says so and keeps its ×.
 *
 *     <ChatAttachmentStrip items={picked} onRemove={drop} size="compact" />
 */
export function ChatAttachmentStrip({ items, onRemove, size = 'regular', className }: ChatAttachmentStripProps) {
  if (!items.length) return null
  const box = size === 'compact' ? 'size-14' : 'size-24'
  return (
    <ul aria-label="Attachments" className={cn('flex flex-wrap gap-2', className)}>
      {items.map((item) => {
        const failed = item.state === 'failed'
        const tile =
          item.kind === 'image' && item.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a plain img: Kobo is not tied to Next
            <img src={item.previewUrl} alt={item.name} className={cn(box, 'rounded-inner border border-line object-cover')} />
          ) : (
            <span
              className={cn(
                'flex flex-col items-start justify-between rounded-inner border border-line bg-surface-raised p-2',
                size === 'compact' ? 'h-14 w-36' : 'h-16 w-48',
              )}
            >
              <span className="line-clamp-1 text-footnote font-semibold text-ink">{item.name}</span>
              <span className="inline-flex items-center gap-1 text-caption text-ink-muted uppercase">
                <FileText aria-hidden="true" className="size-3" />
                {item.kind}
              </span>
            </span>
          )
        return (
          <li key={item.id} className="relative">
            {item.href && !failed ? (
              <a href={item.href} target="_blank" rel="noreferrer" className={cn('block rounded-inner', focusRing)}>
                {tile}
              </a>
            ) : (
              tile
            )}
            {item.state === 'uploading' && (
              <span className="absolute inset-0 flex items-center justify-center rounded-inner bg-scrim">
                <Spinner className="text-on-danger" />
                <span className="sr-only">Uploading {item.name}</span>
              </span>
            )}
            {failed && (
              <span className="absolute inset-0 flex items-center justify-center gap-1 rounded-inner bg-danger-soft text-caption font-semibold text-danger-ink">
                <AlertCircle aria-hidden="true" className="size-3" />
                Failed
              </span>
            )}
            {onRemove && (
              <button
                type="button"
                aria-label={`Remove ${item.name}`}
                onClick={() => onRemove(item.id)}
                className={cn(
                  'absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full border border-line bg-surface text-ink-muted shadow-card hover:text-ink',
                  focusRing,
                )}
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
