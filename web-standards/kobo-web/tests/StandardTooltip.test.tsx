import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it } from 'vitest'
import { StandardTooltip } from '../src/components/overlays/StandardTooltip'

describe('StandardTooltip', () => {
  it('shows the label on hover without a native title', async () => {
    const user = userEvent.setup()
    render(
      <StandardTooltip content="Sort by name, A to Z">
        <button type="button">Name</button>
      </StandardTooltip>,
    )
    const trigger = screen.getByRole('button', { name: 'Name' })
    expect(trigger).not.toHaveAttribute('title')
    await user.hover(trigger)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Sort by name, A to Z')
  })

  it('makes a passive description trigger reachable by keyboard', async () => {
    const user = userEvent.setup()
    render(
      <StandardTooltip content="Full title of the note" triggerMode="description">
        <span>Short title</span>
      </StandardTooltip>,
    )
    await user.tab()
    expect(screen.getByText('Short title')).toHaveFocus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Full title of the note')
  })

  it('makes a wrapper component reachable when it is used as a description', async () => {
    const user = userEvent.setup()
    function Badge(props: ComponentProps<'div'>) {
      return <div {...props} />
    }
    render(
      <StandardTooltip content="Ada Park" triggerMode="description">
        <Badge>AP</Badge>
      </StandardTooltip>,
    )
    await user.tab()
    expect(screen.getByText('AP')).toHaveFocus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Ada Park')
  })

  it('does not add a second tab stop around a nested control', async () => {
    const user = userEvent.setup()
    render(
      <StandardTooltip content="Leave this note out">
        <label>
          <input type="checkbox" aria-label="Leave out" />
        </label>
      </StandardTooltip>,
    )
    const checkbox = screen.getByRole('checkbox', { name: 'Leave out' })
    expect(checkbox.closest('label')).not.toHaveAttribute('tabindex')
    await user.tab()
    expect(checkbox).toHaveFocus()
  })
})
