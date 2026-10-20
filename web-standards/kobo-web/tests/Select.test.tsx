import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../src/components/fields/Select'

beforeAll(() => {
  // jsdom has no Pointer Capture API, and Radix Select calls it on pointerdown.
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
})

function CityPicker() {
  const [city, setCity] = useState('')
  return (
    <>
      <Select value={city} onValueChange={setCity}>
        <SelectTrigger aria-label="City">
          <SelectValue placeholder="Pick a city" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="lisbon">Lisbon</SelectItem>
          <SelectItem value="oslo">Oslo</SelectItem>
        </SelectContent>
      </Select>
      <p>Chosen: {city || 'none'}</p>
    </>
  )
}

describe('Select', () => {
  it('shows the placeholder, opens, and picks an option', async () => {
    const user = userEvent.setup()
    render(<CityPicker />)
    const trigger = screen.getByRole('combobox', { name: 'City' })
    expect(trigger).toHaveTextContent('Pick a city')
    await user.click(trigger)
    await user.click(await screen.findByRole('option', { name: 'Oslo' }))
    expect(screen.getByText('Chosen: oslo')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'City' })).toHaveTextContent('Oslo')
  })
})
