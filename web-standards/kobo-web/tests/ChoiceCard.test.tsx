import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileText } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { ChoiceCard } from '../src/components/controls/ChoiceCard'

describe('ChoiceCard', () => {
  it('is a button named by its label and description', async () => {
    const onClick = vi.fn()
    render(<ChoiceCard icon={FileText} label="Blank note" description="Start from nothing" onClick={onClick} />)
    const card = screen.getByRole('button', { name: /Blank note/ })
    expect(card).toHaveAttribute('type', 'button')
    expect(card).toHaveTextContent('Start from nothing')
    await userEvent.click(card)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire when disabled', async () => {
    const onClick = vi.fn()
    render(<ChoiceCard label="New folder" disabled onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: 'New folder' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
