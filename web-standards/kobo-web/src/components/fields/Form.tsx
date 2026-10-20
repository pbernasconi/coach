'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { TriangleAlert } from 'lucide-react'
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form'
import { cn } from '../../lib/cn'
import { Field, FieldDescription, FieldError } from './Field'
import { Label, type LabelProps } from './Label'

/** The react-hook-form provider. Spread the result of `useForm()` on it. */
export const Form = FormProvider

const FormFieldContext = React.createContext<{ name: string } | null>(null)
const FormItemContext = React.createContext<{ id: string } | null>(null)

/**
 * One react-hook-form field. It wraps `Controller` and gives the name to the parts inside.
 *
 *     <Form {...form}>
 *       <form onSubmit={form.handleSubmit(save)}>
 *         <FormField control={form.control} name="title" render={({ field }) => (
 *           <FormItem>
 *             <FormLabel>Title</FormLabel>
 *             <FormControl><Input {...field} /></FormControl>
 *             <FormDescription>Shown on the list.</FormDescription>
 *             <FormMessage />
 *           </FormItem>
 *         )} />
 *       </form>
 *     </Form>
 */
export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

/** The ids and the state of the field around the caller. Use it in a custom form part. */
export function useFormField() {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()
  if (!fieldContext) throw new Error('useFormField must be used inside <FormField>')
  if (!itemContext) throw new Error('useFormField must be used inside <FormItem>')
  const fieldState = getFieldState(fieldContext.name, formState)
  const { id } = itemContext
  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

/** The column of one form field: label, control, description and message. It is a Kobo `Field`. */
export function FormItem({ className, ...props }: React.ComponentProps<typeof Field>) {
  const id = React.useId()
  return (
    <FormItemContext.Provider value={{ id }}>
      <FormItemBody className={className} {...props} />
    </FormItemContext.Provider>
  )
}

function FormItemBody(props: React.ComponentProps<typeof Field>) {
  const { getFieldState, formState } = useFormContext()
  const fieldContext = React.useContext(FormFieldContext)
  const invalid = fieldContext ? Boolean(getFieldState(fieldContext.name, formState).error) : false
  return <Field invalid={invalid} {...props} />
}

/** The label of a form field. It points at the control, and turns to the danger tone on an error. */
export function FormLabel({ className, ...props }: LabelProps) {
  const { error, formItemId } = useFormField()
  return <Label className={cn(error && 'text-danger-ink', className)} htmlFor={formItemId} {...props} />
}

/** Puts the id, `aria-describedby` and `aria-invalid` on the one control inside it. */
export function FormControl(props: React.ComponentProps<typeof Slot>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()
  return (
    <Slot
      id={formItemId}
      aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
      aria-invalid={Boolean(error)}
      {...props}
    />
  )
}

/** Help text under a form field. The control points at it. */
export function FormDescription(props: React.ComponentProps<'p'>) {
  const { formDescriptionId } = useFormField()
  return <FieldDescription id={formDescriptionId} {...props} />
}

/** The error of a form field, with a warning icon. Without an error it shows its children, or nothing. */
export function FormMessage({ className, children, ...props }: React.ComponentProps<'p'>) {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error.message ?? '') : children
  if (!body) return null
  return (
    <FieldError id={formMessageId} className={cn('flex items-center gap-1.5 font-semibold', className)} {...props}>
      <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
      {body}
    </FieldError>
  )
}
