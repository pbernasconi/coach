import * as React from 'react'
import { cn } from '../../lib/cn'
import { fieldBox } from './Input'

/** A multi-line text field. Put it in a `Field` with a `Label`. */
export function Textarea({ className, rows = 3, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea rows={rows} className={cn(fieldBox, 'h-auto min-h-20 py-2', className)} {...props} />
}
