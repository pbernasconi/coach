import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Toaster, toast } from '../src/components/overlays/Toaster'

beforeAll(() => {
  // jsdom has no matchMedia; sonner reads the colour scheme with it.
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
  // Nor pointer capture, which a toast uses for swipes.
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
})

afterEach(() => {
  act(() => toast.dismiss())
})

describe('Toaster', () => {
  it('shows a toast with its title and description in a labelled region', async () => {
    render(<Toaster />)
    act(() => {
      toast.success('Note saved', { description: 'It is on all your devices.' })
    })
    expect(await screen.findByText('Note saved')).toBeInTheDocument()
    expect(screen.getByText('It is on all your devices.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Notifications/ })).toBeInTheDocument()
  })

  it('gives every tone an icon, so the kind never relies on colour alone', async () => {
    render(<Toaster />)
    act(() => {
      toast.success('Saved')
      toast.info('Synced')
      toast.warning('Almost full')
      toast.error('Not saved')
    })
    for (const title of ['Saved', 'Synced', 'Almost full', 'Not saved']) {
      const item = (await screen.findByText(title)).closest('li')
      expect(item?.querySelector('[data-icon] svg')).not.toBeNull()
    }
  })

  it('runs the action of a toast', async () => {
    const onRetry = vi.fn()
    render(<Toaster />)
    act(() => {
      toast.error('We could not save the note', { action: { label: 'Retry', onClick: onRetry } })
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
