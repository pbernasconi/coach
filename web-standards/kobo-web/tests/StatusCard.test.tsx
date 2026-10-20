import { render, screen } from '@testing-library/react'
import { MailCheck } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { StatusCard } from '../src/components/feedback/StatusCard'

describe('StatusCard', () => {
  it('renders the title as a heading, the body and the action', () => {
    render(
      <StatusCard icon={MailCheck} title="We sent you a new link" action={<button type="button">Back to sign in</button>}>
        <p>Check your inbox.</p>
      </StatusCard>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'We sent you a new link' })).toBeInTheDocument()
    expect(screen.getByText('Check your inbox.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeInTheDocument()
  })

  it('shows one decorative glyph, also while it loads', () => {
    const { container } = render(<StatusCard tone="neutral" spin title="Checking your link" headingLevel={1} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Checking your link' })).toBeInTheDocument()
    const glyphs = container.querySelectorAll('svg')
    expect(glyphs).toHaveLength(1)
    expect(glyphs[0]).toHaveAttribute('aria-hidden', 'true')
  })
})
