'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '../../lib/cn'
import { focusRing } from './Button'

/**
 * An on/off switch. It has `role="switch"`. Give it a name with a `Label htmlFor` or `aria-label`.
 *
 *     <Switch id="sync" checked={sync} onCheckedChange={setSync} />
 */
export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
        'transition-colors duration-(--motion-state) ease-standard',
        'disabled:cursor-not-allowed disabled:opacity-45',
        'data-[state=checked]:bg-brand data-[state=unchecked]:bg-line-strong',
        focusRing,
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block size-5 rounded-full bg-surface shadow-float ring-0',
          'transition-transform duration-(--motion-state) ease-standard',
          'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 [[role=switch]:active_&]:scale-x-110',
        )}
      />
    </SwitchPrimitive.Root>
  )
}
