'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/cn'

/** The hover delay of every tooltip, in milliseconds. */
export const DEFAULT_TOOLTIP_DELAY_MS = 200

export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

/**
 * Shares the hover delay between the tooltips under it. Put one near the root of the app.
 *
 *     <TooltipProvider><App /></TooltipProvider>
 */
export function TooltipProvider({
  delayDuration = DEFAULT_TOOLTIP_DELAY_MS,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
}

export interface TooltipIconTriggerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'type'> {
  /** The name a screen reader says. An icon-only trigger must have one. */
  'aria-label': string
  ref?: React.Ref<HTMLButtonElement>
}

/**
 * The trigger for a passive status icon. Unlike an action button it never paints a hover fill:
 * hover makes the icon stronger, and the focus ring shows keyboard focus.
 *
 *     <Tooltip>
 *       <TooltipTrigger asChild>
 *         <TooltipIconTrigger aria-label="Synced"><CircleCheck aria-hidden="true" /></TooltipIconTrigger>
 *       </TooltipTrigger>
 *       <TooltipContent>Synced a minute ago</TooltipContent>
 *     </Tooltip>
 */
export function TooltipIconTrigger({ className, ref, ...props }: TooltipIconTriggerProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'group inline-flex size-7 shrink-0 cursor-default items-center justify-center rounded-inner bg-transparent',
        'text-ink-muted transition-colors duration-(--motion-state) ease-standard hover:text-ink',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        '[&_svg]:size-4',
        className,
      )}
      {...props}
    />
  )
}

// `standard` is the short label of every control. `dark` and `card` are for longer help text.
// `dark` and `card` put the dark palette on their own element, so they are dark in both themes.
const tooltipVariants = cva('z-popover', {
  variants: {
    variant: {
      standard: [
        'w-max max-w-[min(19rem,var(--radix-tooltip-content-available-width))] whitespace-normal break-words',
        'rounded-badge border border-line bg-surface px-2 py-1 text-footnote text-ink shadow-float',
        // The label stays for --motion-linger after the pointer leaves, then fades out.
        'data-[state=closed]:animate-fade-out data-[state=closed]:[animation-delay:var(--motion-linger)]',
        'data-[state=closed]:[animation-fill-mode:both]',
      ],
      dark: 'dark rounded-inner bg-surface-raised px-3 py-1.5 text-footnote text-ink shadow-float',
      card: 'dark rounded-card bg-surface-raised px-3.5 py-2.5 text-body text-ink shadow-float',
    },
  },
  defaultVariants: { variant: 'dark' },
})

const motionClass =
  'origin-(--radix-tooltip-content-transform-origin) animate-pop-in data-[state=closed]:animate-pop-out'

export interface TooltipContentProps extends React.ComponentProps<typeof TooltipPrimitive.Content> {
  /** `standard` for short control labels; `dark` (the default) and `card` for longer help. */
  variant?: 'standard' | 'dark' | 'card'
  /** Draw a caret that points at the trigger. The `standard` variant never has one. */
  showArrow?: boolean
}

/**
 * The floating label of a tooltip. It renders in a portal.
 *
 *     <Tooltip>
 *       <TooltipTrigger asChild><Button size="icon" aria-label="Share"><Share /></Button></TooltipTrigger>
 *       <TooltipContent variant="standard">Share</TooltipContent>
 *     </Tooltip>
 */
export function TooltipContent({
  className,
  sideOffset = 4,
  variant = 'dark',
  showArrow = false,
  children,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        data-variant={variant}
        className={cn(tooltipVariants({ variant }), variant !== 'standard' && motionClass, className)}
        {...props}
      >
        {children}
        {showArrow && variant !== 'standard' && (
          <TooltipPrimitive.Arrow width={12} height={6} className="fill-surface-raised" />
        )}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}
