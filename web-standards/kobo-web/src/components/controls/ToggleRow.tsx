'use client'

import * as React from 'react'
import { cn } from '../../lib/cn'
import { Label } from '../fields/Label'
import { HelpTooltip } from '../overlays/HelpTooltip'
import { Switch } from './Switch'

export interface ToggleRowProps {
  label: string
  description?: string
  /** A "?" help tooltip next to the label, for a note too long for the description. */
  help?: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  /** Classes for the row, for example `border-b-0` when the row is not in a stack. */
  className?: string
}

/**
 * A settings row: a label and a description on the left, a switch on the right. Rows in a stack
 * draw a line between them.
 *
 *     <ToggleRow label="Daily summary" description="An email at 8 AM" checked={on} onCheckedChange={setOn} />
 */
export function ToggleRow({ label, description, help, checked, onCheckedChange, disabled = false, className }: ToggleRowProps) {
  const id = React.useId()
  const descriptionId = `${id}-description`
  const labelNode = (
    <Label htmlFor={id} className="text-body">
      {label}
    </Label>
  )

  return (
    <div className={cn('flex items-start justify-between border-b border-line py-4 last:border-b-0', className)}>
      <div className="flex flex-col gap-0.5 pr-4">
        {help ? (
          // The "?" sits outside the <label>, so a click on it never flips the switch.
          <span className="inline-flex items-center gap-1.5">
            {labelNode}
            <HelpTooltip>{help}</HelpTooltip>
          </span>
        ) : (
          labelNode
        )}
        {description && (
          <p id={descriptionId} className="text-body text-ink-muted">
            {description}
          </p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={description ? descriptionId : undefined}
      />
    </div>
  )
}
