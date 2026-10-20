import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OtpInput, PinInput } from '../src/components/fields/OtpInput'

describe('OtpInput', () => {
  it('is one real input with one-time-code autofill', () => {
    render(<OtpInput autoFocus={false} />)
    const input = screen.getByRole('textbox', { name: 'Verification code' })
    expect(input).toHaveAttribute('autocomplete', 'one-time-code')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(input).not.toHaveAttribute('maxlength')
  })

  it('fires onComplete once when the full code is typed', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<OtpInput onComplete={onComplete} autoFocus={false} />)
    await user.click(screen.getByRole('textbox'))
    await user.keyboard('123456')
    expect(onComplete).toHaveBeenCalledOnce()
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('shows the typed digits in the boxes', async () => {
    const user = userEvent.setup()
    render(<OtpInput autoFocus={false} />)
    await user.click(screen.getByRole('textbox'))
    await user.keyboard('12')
    const slots = screen.getAllByTestId('otp-slot')
    expect(slots.map((slot) => slot.textContent)).toEqual(['1', '2', '', '', '', ''])
  })

  it('completes from a pasted code with separators', () => {
    const onComplete = vi.fn()
    render(<OtpInput onComplete={onComplete} autoFocus={false} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '123 456' } })
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('does not fire twice for the same code', () => {
    const onComplete = vi.fn()
    render(<OtpInput onComplete={onComplete} autoFocus={false} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '123456' } })
    fireEvent.change(input, { target: { value: '123456' } })
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('fires again when a different full code replaces a wrong one', () => {
    const onComplete = vi.fn()
    render(<OtpInput onComplete={onComplete} autoFocus={false} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '111111' } })
    fireEvent.change(input, { target: { value: '222222' } })
    expect(onComplete).toHaveBeenCalledTimes(2)
    expect(onComplete).toHaveBeenLastCalledWith('222222')
  })

  it('reports every change, also a delete below the full length', () => {
    const onValueChange = vi.fn()
    render(<OtpInput onValueChange={onValueChange} autoFocus={false} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '123456' } })
    fireEvent.change(input, { target: { value: '12345' } })
    expect(onValueChange).toHaveBeenLastCalledWith('12345')
  })

  it('clears and can complete again when resetKey changes', () => {
    const onComplete = vi.fn()
    const { rerender } = render(<OtpInput onComplete={onComplete} resetKey={0} autoFocus={false} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '123456' } })
    rerender(<OtpInput onComplete={onComplete} resetKey={1} autoFocus={false} />)
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(screen.getByRole('textbox')).toHaveFocus()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '123456' } })
    expect(onComplete).toHaveBeenCalledTimes(2)
  })

  it('links the error text and marks the field invalid', () => {
    render(<OtpInput ariaDescribedBy="code-error" error autoFocus={false} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'code-error')
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('focuses itself by default', () => {
    render(<OtpInput />)
    expect(screen.getByRole('textbox')).toHaveFocus()
  })
})

describe('PinInput', () => {
  it('masks every box and does not ask for one-time-code autofill', () => {
    render(<PinInput length={4} autoFocus={false} />)
    const input = screen.getByLabelText('PIN')
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveAttribute('autocomplete', 'off')
    fireEvent.change(input, { target: { value: '1234' } })
    const slots = screen.getAllByTestId('otp-slot').map((slot) => slot.textContent)
    expect(slots).toEqual(['•', '•', '•', '•'])
  })
})
