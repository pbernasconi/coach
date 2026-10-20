'use client'

import * as React from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'
import { Button, buttonVariants } from '../controls/Button'
import { alertPanelClass, overlayClass } from './Dialog'

export const AlertDialog = AlertDialogPrimitive.Root
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger

/**
 * A short modal that needs an answer: a sentence and two buttons. It has no close button and a click outside
 * does not close it; Escape and the cancel button do. For a promise-based confirm, use `useConfirm()`.
 *
 *     <AlertDialog>
 *       <AlertDialogTrigger asChild><Button variant="destructive">Delete</Button></AlertDialogTrigger>
 *       <AlertDialogContent>
 *         <AlertDialogHeader>
 *           <AlertDialogTitle>Delete the note?</AlertDialogTitle>
 *           <AlertDialogDescription>You cannot undo this.</AlertDialogDescription>
 *         </AlertDialogHeader>
 *         <AlertDialogFooter>
 *           <AlertDialogCancel>Cancel</AlertDialogCancel>
 *           <AlertDialogAction variant="destructive" onClick={remove}>Delete</AlertDialogAction>
 *         </AlertDialogFooter>
 *       </AlertDialogContent>
 *     </AlertDialog>
 */
export function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className={overlayClass} />
      <AlertDialogPrimitive.Content className={cn(alertPanelClass, 'gap-4 p-6', className)} {...props} />
    </AlertDialogPrimitive.Portal>
  )
}

/** The title and description block. */
export function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1', className)} {...props} />
}

/** The actions. Stacked on a phone with the main action on top; in a row from `sm` up. */
export function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
}

/** The title of an alert. Every alert has one. */
export function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return <AlertDialogPrimitive.Title className={cn('text-title2 text-ink', className)} {...props} />
}

/** The sentence under the title. */
export function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return <AlertDialogPrimitive.Description className={cn('text-body text-ink-muted', className)} {...props} />
}

type ButtonVariant = VariantProps<typeof buttonVariants>['variant']

export interface AlertDialogButtonProps extends React.ComponentProps<typeof AlertDialogPrimitive.Action> {
  variant?: ButtonVariant
  /** Show a spinner and block clicks. */
  loading?: boolean
}

/**
 * The main action. It closes the alert when clicked; call `event.preventDefault()` in `onClick` to keep it open
 * until the work is done.
 */
export function AlertDialogAction({
  variant = 'primary',
  loading,
  asChild,
  className,
  children,
  ...props
}: AlertDialogButtonProps) {
  if (asChild) {
    return (
      <AlertDialogPrimitive.Action asChild className={cn(buttonVariants({ variant }), className)} {...props}>
        {children}
      </AlertDialogPrimitive.Action>
    )
  }
  return (
    <AlertDialogPrimitive.Action asChild {...props}>
      <Button variant={variant} loading={loading} className={className}>
        {children}
      </Button>
    </AlertDialogPrimitive.Action>
  )
}

/** The cancel button. It closes the alert and gets the focus when the alert opens. */
export function AlertDialogCancel({
  variant = 'secondary',
  loading,
  asChild,
  className,
  children,
  ...props
}: AlertDialogButtonProps) {
  if (asChild) {
    return (
      <AlertDialogPrimitive.Cancel asChild className={cn(buttonVariants({ variant }), className)} {...props}>
        {children}
      </AlertDialogPrimitive.Cancel>
    )
  }
  return (
    <AlertDialogPrimitive.Cancel asChild {...props}>
      <Button variant={variant} loading={loading} className={className}>
        {children}
      </Button>
    </AlertDialogPrimitive.Cancel>
  )
}
