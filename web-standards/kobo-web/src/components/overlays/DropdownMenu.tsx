'use client'

import * as React from 'react'
import * as MenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { cn } from '../../lib/cn'

export const DropdownMenu = MenuPrimitive.Root
export const DropdownMenuTrigger = MenuPrimitive.Trigger
export const DropdownMenuGroup = MenuPrimitive.Group
export const DropdownMenuPortal = MenuPrimitive.Portal
export const DropdownMenuSub = MenuPrimitive.Sub
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup

const panelClass = cn(
  'z-popover min-w-32 overflow-x-hidden rounded-control border border-line bg-surface p-1 text-ink shadow-float',
  'max-w-(--radix-dropdown-menu-content-available-width)',
  'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
)

const itemClass = cn(
  'relative flex cursor-pointer items-center gap-2 rounded-inner px-2 py-1.5 text-body outline-none select-none',
  'transition-colors duration-(--motion-instant) ease-standard',
  'data-highlighted:bg-surface-raised data-disabled:pointer-events-none data-disabled:opacity-45',
  '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
)

/**
 * The floating list of a menu. It keeps to the screen and scrolls when it is too tall.
 *
 *     <DropdownMenu>
 *       <DropdownMenuTrigger asChild><Button variant="secondary">Sort</Button></DropdownMenuTrigger>
 *       <DropdownMenuContent align="end">
 *         <DropdownMenuItem onSelect={rename}>Rename</DropdownMenuItem>
 *         <DropdownMenuSeparator />
 *         <DropdownMenuItem onSelect={remove}>Delete</DropdownMenuItem>
 *       </DropdownMenuContent>
 *     </DropdownMenu>
 */
export function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          panelClass,
          'max-h-(--radix-dropdown-menu-content-available-height) overflow-y-auto',
          'origin-(--radix-dropdown-menu-content-transform-origin)',
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  )
}

/** One action in a menu. `inset` lines it up with items that have a check or a dot. */
export function DropdownMenuItem({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item> & { inset?: boolean }) {
  return <MenuPrimitive.Item className={cn(itemClass, inset && 'pl-8', className)} {...props} />
}

/** An item that turns an option on or off. It shows a check when it is on. */
export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.CheckboxItem>) {
  return (
    <MenuPrimitive.CheckboxItem className={cn(itemClass, 'pl-8', className)} {...props}>
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <MenuPrimitive.ItemIndicator>
          <Check aria-hidden="true" />
        </MenuPrimitive.ItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}

/** One choice in a `DropdownMenuRadioGroup`. It shows a dot when it is the chosen one. */
export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem className={cn(itemClass, 'pl-8', className)} {...props}>
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <MenuPrimitive.ItemIndicator>
          <Circle aria-hidden="true" className="size-2! fill-current" />
        </MenuPrimitive.ItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}

/** A heading over a group of items. */
export function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Label> & { inset?: boolean }) {
  return (
    <MenuPrimitive.Label
      className={cn('px-2 py-1.5 text-footnote font-semibold text-ink-muted', inset && 'pl-8', className)}
      {...props}
    />
  )
}

/** A line between groups of items. */
export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-line', className)} {...props} />
}

/** The key that runs an item, shown at its end. It is a hint only: the app binds the key itself. */
export function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return <span className={cn('ml-auto pl-4 text-footnote tracking-widest text-ink-muted', className)} {...props} />
}

/** The item that opens a sub-menu. It shows a chevron. */
export function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubTrigger> & { inset?: boolean }) {
  return (
    <MenuPrimitive.SubTrigger
      className={cn(itemClass, 'data-[state=open]:bg-surface-raised', inset && 'pl-8', className)}
      {...props}
    >
      {children}
      <ChevronRight aria-hidden="true" className="ml-auto text-ink-muted" />
    </MenuPrimitive.SubTrigger>
  )
}

/** The floating list of a sub-menu. */
export function DropdownMenuSubContent({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.SubContent>) {
  return (
    <MenuPrimitive.SubContent
      className={cn(panelClass, 'origin-(--radix-dropdown-menu-content-transform-origin)', className)}
      {...props}
    />
  )
}
