'use client'

import * as React from 'react'
import { CircleHelp } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './Tooltip'

export interface HelpTooltipProps {
  /** The help text. It shows on hover. */
  children: React.ReactNode
  /** The name of the "?" button. */
  label?: string
  /** The side of the trigger that the tooltip opens on. */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Classes for the "?" button. */
  className?: string
  /** The tooltip surface. `dark` (the default) for a sentence; `card` for more; `standard` for a short label. */
  variant?: 'standard' | 'dark' | 'card'
  /** Draw a caret that points at the "?". */
  showArrow?: boolean
  /** The trigger's icon, in place of the "?" (for example an "i" for a note on a figure). Sized by the button. */
  icon?: React.ReactNode
}

/**
 * A small "?" that shows help text on hover, for a field or a word that needs a note. It brings its own
 * provider. Keep it outside a `<label>`, so a click on it never changes the control.
 *
 * The "?" is not a tab stop: the help is extra, so keyboard users do not stop on it between fields.
 * A screen reader still finds it by its name.
 *
 *     <HelpTooltip label="What is a tag?">Tags group notes across folders.</HelpTooltip>
 */
export function HelpTooltip({
  children,
  label = 'More info',
  side = 'top',
  className,
  variant = 'dark',
  showArrow = false,
  icon,
}: HelpTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            aria-label={label}
            className={cn(
              'inline-flex shrink-0 text-ink-muted transition-colors duration-(--motion-state) ease-standard',
              'hover:text-ink focus-visible:text-ink focus-visible:outline-none [&_svg]:size-3.5',
              className,
            )}
          >
            {icon ?? <CircleHelp aria-hidden="true" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} variant={variant} showArrow={showArrow} className="max-w-xs text-pretty">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
