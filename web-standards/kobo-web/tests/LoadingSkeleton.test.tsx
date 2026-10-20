import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LoadingSkeleton } from '../src/components/feedback/LoadingSkeleton'

describe('LoadingSkeleton', () => {
  it.each(['page', 'table', 'card', 'profile'] as const)('the %s shape says Loading one time', (variant) => {
    render(<LoadingSkeleton variant={variant} />)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
  })

  it('takes its own spoken label', () => {
    render(<LoadingSkeleton variant="table" label="Loading files" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading files')
  })

  it('draws a different shape for each variant', () => {
    const html = (['page', 'table', 'card', 'profile'] as const).map(
      (variant) => render(<LoadingSkeleton variant={variant} />).container.innerHTML,
    )
    expect(new Set(html).size).toBe(4)
  })
})
