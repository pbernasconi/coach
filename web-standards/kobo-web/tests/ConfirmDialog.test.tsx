import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '../src/components/overlays/ConfirmDialog'

const base = {
  open: true,
  onOpenChange: () => {},
  title: 'Delete the trip?',
  description: 'You cannot undo this.',
  onConfirm: () => {},
}

describe('ConfirmDialog', () => {
  it('renders an alert dialog when open, and nothing when closed', () => {
    const { rerender } = render(<ConfirmDialog {...base} />)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    rerender(<ConfirmDialog {...base} open={false} />)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('shows the title and description', () => {
    render(<ConfirmDialog {...base} />)
    const dialog = screen.getByRole('alertdialog', { name: 'Delete the trip?' })
    expect(within(dialog).getByText('You cannot undo this.')).toBeInTheDocument()
  })

  it('does not close itself on confirm: the caller closes it when the work is done', async () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(<ConfirmDialog {...base} onConfirm={onConfirm} onOpenChange={onOpenChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('closes on cancel', async () => {
    const onOpenChange = vi.fn()
    render(<ConfirmDialog {...base} onOpenChange={onOpenChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows custom labels', () => {
    render(<ConfirmDialog {...base} confirmLabel="Yes, delete" cancelLabel="No, keep it" />)
    expect(screen.getByRole('button', { name: 'Yes, delete' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No, keep it' })).toBeInTheDocument()
  })

  it('blocks both buttons while loading', () => {
    render(<ConfirmDialog {...base} loading />)
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('cannot be closed with Escape while loading', async () => {
    const onOpenChange = vi.fn()
    render(<ConfirmDialog {...base} onOpenChange={onOpenChange} loading />)
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })
})
