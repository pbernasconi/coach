'use client'

import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Input } from './Input'

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Classes for the wrapper. Put layout classes (flex-1) here. */
  wrapperClassName?: string
  /** Start with the password shown. Use it on "set a password" screens, so a typo is visible before submit. */
  defaultVisible?: boolean
  /** The label of the toggle when the password is hidden. */
  showLabel?: string
  /** The label of the toggle when the password is shown. */
  hideLabel?: string
  ref?: React.Ref<HTMLInputElement>
}

/**
 * A password field with a show and hide toggle.
 *
 *     <PasswordInput id="new-password" autoComplete="new-password" defaultVisible />
 */
export function PasswordInput({
  className,
  wrapperClassName,
  disabled,
  defaultVisible = false,
  showLabel = 'Show password',
  hideLabel = 'Hide password',
  ref,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = React.useState(defaultVisible)
  return (
    <div className={cn('relative w-full', wrapperClassName)}>
      <Input ref={ref} type={visible ? 'text' : 'password'} className={cn('pr-10', className)} disabled={disabled} {...props} />
      <button
        type="button"
        // Out of the tab order: Tab goes from the field to the next field, not to the toggle.
        tabIndex={-1}
        disabled={disabled}
        aria-label={visible ? hideLabel : showLabel}
        onClick={() => setVisible((shown) => !shown)}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-inner p-1.5 text-ink-muted transition-colors duration-(--motion-state) ease-standard hover:text-ink disabled:pointer-events-none disabled:opacity-45"
      >
        {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
      </button>
    </div>
  )
}
