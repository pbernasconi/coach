import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MaskedValue } from '../src/components/display/MaskedValue'

describe('MaskedValue', () => {
  it('shows the mask with no controls when the value is withheld', () => {
    render(<MaskedValue value={null} mask="••X3TB" />)
    expect(screen.getByText('••X3TB')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('masks all but the last characters by default', () => {
    render(<MaskedValue value="K7Q2-9F4M-X3TB" />)
    expect(screen.getByText('••X3TB')).toBeInTheDocument()
    expect(screen.queryByText('K7Q2-9F4M-X3TB')).not.toBeInTheDocument()
  })

  it('shows the value and a copy button only after the viewer asks', async () => {
    const user = userEvent.setup()
    render(<MaskedValue value="K7Q2-9F4M-X3TB" />)
    expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show value' }))
    expect(screen.getByText('K7Q2-9F4M-X3TB')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hide value' }))
    expect(screen.getByText('••X3TB')).toBeInTheDocument()
  })
})
