import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KeyValueRow } from '../src/components/data/KeyValueRow'

describe('KeyValueRow', () => {
  it('renders the label, the description and the value', () => {
    render(<KeyValueRow label="Time zone" description="Used for reminders" value="Lisbon" />)
    expect(screen.getByText('Time zone')).toBeInTheDocument()
    expect(screen.getByText('Used for reminders')).toBeInTheDocument()
    expect(screen.getByText('Lisbon')).toBeInTheDocument()
  })

  it('leaves out a missing description', () => {
    render(<KeyValueRow label="Name" value="Ben Ito" />)
    expect(screen.queryByText('Used for reminders')).toBeNull()
  })

  it('renders the action slot and node values', () => {
    render(<KeyValueRow label="Status" value={<strong>Active</strong>} action={<button type="button">Change</button>} />)
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument()
    expect(screen.getByText('Active').tagName).toBe('STRONG')
  })

  it('renders a value of 0', () => {
    render(<KeyValueRow label="Open tasks" value={0} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
