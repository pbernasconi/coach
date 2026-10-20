import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHeader } from '../src/components/layout/PageHeader'

describe('PageHeader', () => {
  it('renders the title as an h1', () => {
    render(<PageHeader title="Notes" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Notes' })).toBeInTheDocument()
  })

  it('renders the description when given', () => {
    render(<PageHeader title="Trips" description="Plans for this year" />)
    expect(screen.getByText('Plans for this year')).toBeInTheDocument()
  })

  it('renders no description when it is left out', () => {
    render(<PageHeader title="Trips" />)
    expect(screen.queryByText(/plans/i)).not.toBeInTheDocument()
  })

  it('renders the actions slot', () => {
    render(<PageHeader title="Files" actions={<button type="button">Export</button>} />)
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
  })
})
