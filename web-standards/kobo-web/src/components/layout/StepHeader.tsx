'use client'

import { useEffect, useRef, type ReactNode } from 'react'

export interface StepHeaderProps {
  /** A short line above the title, for example "Step 2 of 4". */
  eyebrow?: string
  title: string
  description?: ReactNode
  /** Move focus to the heading when the title changes, so a screen reader reads the new step. */
  focusOnChange?: boolean
}

/**
 * The eyebrow and title at the top of each step of a flow. When the step changes, focus moves to the new
 * heading (it has `tabIndex={-1}`), so keyboard and screen reader users start at the top of the new step.
 *
 *     <StepHeader eyebrow="Step 2 of 3" title="Pick the dates" />
 */
export function StepHeader({ eyebrow, title, description, focusOnChange = true }: StepHeaderProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (focusOnChange) headingRef.current?.focus({ preventScroll: true })
  }, [focusOnChange, title])

  return (
    <div className="mb-5">
      {eyebrow && <p className="text-body font-semibold text-ink-muted">{eyebrow}</p>}
      <h1 ref={headingRef} tabIndex={-1} className="text-title text-balance text-ink outline-none">
        {title}
      </h1>
      {description && <p className="mt-2 text-body text-pretty text-ink-muted">{description}</p>}
    </div>
  )
}
