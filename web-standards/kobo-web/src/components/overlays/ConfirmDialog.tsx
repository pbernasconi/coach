'use client'

import * as React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './AlertDialog'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Runs on the confirm button. The dialog stays open: close it when the work is done. */
  onConfirm: () => void
  /** A destructive action gets the danger button. */
  variant?: 'primary' | 'destructive'
  /** Show a spinner on the confirm button and block every way to close the dialog. */
  loading?: boolean
}

/**
 * A controlled confirm for work that takes time. It stays open with a spinner until the caller closes it.
 * For a quick yes or no, `await confirm({ title })` from `useConfirm()` is shorter.
 *
 *     <ConfirmDialog open={open} onOpenChange={setOpen} title="Delete the trip?" description="You cannot undo this."
 *       variant="destructive" confirmLabel="Delete" loading={deleting}
 *       onConfirm={() => remove().then(() => setOpen(false))} />
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  variant = 'primary',
  loading = false,
}: ConfirmDialogProps) {
  return (
    // While the work runs, Escape cannot close the dialog: the caller closes it when the work is done.
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (next || !loading) onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={variant}
            loading={loading}
            // Radix closes an alert on its action. preventDefault keeps it open until the caller closes it.
            onClick={(event) => {
              event.preventDefault()
              if (!loading) onConfirm()
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
