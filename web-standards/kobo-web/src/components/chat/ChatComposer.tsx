'use client'

import * as React from 'react'
import { ArrowUp, Plus, Square } from 'lucide-react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'
import { composerKeyAction } from './composerRules'

export interface ChatComposerProps {
  value: string
  onValueChange: (value: string) => void
  /** Enter or the send arrow. Only called when `canSend` is true. */
  onSubmit: () => void
  /** Whether Send is ready (words or files to send). The arrow turns brand when it is. */
  canSend: boolean
  /** An answer is on its way: the arrow becomes a stop square that calls `onStop`. */
  busy?: boolean
  onStop?: () => void
  /** Files picked with +, pasted or dropped. Leave it out and there is no + button. */
  onAttach?: (files: File[]) => void
  /** The file types + offers (the `accept` of a file input). */
  accept?: string
  /** The picked files, above the field (a `ChatAttachmentStrip`). */
  attachments?: React.ReactNode
  placeholder?: string
  /** One quiet line under the box ("Answers can be wrong. Check before you apply."). */
  hint?: React.ReactNode
  disabled?: boolean
  autoFocus?: boolean
  className?: string
  ref?: React.Ref<HTMLTextAreaElement>
}

/**
 * The message box of a chat, in one rounded row: + on the left, the field, the send arrow on the right. The field
 * grows with its text and the buttons stay at the bottom. Enter sends, Shift-Enter starts a new line. Photos and
 * files can be picked, pasted or dropped onto it. While an answer streams the arrow becomes a stop square. A `hint`
 * sits under the box in small quiet type.
 *
 *     <ChatComposer value={text} onValueChange={setText} canSend={!!text.trim()} onSubmit={send} />
 */
export function ChatComposer({
  value, onValueChange, onSubmit, canSend, busy = false, onStop, onAttach, accept, attachments,
  placeholder = 'Ask anything', hint, disabled = false, autoFocus = false, className, ref,
}: ChatComposerProps) {
  const field = React.useRef<HTMLTextAreaElement | null>(null)
  const picker = React.useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = React.useState(false)

  const setRefs = (el: HTMLTextAreaElement | null) => {
    field.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) (ref as React.RefObject<HTMLTextAreaElement | null>).current = el
  }

  // The field grows with its text up to about ten lines, then scrolls.
  React.useLayoutEffect(() => {
    const el = field.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [value])

  const submit = () => {
    if (canSend && !disabled && !busy) onSubmit()
  }
  const take = (list: FileList | null | undefined) => {
    const files = list ? Array.from(list) : []
    if (files.length && onAttach && !disabled) onAttach(files)
  }

  return (
    <div className={cn('flex w-full flex-col items-center gap-2', className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        onDragOver={(e) => {
          if (!onAttach || !e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (!onAttach) return
          e.preventDefault()
          setDragging(false)
          take(e.dataTransfer.files)
        }}
        className={cn(
          'flex w-full flex-col gap-2 rounded-sheet border border-line bg-surface p-2 shadow-card',
          'transition-[border-color,box-shadow] duration-(--motion-state) ease-standard focus-within:border-line-strong focus-within:shadow-float',
          dragging && 'border-brand',
          disabled && 'opacity-60',
        )}
      >
        {attachments}
        <div className="flex items-end gap-1.5">
          {onAttach && (
            <>
              <button
                type="button"
                aria-label="Add photos and files"
                title="Add photos and files"
                disabled={disabled}
                onClick={() => picker.current?.click()}
                className={cn(
                  'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted',
                  'transition-colors duration-(--motion-state) ease-standard hover:bg-surface-raised hover:text-ink disabled:opacity-45',
                  focusRing,
                )}
              >
                <Plus aria-hidden="true" className="size-4.5" />
              </button>
              <input
                ref={picker}
                type="file"
                multiple
                accept={accept}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  take(e.target.files)
                  e.target.value = ''
                }}
              />
            </>
          )}
          <textarea
            ref={setRefs}
            rows={1}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            aria-label={placeholder}
            onChange={(e) => onValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (composerKeyAction(e.nativeEvent) !== 'send') return
              e.preventDefault()
              submit()
            }}
            onPaste={(e) => {
              if (!onAttach || !e.clipboardData.files.length) return
              e.preventDefault()
              take(e.clipboardData.files)
            }}
            className={cn(
              'max-h-60 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-reading text-ink outline-none placeholder:text-ink-faint',
              !onAttach && 'pl-2',
            )}
          />
          {busy ? (
            <button
              type="button"
              aria-label="Stop"
              title="Stop"
              onClick={onStop}
              disabled={!onStop}
              className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-surface disabled:opacity-45', focusRing)}
            >
              <Square aria-hidden="true" className="size-3 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              aria-label="Send"
              title="Send · Enter"
              disabled={!canSend || disabled}
              className={cn(
                'inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-(--motion-state) ease-standard',
                canSend && !disabled ? 'bg-brand text-on-brand hover:bg-brand/90' : 'bg-surface-raised text-ink-faint',
                focusRing,
              )}
            >
              <ArrowUp aria-hidden="true" className="size-4" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </form>
      {hint && <p className="text-caption text-ink-faint">{hint}</p>}
    </div>
  )
}
