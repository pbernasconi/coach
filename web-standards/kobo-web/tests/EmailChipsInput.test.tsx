import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EmailChipsInput } from '../src/components/fields/EmailChipsInput'
import type { EmailChipMessages } from '../src/components/fields/emailChips'

const MESSAGES: EmailChipMessages = { INVALID: 'bad shape', DUPLICATE: 'already there', TOO_MANY: 'too many' }

function Harness({ initial = [], maxCount = 5, onChange }: { initial?: string[]; maxCount?: number; onChange?: (next: string[]) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <EmailChipsInput
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
      maxCount={maxCount}
      messages={MESSAGES}
      placeholder="Add an email"
    />
  )
}

const input = () => screen.getByRole('textbox')

describe('EmailChipsInput', () => {
  it('adds a chip on Enter and on a comma', () => {
    render(<Harness />)
    fireEvent.change(input(), { target: { value: 'a@x.io' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    fireEvent.change(input(), { target: { value: 'b@x.io' } })
    fireEvent.keyDown(input(), { key: ',' })
    expect(screen.getByText('a@x.io')).toBeInTheDocument()
    expect(screen.getByText('b@x.io')).toBeInTheDocument()
    expect(input()).toHaveValue('')
  })

  it('keeps an invalid value in the input with the message', () => {
    render(<Harness />)
    fireEvent.change(input(), { target: { value: 'not-an-email' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(input()).toHaveValue('not-an-email')
    expect(input()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('bad shape')
    expect(input()).toHaveAccessibleDescription('bad shape')
  })

  it('clears the message when the person types again', () => {
    render(<Harness />)
    fireEvent.change(input(), { target: { value: 'bad' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    fireEvent.change(input(), { target: { value: 'bad@x.io' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('adds a pasted list in one step', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.paste(input(), { clipboardData: { getData: () => 'a@x.io, b@x.io\nc@x.io' } })
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith(['a@x.io', 'b@x.io', 'c@x.io'])
  })

  it('says the list is full and keeps the extra text', () => {
    render(<Harness initial={['a@x.io', 'b@x.io']} maxCount={2} />)
    fireEvent.change(input(), { target: { value: 'c@x.io' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(screen.getByRole('alert')).toHaveTextContent('too many')
    expect(input()).toHaveValue('c@x.io')
  })

  it('keeps every refused pasted value in the input', () => {
    render(<Harness />)
    fireEvent.paste(input(), { clipboardData: { getData: () => 'bad1 a@x.io bad2' } })
    expect(screen.getByText('a@x.io')).toBeInTheDocument()
    expect(input()).toHaveValue('bad1 bad2')
    expect(screen.getByRole('alert')).toHaveTextContent('bad shape')
  })

  it('is a text input with the email keyboard', () => {
    render(<Harness />)
    expect(input()).toHaveAttribute('type', 'text')
    expect(input()).toHaveAttribute('inputmode', 'email')
  })

  it('keeps focus in the field after a chip is removed', () => {
    render(<Harness initial={['a@x.io']} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove a@x.io' }))
    expect(input()).toHaveFocus()
  })

  it('removes a chip with its button and the last chip with Backspace', () => {
    render(<Harness initial={['a@x.io', 'b@x.io', 'c@x.io']} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove a@x.io' }))
    expect(screen.queryByText('a@x.io')).not.toBeInTheDocument()
    fireEvent.keyDown(input(), { key: 'Backspace' })
    expect(screen.queryByText('c@x.io')).not.toBeInTheDocument()
    expect(screen.getByText('b@x.io')).toBeInTheDocument()
  })

  it('adds the draft when the field loses focus', () => {
    render(<Harness />)
    fireEvent.change(input(), { target: { value: 'a@x.io' } })
    fireEvent.blur(input())
    expect(screen.getByText('a@x.io')).toBeInTheDocument()
  })

  it('keeps a typed address when the person then removes another chip', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial={['a@x.test']} onChange={onChange} />)
    await user.type(input(), 'b@x.test')
    await user.click(screen.getByRole('button', { name: 'Remove a@x.test' }))
    expect(onChange.mock.calls).toEqual([[['a@x.test', 'b@x.test']], [['b@x.test']]])
    expect(screen.getByText('b@x.test')).toBeInTheDocument()
  })

  it('shows an error from the error prop', () => {
    render(<EmailChipsInput value={['ana@example.com']} onChange={() => {}} maxCount={5} error="This domain is blocked." />)
    expect(screen.getByRole('alert')).toHaveTextContent('This domain is blocked.')
  })

  it('reports the draft and starts from a kept draft', () => {
    const onDraftChange = vi.fn()
    render(<EmailChipsInput value={[]} onChange={() => {}} maxCount={5} initialDraft="ana@" onDraftChange={onDraftChange} />)
    expect(input()).toHaveValue('ana@')
    fireEvent.change(input(), { target: { value: 'ana@x' } })
    expect(onDraftChange).toHaveBeenLastCalledWith('ana@x')
  })

  it('has plain default words', () => {
    render(<EmailChipsInput value={['ana@example.com']} onChange={() => {}} maxCount={5} />)
    expect(screen.getByRole('button', { name: 'Remove ana@example.com' })).toBeInTheDocument()
    fireEvent.change(input(), { target: { value: 'nope' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a full email address')
  })
})
