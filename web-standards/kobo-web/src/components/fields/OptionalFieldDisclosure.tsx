'use client'

import * as React from 'react'
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'
import { Minus, Plus } from 'lucide-react'
import { Button } from '../controls/Button'

export interface OptionalFieldDisclosureProps {
  /** The field name ("Note"). The button says "Add note" and "Hide note". */
  label: string
  children: React.ReactNode
  open?: boolean
  /** Start open, for example when the field already has a value. */
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** The button words when closed. Default "Add <label>". */
  addLabel?: string
  /** The button words when open. Default "Hide <label>". */
  hideLabel?: string
  className?: string
}

/**
 * A "+ Add note" button that shows an optional field. It keeps a form short until the person wants the field.
 *
 *     <OptionalFieldDisclosure label="Note"><Textarea aria-label="Note" /></OptionalFieldDisclosure>
 */
export function OptionalFieldDisclosure({
  label,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  addLabel,
  hideLabel,
  className,
}: OptionalFieldDisclosureProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const expanded = open ?? internalOpen
  const setExpanded = (next: boolean) => {
    if (open === undefined) setInternalOpen(next)
    onOpenChange?.(next)
  }
  const name = label.toLowerCase()

  return (
    <CollapsiblePrimitive.Root open={expanded} onOpenChange={setExpanded} className={className}>
      <CollapsiblePrimitive.Trigger asChild>
        <Button variant="plain" size="compact" className="-ml-3 gap-1.5 select-none">
          {expanded ? <Minus aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {expanded ? (hideLabel ?? `Hide ${name}`) : (addLabel ?? `Add ${name}`)}
        </Button>
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Content className="pt-2">{children}</CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  )
}
