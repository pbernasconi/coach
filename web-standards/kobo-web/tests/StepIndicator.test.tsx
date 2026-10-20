import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StepIndicator } from '../src/components/display/StepIndicator'

describe('StepIndicator', () => {
  it('is a progress bar with the step values', () => {
    render(<StepIndicator currentStep={2} totalSteps={4} label="Pick a date" />)
    const bar = screen.getByRole('progressbar', { name: 'Pick a date' })
    expect(bar).toHaveAttribute('aria-valuenow', '2')
    expect(bar).toHaveAttribute('aria-valuemin', '1')
    expect(bar).toHaveAttribute('aria-valuemax', '4')
    expect(bar).toHaveAttribute('aria-valuetext', 'Step 2 of 4')
  })

  it('shows the step line only with a label', () => {
    const { rerender } = render(<StepIndicator currentStep={2} totalSteps={4} label="Pick a date" />)
    expect(screen.getByText('Step 2 of 4 — Pick a date')).toBeInTheDocument()
    rerender(<StepIndicator currentStep={2} totalSteps={4} />)
    expect(screen.queryByText(/Step 2 of 4 —/)).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Step 2 of 4' })).toBeInTheDocument()
  })

  it('takes custom step words', () => {
    render(<StepIndicator currentStep={1} totalSteps={3} stepText={(c, t) => `${c}/${t}`} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '1/3')
  })
})
