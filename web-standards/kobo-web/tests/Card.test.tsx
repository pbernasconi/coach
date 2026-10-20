import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../src/components/display/Card'

describe('Card', () => {
  it('renders its parts with the title as a heading', () => {
    render(
      <Card aria-label="Trip">
        <CardHeader>
          <CardTitle>Trip to Lisbon</CardTitle>
          <CardDescription>3 days</CardDescription>
        </CardHeader>
        <CardContent>Flights and a flat</CardContent>
        <CardFooter>
          <button type="button">Open</button>
        </CardFooter>
      </Card>,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Trip to Lisbon' })).toBeInTheDocument()
    expect(screen.getByText('3 days')).toBeInTheDocument()
    expect(screen.getByText('Flights and a flat')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
  })

  it('passes attributes through to the root', () => {
    render(<Card data-testid="card" role="region" aria-label="Summary" />)
    expect(screen.getByRole('region', { name: 'Summary' })).toBeInTheDocument()
  })
})
