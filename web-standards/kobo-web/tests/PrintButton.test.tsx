import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PrintButton } from '../src/components/print/PrintButton'
import { subscribeToPrintDocumentReady } from '../src/components/print/usePrintDocumentReady'

const addRoot = (ready: boolean) => {
  const root = document.createElement('div')
  root.className = 'print-root'
  root.dataset.printReady = ready ? 'true' : 'false'
  document.body.append(root)
  return root
}

describe('PrintButton', () => {
  beforeEach(() => {
    vi.spyOn(window, 'print').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    document.querySelectorAll('.print-root').forEach((node) => node.remove())
  })

  it('stays disabled and never prints without a ready print root', () => {
    render(<PrintButton label="Print" />)
    expect(screen.getByRole('button', { name: 'Print' })).toBeDisabled()
    expect(window.print).not.toHaveBeenCalled()
  })

  it('prints when a ready print root is already there', async () => {
    addRoot(true)
    render(<PrintButton />)
    const button = screen.getByRole('button', { name: 'Print' })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)
    expect(window.print).toHaveBeenCalledOnce()
  })

  it('follows the print root as it becomes ready and then not ready', async () => {
    const root = addRoot(false)
    render(<PrintButton label="Print" />)
    const button = screen.getByRole('button', { name: 'Print' })
    expect(button).toBeDisabled()
    act(() => {
      root.dataset.printReady = 'true'
    })
    await waitFor(() => expect(button).toBeEnabled())
    act(() => {
      root.dataset.printReady = 'false'
    })
    await waitFor(() => expect(button).toBeDisabled())
  })

  it('asks the page for the copy with onRequest, in place of printing', async () => {
    const onRequest = vi.fn()
    render(<PrintButton label="Print" onRequest={onRequest} />)
    await userEvent.click(screen.getByRole('button', { name: 'Print' }))
    expect(onRequest).toHaveBeenCalledOnce()
    expect(window.print).not.toHaveBeenCalled()
  })
})

describe('subscribeToPrintDocumentReady', () => {
  it('reports now and on every change, and stops when told', async () => {
    const onChange = vi.fn()
    const stop = subscribeToPrintDocumentReady(onChange)
    expect(onChange).toHaveBeenLastCalledWith(false)
    const root = addRoot(true)
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(true))
    stop()
    onChange.mockClear()
    root.remove()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onChange).not.toHaveBeenCalled()
  })
})
