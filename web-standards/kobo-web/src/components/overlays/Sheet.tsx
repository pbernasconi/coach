'use client'

import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'
import { overlayClass } from './Dialog'

export const Sheet = SheetPrimitive.Root
export const SheetTrigger = SheetPrimitive.Trigger
export const SheetClose = SheetPrimitive.Close

/** The panel of a sheet, by the edge it comes from. */
export const sheetVariants = cva(
  'fixed z-modal flex flex-col bg-surface text-ink shadow-float outline-none',
  {
    variants: {
      side: {
        top: cn(
          'inset-x-0 top-0 max-h-[85dvh] rounded-b-sheet border-b border-line',
          'data-[state=open]:animate-slide-in-top data-[state=closed]:animate-slide-out-top',
        ),
        bottom: cn(
          'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-sheet border-t border-line',
          'data-[state=open]:animate-slide-in-bottom data-[state=closed]:animate-slide-out-bottom',
        ),
        left: cn(
          'inset-y-0 left-0 h-full w-3/4 border-r border-line sm:max-w-md',
          'data-[state=open]:animate-slide-in-left data-[state=closed]:animate-slide-out-left',
        ),
        right: cn(
          'inset-y-0 right-0 h-full w-3/4 border-l border-line sm:max-w-md',
          'data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right',
        ),
      },
    },
    defaultVariants: { side: 'right' },
  },
)

export interface SheetContentProps
  extends React.ComponentProps<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** Hide the built-in close button, when the sheet has its own. */
  hideClose?: boolean
  /** The label of the close button. */
  closeLabel?: string
  /**
   * Draw the dimmed layer behind the sheet. Set it to `false` for a side panel that keeps the page usable,
   * and put `modal={false}` on the `Sheet`.
   */
  showOverlay?: boolean
}

/**
 * A panel that slides in from one edge of the screen. Put a `SheetTitle` in every sheet.
 *
 *     <Sheet>
 *       <SheetTrigger asChild><Button>Details</Button></SheetTrigger>
 *       <SheetContent side="right">
 *         <SheetHeader><SheetTitle>Trip to Lisbon</SheetTitle></SheetHeader>
 *         <SheetBody>…</SheetBody>
 *         <SheetFooter><Button>Save</Button></SheetFooter>
 *       </SheetContent>
 *     </Sheet>
 *
 * A non-modal side panel: `<Sheet modal={false}><SheetContent showOverlay={false}>…`.
 */
export function SheetContent({
  side = 'right',
  className,
  children,
  hideClose = false,
  closeLabel = 'Close',
  showOverlay = true,
  ...props
}: SheetContentProps) {
  return (
    <SheetPrimitive.Portal>
      {showOverlay && <SheetPrimitive.Overlay className={overlayClass} />}
      <SheetPrimitive.Content data-side={side} className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        {!hideClose && (
          <SheetPrimitive.Close
            aria-label={closeLabel}
            className={cn(
              'absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-full',
              'bg-surface-raised text-ink-muted hover:bg-surface-sunken hover:text-ink',
              focusRing,
            )}
          >
            <X aria-hidden="true" className="size-4" />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

/** The title and description block. It leaves room for the close button. */
export function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 px-6 pt-6 pr-14 pb-2', className)} {...props} />
}

/** The scrolling content of a sheet. */
export function SheetBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4', className)} {...props} />
}

/** The actions, pinned to the bottom edge. Stacked on a phone with the main action on top; in a row from `sm` up. */
export function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'mt-auto flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}

/** The title of a sheet. Every sheet has one. */
export function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn('text-title2 text-ink', className)} {...props} />
}

/** The supporting text under the title. */
export function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn('text-body text-ink-muted', className)} {...props} />
}
