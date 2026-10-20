import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CopyableValue } from '../src/components/controls/CopyableValue'

describe('CopyableValue', () => {
  it('shows the display text and copies the raw value', async () => {
    const user = userEvent.setup()
    render(<CopyableValue value="+15551234567" display="+1 555 123 4567" mono={false} />)
    expect(screen.getByText('+1 555 123 4567')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(await navigator.clipboard.readText()).toBe('+15551234567')
  })

  it('puts the button before the value when it leads', () => {
    render(<CopyableValue value="INV-20431" iconPosition="leading" />)
    const button = screen.getByRole('button', { name: 'Copy' })
    const value = screen.getByText('INV-20431')
    expect(button.compareDocumentPosition(value) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('puts the button after the value by default', () => {
    render(<CopyableValue value="INV-20431" />)
    const button = screen.getByRole('button', { name: 'Copy' })
    const value = screen.getByText('INV-20431')
    expect(button.compareDocumentPosition(value) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })
})
