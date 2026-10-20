import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PasswordInput } from '../src/components/fields/PasswordInput'

describe('PasswordInput', () => {
  it('hides the password, and the toggle shows and hides it', async () => {
    const user = userEvent.setup()
    render(<PasswordInput aria-label="Password" />)
    const field = screen.getByLabelText('Password')
    expect(field).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(field).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(field).toHaveAttribute('type', 'password')
  })

  it('can start shown, and the toggle is out of the tab order', () => {
    render(<PasswordInput aria-label="Password" defaultVisible />)
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('tabindex', '-1')
  })

  it('disables the toggle with the field', () => {
    render(<PasswordInput aria-label="Password" disabled />)
    expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled()
  })
})
