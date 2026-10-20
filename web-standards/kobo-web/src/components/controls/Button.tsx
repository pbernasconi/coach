'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'
import { Spinner } from './Spinner'

/** The focus ring of every Kobo control. */
export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export const buttonVariants = cva(
  [
    'relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold',
    'transition-[background-color,color,box-shadow,transform] duration-(--motion-instant) ease-standard',
    'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    focusRing,
  ],
  {
    variants: {
      /** The visual weight. Pick one primary action per screen. */
      variant: {
        primary: 'bg-brand text-on-brand hover:bg-brand/90 active:bg-brand/85',
        secondary: 'bg-surface-raised text-ink hover:bg-surface-sunken',
        tonal: 'bg-brand-soft text-brand-ink hover:bg-brand/20',
        outline: 'border border-line-strong bg-surface text-ink hover:bg-surface-raised',
        destructive: 'bg-danger-fill text-on-danger hover:bg-danger-fill/90 active:bg-danger-fill/85',
        plain: 'text-brand-ink hover:bg-brand-soft',
      },
      size: {
        regular: 'h-10 px-5 text-body',
        compact: 'h-8 px-3 text-subhead',
        icon: 'size-10',
        'icon-compact': 'size-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'regular' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the child element (for example a link) with the button styles. */
  asChild?: boolean
  /** Show a spinner and block clicks. The button keeps its width. */
  loading?: boolean
}

/**
 * The button of every screen.
 *
 *     <Button onClick={save}>Save</Button>
 *     <Button variant="secondary" size="compact" loading={pending}>Retry</Button>
 *     <Button variant="plain" size="icon" aria-label="Close"><X /></Button>
 *     <Button asChild><a href="/new">New note</a></Button>
 */
export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  type = 'button',
  children,
  ref,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const classes = cn(buttonVariants({ variant, size }), className)
  if (asChild) {
    return (
      <Slot className={classes} ref={ref} {...props}>
        {children}
      </Slot>
    )
  }
  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
      {/* display:contents keeps the children as direct flex items. Transparent text hides them under the spinner. */}
      <span className={cn('contents', loading && 'text-transparent')}>{children}</span>
    </button>
  )
}
