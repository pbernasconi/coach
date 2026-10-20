'use client'

import type { MouseEvent } from 'react'

/** The id of the element that holds the page content. Give that element `tabIndex={-1}`. */
export const MAIN_CONTENT_ID = 'main-content'

/**
 * The first focusable element of an app layout. It shows only with keyboard focus, and it moves focus past
 * the navigation to the page content. Without JavaScript it still works as a normal anchor.
 */
export function SkipLink({ targetId = MAIN_CONTENT_ID, label = 'Skip to main content' }: { targetId?: string; label?: string }) {
  const skip = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(targetId)
    if (!target) return
    event.preventDefault()
    target.focus()
  }
  return (
    <a
      href={`#${targetId}`}
      onClick={skip}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-toast focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:text-body focus:font-semibold focus:text-ink focus:shadow-float focus:outline-2 focus:outline-ring"
    >
      {label}
    </a>
  )
}
