import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SuccessState } from '../src/components/feedback/SuccessState'

describe('SuccessState', () => {
  it('renders the title, the description and the action', () => {
    render(
      <SuccessState
        title="Invite sent"
        description="We sent an invite to rosa@example.com."
        action={<button type="button">Send another</button>}
      />,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Invite sent' })).toBeInTheDocument()
    expect(screen.getByText('We sent an invite to rosa@example.com.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send another' })).toBeInTheDocument()
  })

  it('takes a heading level and hides the decorative check', () => {
    const { container } = render(<SuccessState title="Saved" headingLevel={2} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Saved' })).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
