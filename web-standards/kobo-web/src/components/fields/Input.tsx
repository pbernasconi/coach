'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

/** The box of every text field. */
export const fieldBox = cn(
  'flex h-10 w-full min-w-0 rounded-control border border-line-strong bg-surface px-3 text-ink',
  // kobo: allow R-TYPE 16px on small screens stops iOS Safari from zooming on focus. 14px from md up.
  'text-base md:text-body',
  'placeholder:text-ink-faint',
  'transition-[border-color,box-shadow] duration-(--motion-state) ease-standard',
  'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
  'disabled:cursor-not-allowed disabled:opacity-45',
  'aria-[invalid=true]:border-danger-ink aria-[invalid=true]:focus-visible:ring-danger-ink/25',
)

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Show a clear (×) button when the field has text. Clearing fires `onChange` with an empty value, then `onClear`. */
  onClear?: () => void
  /** The label of the clear button. */
  clearLabel?: string
  /** Classes for the wrapper of a clearable field. Put layout classes (flex-1) here. */
  wrapperClassName?: string
  ref?: React.Ref<HTMLInputElement>
}

/**
 * A single-line text field. Put it in a `Field` with a `Label`.
 *
 *     <Input value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery('')} />
 */
export function Input({ className, onClear, onChange, clearLabel = 'Clear', wrapperClassName, ref, ...props }: InputProps) {
  const inner = React.useRef<HTMLInputElement | null>(null)
  const controlled = props.value !== undefined
  const [filled, setFilled] = React.useState(() => String(props.value ?? props.defaultValue ?? '').length > 0)
  const hasText = controlled ? String(props.value ?? '').length > 0 : filled

  const setRefs = (node: HTMLInputElement | null) => {
    inner.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }

  const input = (
    <input
      ref={setRefs}
      className={cn(fieldBox, onClear && 'pr-9', className)}
      onChange={(event) => {
        if (!controlled) setFilled(event.target.value.length > 0)
        onChange?.(event)
      }}
      {...props}
    />
  )
  if (!onClear) return input

  const clear = () => {
    const node = inner.current
    if (node) {
      // The native setter plus an input event makes React fire onChange, for controlled and uncontrolled fields.
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(node, '')
      node.dispatchEvent(new Event('input', { bubbles: true }))
      node.focus()
    }
    if (!controlled) setFilled(false)
    onClear()
  }

  return (
    <div className={cn('relative w-full', wrapperClassName)}>
      {input}
      {hasText && !props.disabled && !props.readOnly && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={clearLabel}
          // Keep focus in the field, so an onBlur save does not run before the clear.
          onMouseDown={(event) => event.preventDefault()}
          onClick={clear}
          className="absolute top-1/2 right-1.5 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-surface-raised hover:text-ink"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </div>
  )
}
