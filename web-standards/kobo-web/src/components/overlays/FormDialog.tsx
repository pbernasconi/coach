'use client'

import * as React from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../controls/Button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './Dialog'

export interface FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** The fields. They scroll while the title and the actions stay in place. */
  children: React.ReactNode
  /** Replace the cancel and submit buttons. */
  footer?: React.ReactNode
  submitLabel?: string
  cancelLabel?: string
  /** Runs on submit (the button or Enter in a field). The page does not reload. */
  onSubmit?: () => void
  /** Show a spinner on the submit button and block both buttons. */
  loading?: boolean
  submitDisabled?: boolean
  /** A destructive action gets the danger button, so its weight shows in more than the label. */
  submitVariant?: 'primary' | 'destructive'
  /** Change the width, for example `sm:max-w-2xl` for a long form. */
  contentClassName?: string
  /** Pass `(event) => event.preventDefault()` to stop the focus from going to the first field on open. */
  onOpenAutoFocus?: (event: Event) => void
  /** While `loading`, block every way to close the dialog, so the person sees the result of the action. */
  preventCloseWhileLoading?: boolean
}

/**
 * A dialog that holds a form: a title, the fields, and cancel and submit buttons.
 *
 *     <FormDialog open={open} onOpenChange={setOpen} title="Rename note" onSubmit={save} loading={saving}>
 *       <Field><FieldLabel htmlFor="name">Name</FieldLabel><Input id="name" /></Field>
 *     </FormDialog>
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  onSubmit,
  loading = false,
  submitDisabled = false,
  submitVariant = 'primary',
  contentClassName,
  onOpenAutoFocus,
  preventCloseWhileLoading = false,
}: FormDialogProps) {
  const locked = preventCloseWhileLoading && loading
  const hasDescription = description !== undefined && description.trim().length > 0

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onSubmit?.()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next || !locked) onOpenChange(next)
      }}
    >
      <DialogContent
        className={cn('sm:max-w-[30rem]', contentClassName)}
        // Without a description, tell Radix there is none, so it does not point at a missing element.
        {...(hasDescription ? {} : { 'aria-describedby': undefined })}
        onOpenAutoFocus={onOpenAutoFocus}
        hideClose={locked}
        onEscapeKeyDown={(event) => {
          if (locked) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (locked) event.preventDefault()
        }}
      >
        {/* A flex column, so a long form scrolls in the body while the title and the actions stay in place. */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{title}</DialogTitle>
            {hasDescription && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <DialogBody>{children}</DialogBody>
          <DialogFooter className="shrink-0">
            {footer ?? (
              <>
                <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
                  {cancelLabel}
                </Button>
                <Button type="submit" variant={submitVariant} loading={loading} disabled={submitDisabled}>
                  {submitLabel}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
