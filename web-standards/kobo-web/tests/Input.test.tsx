import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Field, FieldError, FieldLabel, Input } from '../src'

function Controlled({ onClear }: { onClear: () => void }) {
  const [value, setValue] = useState('draft')
  return <Input aria-label="Search" value={value} onChange={(e) => setValue(e.target.value)} onClear={onClear} />
}

describe('Input', () => {
  it('clears a controlled field, fires onClear and keeps focus', async () => {
    const onClear = vi.fn()
    render(<Controlled onClear={onClear} />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    const field = screen.getByRole('textbox', { name: 'Search' })
    expect(field).toHaveValue('')
    expect(field).toHaveFocus()
    expect(onClear).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
  })

  it('shows the clear button on an uncontrolled field only when it has text', async () => {
    render(<Input aria-label="Name" onClear={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada')
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('')
  })
})

describe('Field', () => {
  it('links a label to its control and announces an error', () => {
    render(
      <Field invalid>
        <FieldLabel htmlFor="title" required>
          Title
        </FieldLabel>
        <Input id="title" aria-invalid />
        <FieldError errors={[{ message: 'Add a title.' }, { message: 'Add a title.' }]} />
      </Field>,
    )
    expect(screen.getByRole('textbox', { name: /Title/ })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/^Add a title\.$/)
  })

  it('renders no error node when there is no message', () => {
    render(<FieldError errors={[undefined]} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
