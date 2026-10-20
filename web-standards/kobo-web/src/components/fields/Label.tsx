'use client'

import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '../../lib/cn'
import { HelpTooltip } from '../overlays/HelpTooltip'

export interface LabelProps extends React.ComponentProps<typeof LabelPrimitive.Root> {
  /** Adds a required marker. A screen reader says "required". */
  required?: boolean
  /** Adds "(optional)". Do not use it with `required`. */
  optional?: boolean
  /** A "?" help tooltip next to the label. It sits outside the <label>, so a click on it never changes the control. */
  help?: React.ReactNode
}

/** A field label. `help` adds a "?" tooltip next to it, outside the <label>. */
export function Label({ className, required = false, optional = false, help, children, ...props }: LabelProps) {
  const label = (
    <LabelPrimitive.Root
      className={cn(
        'text-subhead font-semibold text-ink peer-disabled:cursor-not-allowed peer-disabled:opacity-45',
        className,
      )}
      {...props}
    >
      {children}
      {required && (
        <>
          <span className="ml-0.5 text-danger-ink" aria-hidden="true">
            *
          </span>
          <span className="sr-only"> required</span>
        </>
      )}
      {!required && optional && <span className="font-normal text-ink-muted"> (optional)</span>}
    </LabelPrimitive.Root>
  )
  if (!help) return label
  // The wrapper repeats peer-disabled, because the inner <label> is no longer the direct peer sibling.
  return (
    <span className="inline-flex items-center gap-1.5 peer-disabled:cursor-not-allowed peer-disabled:opacity-45">
      {label}
      <HelpTooltip>{help}</HelpTooltip>
    </span>
  )
}
