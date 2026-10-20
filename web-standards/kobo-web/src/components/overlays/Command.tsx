'use client'

import * as React from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { Search } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Dialog, DialogContent, DialogTitle } from './Dialog'

/**
 * A searchable list (cmdk). Use it in a `PopoverContent` for a combobox, or in a `CommandDialog` for a palette.
 * Pass `filter={commandFilter}` from `selectSearch.ts` to rank exact keywords (a country code) first.
 *
 *     <Command>
 *       <CommandInput placeholder="Search notes" />
 *       <CommandList>
 *         <CommandEmpty>No notes found.</CommandEmpty>
 *         <CommandGroup heading="Recent"><CommandItem onSelect={open}>Trip to Lisbon</CommandItem></CommandGroup>
 *       </CommandList>
 *     </Command>
 */
export function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn('flex size-full flex-col overflow-hidden rounded-card bg-surface text-ink', className)}
      {...props}
    />
  )
}

export interface CommandDialogProps extends React.ComponentProps<typeof Dialog> {
  /** The accessible name of the dialog. Keep it fixed copy: never put result text or user data in it. */
  title?: string
  /** `false` when the caller filters its own items (for example, rows a server search already matched). */
  shouldFilter?: boolean
  /** The label of the close button. */
  closeLabel?: string
}

/**
 * A command palette in a dialog: full screen on a phone, a card near the top from `sm` up.
 *
 *     <CommandDialog open={open} onOpenChange={setOpen} title="Search notes">
 *       <CommandInput placeholder="Search" />
 *       <CommandList>…</CommandList>
 *     </CommandDialog>
 */
export function CommandDialog({ children, title = 'Command menu', shouldFilter, closeLabel, ...props }: CommandDialogProps) {
  return (
    <Dialog {...props}>
      <DialogContent
        aria-describedby={undefined}
        closeLabel={closeLabel}
        className="overflow-hidden p-0 sm:top-[10%] sm:translate-y-0"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <Command
          shouldFilter={shouldFilter}
          className={cn(
            'rounded-none [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group]]:px-2',
            '[&_[cmdk-input-wrapper]]:pr-14 [&_[cmdk-input-wrapper]_svg]:size-5 [&_[cmdk-input]]:h-14',
            '[&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:size-5',
          )}
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

/** The search field at the top of a `Command`. */
export function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2 border-b border-line px-3" cmdk-input-wrapper="">
      <Search aria-hidden="true" className="size-4 shrink-0 text-ink-faint" />
      <CommandPrimitive.Input
        className={cn(
          'flex h-10 w-full bg-transparent py-3 text-ink outline-none placeholder:text-ink-faint',
          // kobo: allow R-TYPE 16px on small screens stops iOS Safari from zooming on focus. 14px from md up.
          'text-base md:text-body',
          'disabled:cursor-not-allowed disabled:opacity-45',
          className,
        )}
        {...props}
      />
    </div>
  )
}

/** The scrolling list of results. */
export function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn('max-h-[300px] overflow-x-hidden overflow-y-auto overscroll-contain', className)}
      {...props}
    />
  )
}

/** The text that shows when no item matches the search. */
export function CommandEmpty({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty className={cn('py-6 text-center text-body text-ink-muted', className)} {...props} />
}

/** A group of items with an optional `heading`. */
export function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        'overflow-hidden p-1 text-ink',
        '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-footnote',
        '[&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-muted',
        className,
      )}
      {...props}
    />
  )
}

/** A line between groups. */
export function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return <CommandPrimitive.Separator className={cn('-mx-1 h-px bg-line', className)} {...props} />
}

/** One result. The arrow keys move the highlight; Enter or a click runs `onSelect`. */
export function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        'relative flex cursor-pointer items-center gap-2 rounded-inner px-2 py-1.5 text-body outline-none select-none',
        'data-[selected=true]:bg-surface-raised data-[selected=true]:text-ink',
        'data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-default data-[disabled=true]:opacity-45',
        '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  )
}

/** A keyboard hint at the end of an item ("⌘K"). */
export function CommandShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return <span className={cn('ml-auto text-footnote tracking-widest text-ink-muted', className)} {...props} />
}
