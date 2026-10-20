import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FullScreenWizard, type WizardStep } from '../src/components/layout/FullScreenWizard'

const makeSteps = (): WizardStep[] => [
  { id: 'people', label: 'People', content: <div>People form</div> },
  { id: 'role', label: 'Role', content: <div>Role picker</div> },
  { id: 'space', label: 'Space', content: <div>Space picker</div> },
  { id: 'review', label: 'Review', content: <div>Review summary</div> },
]

const noop = () => {}

describe('FullScreenWizard', () => {
  it('lists every step in the step rail', () => {
    render(<FullScreenWizard steps={makeSteps()} currentStep={0} onStepChange={noop} onClose={noop} onComplete={noop} />)
    const rail = screen.getByRole('navigation', { name: 'Steps' })
    expect(rail).toHaveTextContent('People')
    expect(rail).toHaveTextContent('Role')
    expect(rail).toHaveTextContent('Space')
    expect(rail).toHaveTextContent('Review')
  })

  it('shows the phone progress line and the active step content', () => {
    render(<FullScreenWizard steps={makeSteps()} currentStep={1} onStepChange={noop} onClose={noop} onComplete={noop} />)
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument()
    expect(screen.getByText('Role picker')).toBeInTheDocument()
  })

  it('marks the current step and names finished steps as done', () => {
    render(<FullScreenWizard steps={makeSteps()} currentStep={2} onStepChange={noop} onClose={noop} onComplete={noop} />)
    expect(screen.getByRole('button', { name: /^3?\s*Space$/ })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: 'Done: People' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done: Role' })).toBeInTheDocument()
  })

  it('goes back to a finished step from the rail, but not ahead', async () => {
    const onStepChange = vi.fn()
    render(<FullScreenWizard steps={makeSteps()} currentStep={1} onStepChange={onStepChange} onClose={noop} onComplete={noop} />)
    await userEvent.click(screen.getByRole('button', { name: /Review/ }))
    expect(onStepChange).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Done: People' }))
    expect(onStepChange).toHaveBeenCalledWith(0)
  })

  it('hides Back on the first step and shows it after', () => {
    const { rerender } = render(
      <FullScreenWizard steps={makeSteps()} currentStep={0} onStepChange={noop} onClose={noop} onComplete={noop} />,
    )
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    rerender(<FullScreenWizard steps={makeSteps()} currentStep={1} onStepChange={noop} onClose={noop} onComplete={noop} />)
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('moves with Next and Back', async () => {
    const onStepChange = vi.fn()
    render(<FullScreenWizard steps={makeSteps()} currentStep={1} onStepChange={onStepChange} onClose={noop} onComplete={noop} />)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onStepChange).toHaveBeenLastCalledWith(2)
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onStepChange).toHaveBeenLastCalledWith(0)
  })

  it('blocks Next when the step is not valid', () => {
    const steps = makeSteps()
    steps[0] = { id: 'people', label: 'People', content: <div />, isValid: false }
    render(<FullScreenWizard steps={steps} currentStep={0} onStepChange={noop} onClose={noop} onComplete={noop} />)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('shows the submit label on the last step and completes', async () => {
    const onComplete = vi.fn()
    render(
      <FullScreenWizard
        steps={makeSteps()}
        currentStep={3}
        onStepChange={noop}
        onClose={noop}
        onComplete={onComplete}
        labels={{ submit: 'Send invites' }}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Send invites' }))
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('blocks Submit while it submits', () => {
    render(
      <FullScreenWizard steps={makeSteps()} currentStep={3} onStepChange={noop} onClose={noop} onComplete={noop} isSubmitting />,
    )
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
  })

  it('closes from the close button', async () => {
    const onClose = vi.fn()
    render(<FullScreenWizard steps={makeSteps()} currentStep={0} onStepChange={noop} onClose={onClose} onComplete={noop} />)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('has no close button of its own in the dialog presentation', () => {
    render(
      <FullScreenWizard
        steps={makeSteps()}
        currentStep={0}
        onStepChange={noop}
        onClose={noop}
        onComplete={noop}
        presentation="dialog"
      />,
    )
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    expect(screen.getByText('People form')).toBeInTheDocument()
  })
})
