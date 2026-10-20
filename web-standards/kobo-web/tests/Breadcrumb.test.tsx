import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Breadcrumb } from '../src/components/navigation/Breadcrumb'

describe('Breadcrumb', () => {
  it('renders every item in a named nav', () => {
    render(<Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Trips', href: '/trips' }, { label: 'Lisbon' }]} />)
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(nav).toHaveTextContent('Home')
    expect(nav).toHaveTextContent('Trips')
    expect(nav).toHaveTextContent('Lisbon')
  })

  it('links the items before the last one', () => {
    render(<Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Trips', href: '/trips' }, { label: 'Lisbon' }]} />)
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Trips' })).toHaveAttribute('href', '/trips')
  })

  it('marks the last item as the current page and never links it', () => {
    render(<Breadcrumb items={[{ label: 'Trips', href: '/trips' }, { label: 'Lisbon', href: '/trips/lisbon' }]} />)
    expect(screen.queryByRole('link', { name: 'Lisbon' })).not.toBeInTheDocument()
    expect(screen.getByText('Lisbon')).toHaveAttribute('aria-current', 'page')
  })

  it('handles a single item', () => {
    render(<Breadcrumb items={[{ label: 'Overview' }]} />)
    expect(screen.getByText('Overview')).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders a router link from the link slot, with the label inside', () => {
    render(
      <Breadcrumb items={[{ label: 'Notes', link: <a href="/notes" data-router="yes" /> }, { label: 'Groceries' }]} />,
    )
    const link = screen.getByRole('link', { name: 'Notes' })
    expect(link).toHaveAttribute('href', '/notes')
    expect(link).toHaveAttribute('data-router', 'yes')
  })

  it('takes another landmark name', () => {
    render(<Breadcrumb label="You are here" items={[{ label: 'Overview' }]} />)
    expect(screen.getByRole('navigation', { name: 'You are here' })).toBeInTheDocument()
  })
})
