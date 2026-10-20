import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TextLink } from '../src/components/controls/TextLink'

describe('TextLink', () => {
  it('is a plain link', () => {
    render(<TextLink href="/help">Read the guide</TextLink>)
    expect(screen.getByRole('link', { name: 'Read the guide' })).toHaveAttribute('href', '/help')
  })

  it('renders its child with asChild', () => {
    render(
      <TextLink asChild variant="muted">
        <a href="/terms" data-router="yes">
          Terms
        </a>
      </TextLink>,
    )
    const link = screen.getByRole('link', { name: 'Terms' })
    expect(link).toHaveAttribute('href', '/terms')
    expect(link).toHaveAttribute('data-router', 'yes')
  })
})
