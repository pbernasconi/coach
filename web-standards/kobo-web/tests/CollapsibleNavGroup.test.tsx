import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Folder } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { CollapsibleNavGroup } from '../src/components/navigation/CollapsibleNavGroup'

describe('CollapsibleNavGroup', () => {
  it('shows the children when defaultOpen', () => {
    render(
      <CollapsibleNavGroup label="Projects" defaultOpen>
        <a href="/garden">Garden</a>
      </CollapsibleNavGroup>,
    )
    expect(screen.getByRole('link', { name: 'Garden' })).toBeVisible()
  })

  it('starts closed and toggles from the row', async () => {
    render(
      <CollapsibleNavGroup label="Projects">
        <a href="/garden">Garden</a>
      </CollapsibleNavGroup>,
    )
    expect(screen.queryByRole('link', { name: 'Garden' })).not.toBeInTheDocument()
    const row = screen.getByRole('button', { name: 'Expand Projects' })
    expect(row).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(row)
    expect(screen.getByRole('link', { name: 'Garden' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collapse Projects' })).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Collapse Projects' }))
    expect(screen.queryByRole('link', { name: 'Garden' })).not.toBeInTheDocument()
  })

  it('with href, the row is a link that opens the group and never closes it', async () => {
    render(
      <CollapsibleNavGroup label="Projects" href="/projects">
        <a href="/garden">Garden</a>
      </CollapsibleNavGroup>,
    )
    const row = screen.getByRole('link', { name: /Projects/ })
    row.addEventListener('click', (event) => event.preventDefault())
    expect(row).toHaveAttribute('href', '/projects')
    expect(screen.queryByRole('link', { name: 'Garden' })).not.toBeInTheDocument()

    await userEvent.click(row)
    expect(screen.getByRole('link', { name: 'Garden' })).toBeInTheDocument()
    await userEvent.click(row)
    expect(screen.getByRole('link', { name: 'Garden' })).toBeInTheDocument()
  })

  it('takes a router link in place of href', () => {
    render(
      <CollapsibleNavGroup label="Projects" link={<a href="/projects" data-router="yes" />}>
        <a href="/garden">Garden</a>
      </CollapsibleNavGroup>,
    )
    expect(screen.getByRole('link', { name: /Projects/ })).toHaveAttribute('data-router', 'yes')
  })

  it('opens when it becomes active and closes when it stops being active', () => {
    const { rerender } = render(
      <CollapsibleNavGroup label="Projects" icon={Folder}>
        <a href="/garden">Garden</a>
      </CollapsibleNavGroup>,
    )
    expect(screen.queryByRole('link', { name: 'Garden' })).not.toBeInTheDocument()
    rerender(
      <CollapsibleNavGroup label="Projects" icon={Folder} isActive>
        <a href="/garden">Garden</a>
      </CollapsibleNavGroup>,
    )
    expect(screen.getByRole('link', { name: 'Garden' })).toBeInTheDocument()
    rerender(
      <CollapsibleNavGroup label="Projects" icon={Folder} isActive={false}>
        <a href="/garden">Garden</a>
      </CollapsibleNavGroup>,
    )
    expect(screen.queryByRole('link', { name: 'Garden' })).not.toBeInTheDocument()
  })

  it('shows a count, and none for 0', () => {
    const { rerender } = render(
      <CollapsibleNavGroup label="Inbox" badgeCount={3}>
        <span />
      </CollapsibleNavGroup>,
    )
    expect(screen.getByText('3')).toBeInTheDocument()
    rerender(
      <CollapsibleNavGroup label="Inbox" badgeCount={0}>
        <span />
      </CollapsibleNavGroup>,
    )
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})
