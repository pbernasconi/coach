import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FormDialog } from '../src/components/overlays/FormDialog'

const base = { open: true, onOpenChange: () => {}, title: 'Rename note' }

describe('FormDialog', () => {
  it('renders a dialog when open, and nothing when closed', () => {
    const { rerender } = render(<FormDialog {...base}>Fields</FormDialog>)
    expect(screen.getByRole('dialog', { name: 'Rename note' })).toBeInTheDocument()
    rerender(
      <FormDialog {...base} open={false}>
        Fields
      </FormDialog>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the description and the fields', () => {
    render(
      <FormDialog {...base} description="The new name shows in every list.">
        <label>
          Name <input />
        </label>
      </FormDialog>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleDescription('The new name shows in every list.')
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toBeInTheDocument()
  })

  it('has no broken description link when there is no description', () => {
    render(<FormDialog {...base}>Fields</FormDialog>)
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby')
  })

  it('submits from the button and from Enter in a field', async () => {
    const onSubmit = vi.fn()
    render(
      <FormDialog {...base} onSubmit={onSubmit}>
        <label>
          Name <input />
        </label>
      </FormDialog>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Trip{Enter}')
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('blocks both buttons while loading', () => {
    render(
      <FormDialog {...base} loading>
        Fields
      </FormDialog>,
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('closes on cancel', async () => {
    const onOpenChange = vi.fn()
    render(
      <FormDialog {...base} onOpenChange={onOpenChange}>
        Fields
      </FormDialog>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('takes custom labels and a custom footer', () => {
    const { rerender } = render(
      <FormDialog {...base} submitLabel="Create note" cancelLabel="Not now">
        Fields
      </FormDialog>,
    )
    expect(screen.getByRole('button', { name: 'Create note' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()
    rerender(
      <FormDialog {...base} footer={<button type="button">Custom action</button>}>
        Fields
      </FormDialog>,
    )
    expect(screen.getByRole('button', { name: 'Custom action' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Not now' })).not.toBeInTheDocument()
  })

  it('preventCloseWhileLoading blocks Escape and hides the close button while loading', async () => {
    const onOpenChange = vi.fn()
    render(
      <FormDialog {...base} onOpenChange={onOpenChange} loading preventCloseWhileLoading>
        Fields
      </FormDialog>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  })

  it('preventCloseWhileLoading lets Escape close the dialog when it is not loading', async () => {
    const onOpenChange = vi.fn()
    render(
      <FormDialog {...base} onOpenChange={onOpenChange} preventCloseWhileLoading>
        Fields
      </FormDialog>,
    )
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
