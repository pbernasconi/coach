'use client'

import * as React from 'react'
import { cn } from '../../lib/cn'
import { Field, FieldError } from './Field'
import { Label } from './Label'

export interface LabeledFieldProps {
  label: React.ReactNode
  /** One control. It gets the id the label points at. */
  children: React.ReactElement<{ id?: string }>
  /** An error under the control. */
  error?: string
  className?: string
}

/**
 * A label, one control and an error, without a form library. It makes the id, so the label points at the control.
 *
 *     <LabeledField label="Title" error={titleError}><Input value={title} onChange={…} /></LabeledField>
 */
export function LabeledField({ label, children, error, className }: LabeledFieldProps) {
  const autoId = React.useId()
  return (
    <Field invalid={Boolean(error)} className={cn(className)}>
      <Label htmlFor={autoId}>{label}</Label>
      {React.isValidElement(children) ? React.cloneElement(children, { id: autoId }) : children}
      <FieldError>{error}</FieldError>
    </Field>
  )
}
