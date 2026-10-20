'use client'

import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn } from '../../lib/cn'

/**
 * A round picture of a person, with initials while the image loads or when it fails.
 *
 *     <Avatar>
 *       <AvatarImage src={person.photo} alt="" />
 *       <AvatarFallback className={getAvatarColor(person.id)}>{getInitials(person.name)}</AvatarFallback>
 *     </Avatar>
 */
export function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      className={cn('relative flex size-10 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  )
}

/** The picture of an avatar. It shows only after it loads. */
export function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return <AvatarPrimitive.Image className={cn('aspect-square size-full object-cover', className)} {...props} />
}

/** The initials or icon of an avatar while there is no picture. */
export function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        'flex size-full items-center justify-center rounded-full bg-surface-raised text-footnote font-semibold text-ink-muted',
        className,
      )}
      {...props}
    />
  )
}
