'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

/** The dimmed layer under every modal. */
export const overlayClass = cn(
  'fixed inset-0 z-modal bg-scrim',
  'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out',
)

/** The panel of every centred modal: full screen on a phone, a centred card from `sm` up. */
export const modalPanelClass = cn(
  'fixed inset-0 z-modal flex flex-col bg-surface text-ink outline-none',
  'data-[state=open]:animate-rise-in data-[state=closed]:animate-fade-out',
  'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2',
  'sm:max-h-[calc(100dvh-2rem)] sm:rounded-sheet sm:shadow-float',
  'sm:data-[state=open]:animate-pop-in sm:data-[state=closed]:animate-pop-out',
)

/** The panel of a short alert (a confirm): a centred card at every width, because it holds a sentence and two buttons. */
export const alertPanelClass = cn(
  'fixed top-1/2 left-1/2 z-modal flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col',
  'max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-sheet bg-surface text-ink shadow-float outline-none',
  'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
)

export interface DialogContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  /** Hide the built-in close button, when the dialog has its own. */
  hideClose?: boolean
  /** The label of the close button. */
  closeLabel?: string
}

/**
 * A modal dialog. Put a `DialogTitle` in every dialog (use `className="sr-only"` to hide it).
 *
 *     <Dialog open={open} onOpenChange={setOpen}>
 *       <DialogContent>
 *         <DialogHeader><DialogTitle>Rename note</DialogTitle></DialogHeader>
 *         <DialogBody>…</DialogBody>
 *         <DialogFooter><Button>Save</Button></DialogFooter>
 *       </DialogContent>
 *     </Dialog>
 */
export function DialogContent({ className, children, hideClose = false, closeLabel = 'Close', ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClass} />
      <DialogPrimitive.Content className={cn(modalPanelClass, className)} {...props}>
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className={cn(
              'absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-full',
              'bg-surface-raised text-ink-muted hover:bg-surface-sunken hover:text-ink',
              focusRing,
            )}
          >
            <X aria-hidden="true" className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

/** The title and description block. It leaves room for the close button. */
export function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 px-6 pt-6 pr-14', className)} {...props} />
}

/** The scrolling content of a dialog. */
export function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4', className)} {...props} />
}

/** The actions. Stacked on a phone with the main action on top; in a row from `sm` up. */
export function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('mt-auto flex flex-col-reverse gap-2 px-6 pb-6 sm:mt-0 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

/** The title of a dialog. Every dialog has one. */
export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-title2 text-ink', className)} {...props} />
}

/** The supporting text under the title. */
export function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-body text-ink-muted', className)} {...props} />
}
