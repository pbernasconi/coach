import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '../../lib/cn'
import { Separator } from '../display/Separator'
import { Input } from '../fields/Input'

/** The top of the sidebar: a logo, a switcher or a search field. */
export function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sidebar-header" data-sidebar="header" className={cn('flex flex-col gap-2 p-2', className)} {...props} />
}

/** The bottom of the sidebar: the person's menu or settings. */
export function SidebarFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sidebar-footer" data-sidebar="footer" className={cn('flex flex-col gap-2 p-2', className)} {...props} />
}

/** A line between parts of the sidebar. */
export function SidebarSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator data-slot="sidebar-separator" data-sidebar="separator" className={cn('mx-2 w-auto', className)} {...props} />
  )
}

/** The scrolling middle of the sidebar, between the header and the footer. */
export function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
        className,
      )}
      {...props}
    />
  )
}

/** A compact search field for the sidebar. Give it an `aria-label`. */
export function SidebarInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn('h-8 w-full bg-canvas md:text-subhead', className)}
      {...props}
    />
  )
}

/** One group of rows, with an optional `SidebarGroupLabel` and `SidebarGroupAction`. */
export function SidebarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn('relative flex w-full min-w-0 flex-col p-2', className)}
      {...props}
    />
  )
}

/** The small heading of a group. It hides when the sidebar shrinks to icons. */
export function SidebarGroupLabel({ className, asChild = false, ...props }: React.ComponentProps<'div'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'div'
  return (
    <Comp
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={cn(
        'flex h-8 shrink-0 items-center rounded-control px-2 text-footnote font-semibold text-ink-muted outline-none',
        'transition-[margin,opacity] duration-(--motion-enter) ease-standard focus-visible:ring-2 focus-visible:ring-ring',
        '[&>svg]:size-4 [&>svg]:shrink-0',
        'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0',
        className,
      )}
      {...props}
    />
  )
}

/** An icon button at the top right of a group, for example "Add project". Give it an `aria-label`. */
export function SidebarGroupAction({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      data-slot="sidebar-group-action"
      data-sidebar="group-action"
      {...(asChild ? {} : { type: 'button' as const })}
      className={cn(
        'absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-inner p-0',
        'text-ink-muted outline-none transition-transform hover:bg-surface-raised hover:text-ink',
        'focus-visible:ring-2 focus-visible:ring-ring [&>svg]:size-4 [&>svg]:shrink-0',
        // A bigger hit area on a phone.
        'after:absolute after:-inset-2 md:after:hidden',
        'group-data-[collapsible=icon]:hidden',
        className,
      )}
      {...props}
    />
  )
}

/** The rows of a group. */
export function SidebarGroupContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="sidebar-group-content" data-sidebar="group-content" className={cn('w-full text-body', className)} {...props} />
  )
}
