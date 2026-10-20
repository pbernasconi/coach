import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { PrintDocument, PrintDocumentLayout } from '../src/components/print/PrintDocument'

/** The print root is aria-hidden, so the tests read it as an element. */
function renderPrintRoot(ui: ReactElement): HTMLElement {
  const { baseElement } = render(ui)
  const root = baseElement.querySelector('.print-root')
  if (!(root instanceof HTMLElement)) throw new Error('expected a .print-root element')
  return root
}

describe('PrintDocument', () => {
  it('renders the title, meta, body, logo, notice and footer in a portal on body', () => {
    const root = renderPrintRoot(
      <PrintDocument
        title="Trip to Lisbon"
        meta="May 3 – May 9"
        logo="Atlas"
        notice="Shared copy (read only)"
        footer="Atlas Travel Notes"
        printedAt="Printed May 1, 2026"
      >
        <p>Day 1: Alfama</p>
      </PrintDocument>,
    )
    expect(root.parentElement).toBe(document.body)
    for (const text of ['Trip to Lisbon', 'May 3 – May 9', 'Atlas', 'Shared copy (read only)', 'Atlas Travel Notes', 'Printed May 1, 2026', 'Day 1: Alfama']) {
      expect(root).toHaveTextContent(text)
    }
  })

  it('stamps the time now when no stamp is given', () => {
    const root = renderPrintRoot(
      <PrintDocument title="Notes">
        <span />
      </PrintDocument>,
    )
    expect(root).toHaveTextContent(/Printed \w+/)
  })

  it('is hidden from screen readers and marked ready', () => {
    const root = renderPrintRoot(
      <PrintDocument title="Notes">
        <span>x</span>
      </PrintDocument>,
    )
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root).toHaveAttribute('data-print-ready', 'true')
  })

  it('fails closed with a message when not ready', () => {
    const root = renderPrintRoot(
      <PrintDocument title="Notes" ready={false}>
        <span>private body</span>
      </PrintDocument>,
    )
    expect(root).toHaveAttribute('data-print-ready', 'false')
    expect(root).toHaveTextContent(/cannot be printed yet/i)
    expect(root).not.toHaveTextContent('private body')
  })

  it('renders the layout on its own, with no portal', () => {
    render(
      <PrintDocumentLayout title="Recipes" printedAt="Printed today">
        <p>Bread</p>
      </PrintDocumentLayout>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Recipes' })).toBeInTheDocument()
    expect(screen.getByText('Bread')).toBeInTheDocument()
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
  })
})
