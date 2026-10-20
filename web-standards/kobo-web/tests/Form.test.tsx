import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../src/components/fields/Form'
import { Input } from '../src/components/fields/Input'
import { LabeledField } from '../src/components/fields/LabeledField'

function TaskForm({ onSave }: { onSave: (values: { title: string }) => void }) {
  const form = useForm<{ title: string }>({ defaultValues: { title: '' } })
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)}>
        <FormField
          control={form.control}
          name="title"
          rules={{ required: 'Add a title.' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>It shows on the list.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Save</button>
      </form>
    </Form>
  )
}

describe('Form', () => {
  it('links the label and the description to the control', () => {
    render(<TaskForm onSave={vi.fn()} />)
    const field = screen.getByRole('textbox', { name: 'Title' })
    expect(field).toHaveAccessibleDescription('It shows on the list.')
    expect(field).toHaveAttribute('aria-invalid', 'false')
  })

  it('shows and announces the error, and marks the control invalid', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<TaskForm onSave={onSave} />)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Add a title.')
    const field = screen.getByRole('textbox', { name: 'Title' })
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('It shows on the list. Add a title.')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('submits valid values', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<TaskForm onSave={onSave} />)
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Pack bags')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ title: 'Pack bags' }, expect.anything())
  })
})

describe('LabeledField', () => {
  it('links the label to its one control and shows an error', () => {
    render(
      <LabeledField label="Recipe name" error="Add a name.">
        <Input />
      </LabeledField>,
    )
    expect(screen.getByRole('textbox', { name: 'Recipe name' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Add a name.')
  })
})
