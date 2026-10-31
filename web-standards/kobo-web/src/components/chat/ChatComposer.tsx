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
  disabled?: boolean
  autoFocus?: boolean
  className?: string
  ref?: React.Ref<HTMLTextAreaElement>
}

/**
 * The message box of a chat: a white card with the field on top and its controls under it, a round + on the left
 * and the send arrow on the right. Enter sends, Shift-Enter starts a new line. Photos and files can be picked,
 * pasted or dropped onto it. While an answer streams the arrow becomes a stop square.
 *
 *     <ChatComposer value={text} onValueChange={setText} canSend={!!text.trim()} onSubmit={send} />
 */
export function ChatComposer({
  value, onValueChange, onSubmit, canSend, busy = false, onStop, onAttach, accept, attachments,
  placeholder = 'Ask anything', disabled = false, autoFocus = false, className, ref,
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
        'flex w-full flex-col gap-2 rounded-sheet border border-line bg-surface p-2.5 shadow-float',
        'transition-[border-color,box-shadow] duration-(--motion-state) ease-standard focus-within:border-line-strong',
        dragging && 'border-brand',
        disabled && 'opacity-60',
        className,
      )}
    >
      {attachments}
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
        className="max-h-60 min-h-6 w-full resize-none bg-transparent px-1.5 pt-1 text-body text-ink outline-none placeholder:text-ink-faint"
      />
      <div className="flex items-center gap-2">
        {onAttach && (
          <>
            <button
              type="button"
              aria-label="Add photos and files"
              disabled={disabled}
              onClick={() => picker.current?.click()}
              className={cn(
                'inline-flex size-8 items-center justify-center rounded-full border border-line text-ink-muted',
                'transition-colors duration-(--motion-state) ease-standard hover:bg-surface-raised hover:text-ink disabled:opacity-45',
                focusRing,
              )}
            >
              <Plus aria-hidden="true" className="size-4" />
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
        <span className="flex-1" />
        {busy ? (
          <button
            type="button"
            aria-label="Stop"
            onClick={onStop}
            disabled={!onStop}
            className={cn('inline-flex size-8 items-center justify-center rounded-full bg-ink text-surface disabled:opacity-45', focusRing)}
          >
            <Square aria-hidden="true" className="size-3 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            aria-label="Send"
            disabled={!canSend || disabled}
            className={cn(
              'inline-flex size-8 items-center justify-center rounded-full transition-colors duration-(--motion-state) ease-standard',
              canSend && !disabled ? 'bg-brand text-on-brand hover:bg-brand/90' : 'bg-surface-raised text-ink-faint',
              focusRing,
            )}
          >
            <ArrowUp aria-hidden="true" className="size-4" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </form>
  )
}
