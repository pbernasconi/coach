'use client'

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { cn } from '../../lib/cn'
import { focusRing } from './Button'

/**
 * A checkbox. Give it a name: put it in a `CheckboxField`, or pair it with a `Label htmlFor`.
 *
 *     <Checkbox id="pin" checked={pinned} onCheckedChange={(next) => setPinned(next === true)} />
 */
export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer size-4 shrink-0 rounded-badge border border-line-strong bg-surface',
        'transition-colors duration-(--motion-state) ease-standard',
        'disabled:cursor-not-allowed disabled:opacity-45',
        'data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-on-brand',
        'data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand data-[state=indeterminate]:text-on-brand',
        'aria-[invalid=true]:border-danger-ink',
        focusRing,
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check aria-hidden="true" className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export interface CheckboxFieldProps extends React.ComponentProps<typeof CheckboxPrimitive.Root> {
  label: React.ReactNode
  description?: React.ReactNode
  labelClassName?: string
}

/**
 * A checkbox and its text in one `<label>`: a click on the text toggles the box, and the box sits
 * centred on the first line of text.
 *
 *     <CheckboxField label="Email me a summary" description="Every Monday" checked={on} onCheckedChange={…} />
 */
export function CheckboxField({ label, description, className, labelClassName, id, disabled, ...props }: CheckboxFieldProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex cursor-pointer items-center gap-2 text-body text-ink select-none',
        disabled && 'cursor-not-allowed opacity-70',
        className,
      )}
    >
      <Checkbox id={inputId} disabled={disabled} {...props} />
      <span className={cn('leading-tight', labelClassName)}>
        {label}
        {description && <span className="block text-footnote text-ink-muted">{description}</span>}
      </span>
    </label>
  )
}
