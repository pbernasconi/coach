import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StepHeader } from '../src/components/layout/StepHeader'

describe('StepHeader', () => {
  it('focuses the heading when the step changes', () => {
    const { rerender } = render(<StepHeader title="Dates" />)
    expect(screen.getByRole('heading', { name: 'Dates' })).toHaveFocus()
    rerender(<StepHeader title="Review the trip" />)
    expect(screen.getByRole('heading', { name: 'Review the trip' })).toHaveFocus()
  })

  it('does not move focus when focusOnChange is false', () => {
    render(<StepHeader title="Dates" focusOnChange={false} />)
    expect(screen.getByRole('heading', { name: 'Dates' })).not.toHaveFocus()
  })

  it('shows the eyebrow and description', () => {
    render(<StepHeader eyebrow="Step 2 of 3" title="Dates" description="Pick the first night." />)
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
    expect(screen.getByText('Pick the first night.')).toBeInTheDocument()
  })
})
