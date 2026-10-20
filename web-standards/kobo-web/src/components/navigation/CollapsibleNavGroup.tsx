'use client'

import * as React from 'react'
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'
import { Slot } from '@radix-ui/react-slot'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'

export interface CollapsibleNavGroupProps {
  label: string
  /** The group's own page. The row then goes there and opens the group; it never closes it. */
  href?: string
  /** A router link in place of `href` (`<RouterLink to="/notes" />`). The row content goes inside it. */
  link?: React.ReactElement
  icon?: LucideIcon
  /** The child rows (for example `SidebarMenuButton size="compact"`). */
  children: React.ReactNode
  defaultOpen?: boolean
  /** The current page is in this group. The group opens when it turns true and closes when it turns false. */
  isActive?: boolean
  /** A count after the label, in a small pill. Hidden when 0 or missing. */
  badgeCount?: number
  /** The name of the toggle row (no `href`). */
  toggleLabel?: (open: boolean, label: string) => string
  className?: string
}

const defaultToggleLabel = (open: boolean, label: string) => `${open ? 'Collapse' : 'Expand'} ${label}`

/**
 * A nav row that opens a group of child rows. With `href` (or `link`) the row is a link to the group's page that
 * also opens the group. Without one, it is a toggle button. The icon turns into a chevron on hover and when open.
 *
 *     <CollapsibleNavGroup label="Projects" icon={Folder} href="/projects" isActive={inProjects} badgeCount={2}>
 *       <SidebarMenuButton asChild size="compact"><a href="/projects/garden">Garden</a></SidebarMenuButton>
 *     </CollapsibleNavGroup>
 */
export function CollapsibleNavGroup({
  label,
  href,
  link,
  icon: Icon,
  children,
  defaultOpen = false,
  isActive = false,
  badgeCount,
  toggleLabel = defaultToggleLabel,
  className,
}: CollapsibleNavGroupProps) {
  const [open, setOpen] = React.useState(defaultOpen || isActive)
  const [prevActive, setPrevActive] = React.useState(isActive)
  // Follow the active page: open when the person goes into the group, close when they leave it.
  if (prevActive !== isActive) {
    setPrevActive(isActive)
    setOpen(isActive)
  }

  const rowClasses = cn(
    'group/nav flex w-full cursor-pointer items-center gap-2 rounded-control p-2 text-body text-ink',
    'transition-[background-color,color] duration-(--motion-state) ease-standard',
    'hover:bg-surface-raised',
    focusRing,
    isActive && 'bg-brand-soft font-semibold text-brand-ink hover:bg-brand-soft',
  )

  const fade = 'absolute inset-0 size-4 transition-opacity duration-(--motion-state) ease-standard'
  const content = (
    <>
      {Icon && (
        <span aria-hidden="true" className="relative size-4 shrink-0">
          <Icon className={cn(fade, open ? 'opacity-0' : 'opacity-100 group-hover/nav:opacity-0')} />
          <ChevronDown className={cn(fade, open ? 'opacity-100' : 'opacity-0 group-hover/nav:opacity-100')} />
        </span>
      )}
      <span className="flex-1 truncate text-left">{label}</span>
      {badgeCount ? (
        <span className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-caption font-semibold text-on-brand tabular-nums">
          {badgeCount}
        </span>
      ) : null}
    </>
  )

  const linkTarget = link ?? (href ? <a href={href} /> : null)

  return (
    <CollapsiblePrimitive.Root open={open} onOpenChange={setOpen} className={className}>
      {linkTarget ? (
        <Slot className={rowClasses} aria-expanded={open} onClick={() => setOpen(true)}>
          {React.cloneElement(linkTarget, undefined, content)}
        </Slot>
      ) : (
        <CollapsiblePrimitive.Trigger asChild>
          <button type="button" className={rowClasses} aria-label={toggleLabel(open, label)}>
            {content}
          </button>
        </CollapsiblePrimitive.Trigger>
      )}
      <CollapsiblePrimitive.Content>
        <div className="ml-4 flex flex-col gap-0.5 border-l border-line pt-1 pl-3 [&_[data-sidebar=menu-button]]:text-subhead">
          {children}
        </div>
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  )
}
