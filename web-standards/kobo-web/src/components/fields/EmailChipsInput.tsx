'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import {
  addEmailChips,
  DEFAULT_EMAIL_CHIP_MESSAGES,
  hasEmailSeparator,
  type EmailChipMessages,
  type EmailChipRejection,
} from './emailChips'

export interface EmailChipsInputProps {
  value: string[]
  onChange: (next: string[]) => void
  /** The most chips the field takes. */
  maxCount: number
  /** The words for each rejection. */
  messages?: EmailChipMessages
  placeholder?: string
  /** An error for the whole field (for example from the server). It shows under the field. */
  error?: string
  disabled?: boolean
  id?: string
  className?: string
  /** The accessible name of each chip's remove button. */
  removeLabel?: (email: string) => string
  'aria-describedby'?: string
  /** The text still in the input (typed, or a refused value kept to fix). Block "Continue" while it is not empty. */
  onDraftChange?: (text: string) => void
  /** The text the input starts with, for example a kept draft when the person comes back to the step. */
  initialDraft?: string
  ref?: React.Ref<HTMLInputElement>
}

/**
 * An input that turns email addresses into chips. Enter, a comma, a semicolon, a paste or leaving the field adds
 * the text. Backspace in an empty input removes the last chip. A refused value stays in the input with its message,
 * so nothing typed is lost.
 *
 *     <EmailChipsInput value={emails} onChange={setEmails} maxCount={5} aria-describedby="share-help" />
 */
export function EmailChipsInput({
  value,
  onChange,
  maxCount,
  messages = DEFAULT_EMAIL_CHIP_MESSAGES,
  placeholder,
  error,
  disabled = false,
  id,
  className,
  removeLabel = (email) => `Remove ${email}`,
  'aria-describedby': describedBy,
  onDraftChange,
  initialDraft = '',
  ref,
}: EmailChipsInputProps) {
  const [draft, setDraftState] = React.useState(initialDraft)
  const setDraft = (text: string) => {
    setDraftState(text)
    onDraftChange?.(text)
  }
  const [rejection, setRejection] = React.useState<EmailChipRejection | null>(null)
  const messageId = React.useId()
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const setRefs = (node: HTMLInputElement | null) => {
    inputRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }
  const shownMessage = rejection ? messages[rejection] : error

  const commit = (raw: string) => {
    if (!raw.trim()) {
      setDraft('')
      setRejection(null)
      return
    }
    const { next, rejected } = addEmailChips(value, raw, maxCount)
    if (next.length !== value.length) onChange(next)
    // Keep every refused value in the input, so nothing typed or pasted is lost.
    setDraft(rejected.map((item) => item.value).join(' '))
    setRejection(rejected[0]?.reason ?? null)
  }

  const remove = (email: string) => {
    onChange(value.filter((chip) => chip !== email))
    setRejection(null)
    // The chip's button is gone: keep keyboard focus in the field.
    inputRef.current?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
      event.preventDefault()
      commit(draft)
      return
    }
    const last = value[value.length - 1]
    if (event.key === 'Backspace' && draft === '' && last !== undefined) remove(last)
  }

  const onPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text')
    if (!hasEmailSeparator(text)) return // One address: the browser pastes it into the draft.
    event.preventDefault()
    commit(`${draft} ${text}`)
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div
        className={cn(
          'flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-control border border-line-strong bg-surface px-2.5 py-1.5',
          'transition-[border-color,box-shadow] duration-(--motion-state) ease-standard',
          'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30',
          shownMessage && 'border-danger-ink focus-within:ring-danger-ink/25',
          disabled && 'cursor-not-allowed opacity-45',
        )}
      >
        {value.map((email) => (
          <span
            key={email}
            className="inline-flex max-w-full items-center gap-1 rounded-inner bg-surface-raised px-2 py-1 text-body text-ink"
          >
            <span className="min-w-0 truncate">{email}</span>
            <button
              type="button"
              onClick={() => remove(email)}
              disabled={disabled}
              aria-label={removeLabel(email)}
              className="shrink-0 rounded-inner text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          ref={setRefs}
          id={id}
          // Not type="email": the browser trims a controlled email value and shows its own validation words.
          type="text"
          inputMode="email"
          autoComplete="off"
          value={draft}
          disabled={disabled}
          placeholder={value.length === 0 ? placeholder : undefined}
          onChange={(event) => {
            setDraft(event.target.value)
            if (rejection) setRejection(null)
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => commit(draft)}
          aria-invalid={shownMessage ? true : undefined}
          aria-describedby={cn(describedBy, shownMessage && messageId) || undefined}
          // kobo: allow R-TYPE 16px on small screens stops iOS Safari from zooming on focus. 14px from md up.
          className="min-w-32 flex-1 bg-transparent py-1 text-base text-ink outline-none placeholder:text-ink-faint md:text-body"
        />
      </div>
      {shownMessage ? (
        <p id={messageId} role="alert" className="text-footnote text-danger-ink">
          {shownMessage}
        </p>
      ) : null}
    </div>
  )
}
