import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../src/components/display/Collapsible'

describe('Collapsible', () => {
  it('opens and closes its content from the trigger', async () => {
    const user = userEvent.setup()
    render(
      <Collapsible>
        <CollapsibleTrigger>Show details</CollapsibleTrigger>
        <CollapsibleContent>Made on 12 May</CollapsibleContent>
      </Collapsible>,
    )
    const trigger = screen.getByRole('button', { name: 'Show details' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Made on 12 May')).not.toBeInTheDocument()
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Made on 12 May')).toBeVisible()
    await user.click(trigger)
    expect(screen.queryByText('Made on 12 May')).not.toBeInTheDocument()
  })
})
