import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SectionRail } from '../src/components/layout/SectionRail'

const SECTIONS = [
  { key: 'profile', label: 'Profile' },
  { key: 'sharing', label: 'Sharing' },
] as const

describe('SectionRail', () => {
  it('renders a named nav landmark with every section', () => {
    render(
      <SectionRail sections={SECTIONS} activeKey="profile" onSelect={() => {}} ariaLabel="Settings sections">
        <p>pane</p>
      </SectionRail>,
    )
    expect(screen.getByRole('navigation', { name: 'Settings sections' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sharing' })).toBeInTheDocument()
  })

  it('marks only the active section with aria-current', () => {
    render(
      <SectionRail sections={SECTIONS} activeKey="sharing" onSelect={() => {}} ariaLabel="Sections">
        <p>pane</p>
      </SectionRail>,
    )
    expect(screen.getByRole('button', { name: 'Sharing' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Profile' })).not.toHaveAttribute('aria-current')
  })

  it('calls onSelect with the section key', async () => {
    const onSelect = vi.fn()
    render(
      <SectionRail sections={SECTIONS} activeKey="profile" onSelect={onSelect} ariaLabel="Sections">
        <p>pane</p>
      </SectionRail>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Sharing' }))
    expect(onSelect).toHaveBeenCalledWith('sharing')
  })

  it('renders the active pane', () => {
    render(
      <SectionRail sections={SECTIONS} activeKey="profile" onSelect={() => {}} ariaLabel="Sections">
        <p>profile pane</p>
      </SectionRail>,
    )
    expect(screen.getByText('profile pane')).toBeInTheDocument()
  })
})
