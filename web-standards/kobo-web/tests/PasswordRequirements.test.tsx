import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PasswordRequirements } from '../src/components/fields/PasswordRequirements'

const row = (label: string) => screen.getByText(label).closest('li')

describe('PasswordRequirements', () => {
  it('shows the four rules and the strength rule', () => {
    render(<PasswordRequirements value="abc" />)
    for (const label of ['At least 8 characters', 'Upper & lowercase letters', 'At least one number', 'At least one symbol', 'Hard to guess']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('needs the rules and the strength: a predictable password that meets every rule stays invalid', () => {
    const onValidityChange = vi.fn()
    const { rerender } = render(<PasswordRequirements value="" onValidityChange={onValidityChange} />)
    expect(onValidityChange).toHaveBeenLastCalledWith(false)
    rerender(<PasswordRequirements value="Password1!" onValidityChange={onValidityChange} />)
    expect(onValidityChange).toHaveBeenLastCalledWith(false)
    rerender(<PasswordRequirements value="Correct-Horse-Battery-Staple-9!" onValidityChange={onValidityChange} />)
    expect(onValidityChange).toHaveBeenLastCalledWith(true)
    expect(onValidityChange).toHaveBeenCalledTimes(2)
  })

  it('says in words which rules are met', () => {
    render(<PasswordRequirements value="lowercaseonly" />)
    expect(row('At least 8 characters')).toHaveTextContent(/, met$/)
    expect(row('At least one number')).toHaveTextContent(/, not met$/)
  })

  it('shows the strength word once there is text', () => {
    const { rerender } = render(<PasswordRequirements value="" />)
    expect(screen.queryByText('Password strength')).not.toBeInTheDocument()
    rerender(<PasswordRequirements value="Xk9#mQ2$vL7p" />)
    expect(screen.getByText('Strong')).toBeInTheDocument()
  })

  it('shows on focus when `focused` is passed, and always without it', () => {
    const { rerender } = render(<PasswordRequirements value="" focused={false} />)
    expect(screen.queryByText('At least 8 characters')).not.toBeInTheDocument()
    rerender(<PasswordRequirements value="" focused />)
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
    rerender(<PasswordRequirements value="" />)
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
  })

  it('stays visible after blur once there is text', () => {
    const { rerender } = render(<PasswordRequirements value="Password1!" focused />)
    rerender(<PasswordRequirements value="Password1!" focused={false} />)
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
  })

  it('announces progress in a polite status region after a pause', () => {
    vi.useFakeTimers()
    try {
      const { rerender } = render(<PasswordRequirements value="" />)
      const status = screen.getByRole('status')
      expect(status).toHaveAttribute('aria-live', 'polite')
      expect(status).toHaveTextContent('')
      rerender(<PasswordRequirements value="Password1!" />)
      expect(status).toHaveTextContent('')
      act(() => {
        vi.advanceTimersByTime(650)
      })
      expect(status).toHaveTextContent('4 of 5 password requirements met.')
    } finally {
      vi.useRealTimers()
    }
  })

  it('opens the strength help from a labelled button', async () => {
    const user = userEvent.setup()
    render(<PasswordRequirements value="" />)
    await user.click(screen.getByRole('button', { name: 'What makes a password strong' }))
    expect(await screen.findByText('What makes a password strong?')).toBeInTheDocument()
  })
})
