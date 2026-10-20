import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OptionalFieldDisclosure } from '../src/components/fields/OptionalFieldDisclosure'

describe('OptionalFieldDisclosure', () => {
  it('shows and hides the optional field with a button', async () => {
    const user = userEvent.setup()
    render(
      <OptionalFieldDisclosure label="Note">
        <textarea aria-label="Note" />
      </OptionalFieldDisclosure>,
    )
    expect(screen.queryByRole('textbox', { name: 'Note' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add note' }))
    expect(screen.getByRole('textbox', { name: 'Note' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hide note' })).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('button', { name: 'Hide note' }))
    expect(screen.queryByRole('textbox', { name: 'Note' })).not.toBeInTheDocument()
  })

  it('starts open when the field already has a value', () => {
    render(
      <OptionalFieldDisclosure label="Subtitle" defaultOpen>
        <input aria-label="Subtitle" />
      </OptionalFieldDisclosure>,
    )
    expect(screen.getByRole('textbox', { name: 'Subtitle' })).toBeInTheDocument()
  })

  it('can be controlled and takes its own words', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <OptionalFieldDisclosure label="Note" open={false} onOpenChange={onOpenChange} addLabel="Write a note">
        <textarea aria-label="Note" />
      </OptionalFieldDisclosure>,
    )
    await user.click(screen.getByRole('button', { name: 'Write a note' }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(screen.queryByRole('textbox', { name: 'Note' })).not.toBeInTheDocument()
  })
})
