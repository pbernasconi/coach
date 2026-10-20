'use client'

import * as React from 'react'
import { DEFAULT_TOOLTIP_DELAY_MS, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './Tooltip'

export interface StandardTooltipProps {
  /** A short, plain label. It shows on hover and on keyboard focus. */
  content: React.ReactNode
  /** One element. Radix clones it, so the tooltip adds no layout and does not change the hit area. */
  children: React.ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  delayDuration?: number
  className?: string
  /**
   * `control` keeps the keyboard behaviour of the trigger. `description` makes a passive text or
   * picture trigger focusable, so a keyboard user can read its label too.
   */
  triggerMode?: 'control' | 'description'
}

/**
 * The compact label tooltip. Use it in place of a native `title` for short labels and control hints.
 * It brings its own provider, so it works anywhere. Use `TooltipContent variant="card"` for long help.
 *
 *     <StandardTooltip content="Sort by name">
 *       <button type="button">Name</button>
 *     </StandardTooltip>
 *     <StandardTooltip content="Ada Park" triggerMode="description">
 *       <Avatar>…</Avatar>
 *     </StandardTooltip>
 */
export function StandardTooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  sideOffset = 4,
  delayDuration = DEFAULT_TOOLTIP_DELAY_MS,
  className,
  triggerMode = 'control',
}: StandardTooltipProps) {
  const childProps = children.props as { tabIndex?: number }
  // The call site says if the trigger needs a tab stop. A guess from the tag name cannot see through
  // wrapper components, and it can add a second tab stop around a nested control.
  const trigger =
    triggerMode === 'description' && childProps.tabIndex === undefined
      ? React.cloneElement(children as React.ReactElement<{ tabIndex?: number }>, { tabIndex: 0 })
      : children

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip disableHoverableContent>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent variant="standard" side={side} align={align} sideOffset={sideOffset} className={className}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
