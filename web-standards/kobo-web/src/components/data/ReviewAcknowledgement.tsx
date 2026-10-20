'use client'

import { useId, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Checkbox } from '../controls/Checkbox'
import { Label } from '../fields/Label'

export interface ReviewAcknowledgementProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** The statement the person agrees to. It is the name of the checkbox. */
  children: ReactNode
  className?: string
}

/**
 * A bordered checkbox on a review step that the person ticks before the main action.
 *
 *     <ReviewAcknowledgement checked={agreed} onCheckedChange={setAgreed}>I checked the guest list.</ReviewAcknowledgement>
 */
export function ReviewAcknowledgement({ checked, onCheckedChange, children, className }: ReviewAcknowledgementProps) {
  const id = useId()
  return (
    <div className={cn('flex gap-3 rounded-control border border-line bg-surface p-3 text-body', className)}>
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} className="mt-0.5" />
      <Label htmlFor={id} className="text-body leading-5 font-normal">
        {children}
      </Label>
    </div>
  )
}
