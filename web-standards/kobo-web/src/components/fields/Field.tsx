import * as React from 'react'
import { cn } from '../../lib/cn'
import { Label, type LabelProps } from './Label'

/** One form field: a label, a control, a description and an error, in a column. */
export function Field({ className, invalid, ...props }: React.ComponentProps<'div'> & { invalid?: boolean }) {
  return (
    <div
      role="group"
      data-invalid={invalid || undefined}
      className={cn('group/field flex w-full flex-col gap-1.5', className)}
      {...props}
    />
  )
}

/** A column of fields with the standard gap. */
export function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex w-full flex-col gap-5', className)} {...props} />
}

/** A `fieldset` with a visible legend, for a group of related fields (an address). */
export function FieldSet({ legend, className, children, ...props }: React.ComponentProps<'fieldset'> & { legend: React.ReactNode }) {
  return (
    <fieldset className={cn('flex flex-col gap-4', className)} {...props}>
      <legend className="mb-1 text-headline text-ink">{legend}</legend>
      {children}
    </fieldset>
  )
}

/** The label of a field. */
export function FieldLabel(props: LabelProps) {
  return <Label {...props} />
}

/** Help text under a field. Link it to the control with `aria-describedby`. */
export function FieldDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-footnote text-ink-muted', className)} {...props} />
}

/**
 * The error of a field. It renders nothing when there is no message.
 * It is a live region, so a screen reader reads the message when it appears.
 */
export function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<'p'> & { errors?: ReadonlyArray<{ message?: string } | undefined> }) {
  const messages = [...new Set((errors ?? []).map((error) => error?.message).filter(Boolean))] as string[]
  const content = children ?? (messages.length > 1 ? messages.join(' ') : messages[0])
  if (!content) return null
  return (
    <p role="alert" className={cn('text-footnote text-danger-ink', className)} {...props}>
      {content}
    </p>
  )
}
