import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StepNav } from '../src/components/navigation/StepNav'

const steps = [{ label: 'Details' }, { label: 'People' }, { label: 'Dates' }, { label: 'Review' }]

describe('StepNav', () => {
  it('renders every step label and number', () => {
    render(<StepNav steps={steps} currentStep={0} />)
    for (const step of steps) expect(screen.getByRole('button', { name: step.label })).toBeInTheDocument()
    for (const n of ['1', '2', '3', '4']) expect(screen.getByText(n)).toBeInTheDocument()
  })

  it('marks only the current step', () => {
    render(<StepNav steps={steps} currentStep={1} />)
    expect(screen.getByRole('button', { name: 'People' })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: 'Details' })).not.toHaveAttribute('aria-current')
  })

  it('calls onStepClick with the index', async () => {
    const onStepClick = vi.fn()
    render(<StepNav steps={steps} currentStep={2} onStepClick={onStepClick} />)
    await userEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(onStepClick).toHaveBeenCalledWith(0)
  })

  it('disables the steps without onStepClick', () => {
    render(<StepNav steps={steps} currentStep={1} />)
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
  })

  it('names the landmark', () => {
    render(<StepNav steps={steps} currentStep={0} aria-label="Progress" />)
    expect(screen.getByRole('navigation', { name: 'Progress' })).toBeInTheDocument()
  })

  it('horizontal: keeps the label for screen readers and marks the current step', async () => {
    const onStepClick = vi.fn()
    render(<StepNav steps={steps} currentStep={2} orientation="horizontal" showCheckmarks onStepClick={onStepClick} />)
    expect(screen.getByRole('button', { name: 'Dates' })).toHaveAttribute('aria-current', 'step')
    // Finished steps show a check, not the number.
    expect(screen.queryByText('1')).not.toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(onStepClick).toHaveBeenCalledWith(0)
  })
})
