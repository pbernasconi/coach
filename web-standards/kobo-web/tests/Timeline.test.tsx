import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Timeline, type TimelineStep } from '../src/components/data/Timeline'

const steps: TimelineStep[] = [
  { label: 'Booked', time: 'Jul 7, 9:00 AM', dateTime: '2026-07-07T09:00', tone: 'success' },
  { label: 'Checked in', tone: 'info', current: true },
  { label: 'Landed', tone: 'neutral' },
]

describe('Timeline', () => {
  it('lists the steps in order under a heading', () => {
    render(<Timeline steps={steps} />)
    expect(screen.getByText('Timeline')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'BookedJul 7, 9:00 AM',
      'Checked in',
      'Landed',
    ])
  })

  it('marks the current step for a screen reader', () => {
    render(<Timeline steps={steps} />)
    const [booked, checkedIn] = screen.getAllByRole('listitem')
    expect(checkedIn).toHaveAttribute('aria-current', 'step')
    expect(booked).not.toHaveAttribute('aria-current')
  })

  it('shows the time in a time element', () => {
    render(<Timeline steps={steps} />)
    const time = within(screen.getAllByRole('listitem')[0] as HTMLElement).getByText('Jul 7, 9:00 AM')
    expect(time.tagName).toBe('TIME')
    expect(time).toHaveAttribute('datetime', '2026-07-07T09:00')
  })

  it('shows a failure as a danger step, not the current step', () => {
    render(
      <Timeline
        steps={[
          { label: 'Sent', tone: 'success' },
          { label: 'Needs attention', tone: 'danger' },
        ]}
      />,
    )
    const failure = screen.getByText('Needs attention').closest('li')
    expect(failure).toHaveAttribute('data-tone', 'danger')
    expect(failure).not.toHaveAttribute('aria-current')
  })

  it('hides the heading and marks the compact variant', () => {
    const { container } = render(<Timeline steps={steps} title={null} variant="compact" />)
    expect(screen.queryByText('Timeline')).toBeNull()
    expect(container.firstElementChild).toHaveAttribute('data-variant', 'compact')
  })
})
