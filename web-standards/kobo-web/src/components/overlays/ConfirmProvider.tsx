'use client'

import * as React from 'react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { cn } from '../../lib/cn'
import { Button } from '../controls/Button'
import { Field, FieldDescription, FieldLabel } from '../fields/Field'
import { Input } from '../fields/Input'
import { Textarea } from '../fields/Textarea'
import { confirmBlocker, type ConfirmReason, type ConfirmTypedWord } from './confirmRules'
import { alertPanelClass, overlayClass } from './Dialog'

interface BaseOptions {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** A destructive action gets the danger button. */
  destructive?: boolean
  typedWord?: ConfirmTypedWord
}

export type ConfirmOptions = BaseOptions & { reason?: never }
export type ConfirmWithReasonOptions = BaseOptions & { reason: ConfirmReason }
export interface ConfirmWithReasonResult {
  confirmed: boolean
  reason?: string
}

export interface ConfirmFn {
  (options: ConfirmWithReasonOptions): Promise<ConfirmWithReasonResult>
  (options: ConfirmOptions): Promise<boolean>
}

interface OpenState {
  options: BaseOptions & { reason?: ConfirmReason }
  resolve: (value: boolean | ConfirmWithReasonResult) => void
}

const ConfirmContext = React.createContext<ConfirmFn | null>(null)

/**
 * Mount once near the root. Then `const confirm = useConfirm()` and `if (await confirm({ title })) …`.
 * It replaces `window.confirm`, which the conformance check bans.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState<OpenState | null>(null)
  const [reason, setReason] = React.useState('')
  const [typedWord, setTypedWord] = React.useState('')

  const confirm = React.useCallback(
    (options: BaseOptions & { reason?: ConfirmReason }) =>
      new Promise<boolean | ConfirmWithReasonResult>((resolve) => {
        setReason('')
        setTypedWord('')
        setOpen({ options, resolve })
      }),
    [],
  ) as ConfirmFn

  const settle = (confirmed: boolean) => {
    if (!open) return
    const text = reason.trim()
    open.resolve(open.options.reason ? { confirmed, ...(confirmed && text ? { reason: text } : {}) } : confirmed)
    setOpen(null)
  }

  const options = open?.options
  const blocker = options ? confirmBlocker(options, { reason, typedWord }) : null

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root open={open !== null} onOpenChange={(next) => !next && settle(false)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={overlayClass} />
          <AlertDialog.Content className={cn(alertPanelClass, 'gap-4 p-6')}>
            <div className="flex flex-col gap-1">
              <AlertDialog.Title className="text-title2 text-ink">{options?.title}</AlertDialog.Title>
              <AlertDialog.Description className={cn('text-body text-ink-muted', !options?.description && 'sr-only')}>
                {options?.description ?? options?.title}
              </AlertDialog.Description>
            </div>
            {options?.reason && (
              <Field>
                <FieldLabel htmlFor="kobo-confirm-reason" required={options.reason.required}>
                  {options.reason.label}
                </FieldLabel>
                {options.reason.description && <FieldDescription>{options.reason.description}</FieldDescription>}
                <Textarea
                  id="kobo-confirm-reason"
                  value={reason}
                  placeholder={options.reason.placeholder}
                  maxLength={options.reason.maxLength ?? 500}
                  aria-invalid={blocker === 'reason-short' || undefined}
                  onChange={(event) => setReason(event.target.value)}
                />
                {blocker === 'reason-short' && (
                  <FieldDescription>Write at least {options.reason.minLength} characters.</FieldDescription>
                )}
              </Field>
            )}
            {options?.typedWord && (
              <Field>
                <FieldLabel htmlFor="kobo-confirm-word">{options.typedWord.label}</FieldLabel>
                <Input
                  id="kobo-confirm-word"
                  value={typedWord}
                  autoComplete="off"
                  placeholder={options.typedWord.expected}
                  onChange={(event) => setTypedWord(event.target.value)}
                />
              </Field>
            )}
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">{options?.cancelLabel ?? 'Cancel'}</Button>
              </AlertDialog.Cancel>
              <Button
                variant={options?.destructive ? 'destructive' : 'primary'}
                disabled={blocker !== null}
                onClick={() => settle(true)}
              >
                {options?.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  )
}

/** Returns `confirm(options)`, which resolves when the person answers. Needs a `ConfirmProvider` above it. */
export function useConfirm(): ConfirmFn {
  const confirm = React.useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm needs a <ConfirmProvider> above it.')
  return confirm
}
