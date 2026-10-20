'use client'

import * as React from 'react'
import { Toaster as Sonner, toast } from 'sonner'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { buttonVariants, focusRing } from '../controls/Button'
import { Spinner } from '../controls/Spinner'

export { toast }

export type ToasterProps = React.ComponentProps<typeof Sonner>

/** Each tone has its own icon, so the kind of a toast never relies on colour alone. */
const ICONS = {
  success: <CircleCheck aria-hidden="true" className="size-4 text-success-ink" />,
  info: <Info aria-hidden="true" className="size-4 text-info-ink" />,
  warning: <TriangleAlert aria-hidden="true" className="size-4 text-warning-ink" />,
  error: <CircleAlert aria-hidden="true" className="size-4 text-danger-ink" />,
  loading: <Spinner className="text-ink-muted" />,
  close: <X aria-hidden="true" className="size-3" />,
}

const CLASS_NAMES = {
  toast: cn(
    'group flex w-(--width) items-start gap-3 rounded-card border border-line bg-surface p-4',
    'text-body text-ink shadow-toast',
  ),
  content: 'flex min-w-0 flex-1 flex-col gap-0.5',
  title: 'font-semibold',
  description: 'text-ink-muted',
  icon: 'mt-0.5 flex size-4 shrink-0 items-center justify-center',
  success: 'border-success-line',
  info: 'border-info-line',
  warning: 'border-warning-line',
  error: 'border-danger-line',
  actionButton: cn(buttonVariants({ variant: 'primary', size: 'compact' }), 'self-center'),
  cancelButton: cn(buttonVariants({ variant: 'secondary', size: 'compact' }), 'self-center'),
  closeButton: cn(
    'absolute -top-2 -left-2 inline-flex size-6 items-center justify-center rounded-full',
    'border border-line bg-surface text-ink-muted hover:text-ink',
    focusRing,
  ),
}

/**
 * The toast host. Mount it once near the root, then call `toast()` from anywhere. Toasts sit on the `z-toast` layer
 * and use the tone of their kind: `toast.success`, `toast.info`, `toast.warning`, `toast.error`.
 *
 *     <Toaster />
 *     toast.success('Note saved', { description: 'It is on all your devices.' })
 *     toast.error('We could not save the note', { action: { label: 'Retry', onClick: save } })
 */
export function Toaster({ className, toastOptions, icons, theme = 'system', ...props }: ToasterProps) {
  return (
    <Sonner
      theme={theme}
      className={cn('toaster group z-toast!', className)}
      icons={{ ...ICONS, ...icons }}
      toastOptions={{
        unstyled: true,
        ...toastOptions,
        classNames: { ...CLASS_NAMES, ...toastOptions?.classNames },
      }}
      {...props}
    />
  )
}
