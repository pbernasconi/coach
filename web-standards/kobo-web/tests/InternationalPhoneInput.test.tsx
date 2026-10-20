import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../src/components/overlays/Dialog'
import { COUNTRY_OPTIONS } from '../src/components/fields/countries'
import { InternationalPhoneInput } from '../src/components/fields/InternationalPhoneInput'
import { EMPTY_INTERNATIONAL_PHONE, type InternationalPhoneValue } from '../src/components/fields/phoneNumber'

function Phone({ onChange, onBlur }: { onChange?: (value: InternationalPhoneValue) => void; onBlur?: () => void }) {
  const [value, setValue] = useState(EMPTY_INTERNATIONAL_PHONE)
  return (
    <InternationalPhoneInput
      aria-label="Phone number"
      value={value}
      onBlur={onBlur}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

const countryButton = (name: RegExp) => screen.getByRole('combobox', { name })

describe('InternationalPhoneInput', () => {
  it('tabs straight into the number', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">Before</button>
        <Phone />
      </>,
    )
    screen.getByRole('button', { name: 'Before' }).focus()
    await user.tab()
    expect(screen.getByRole('textbox', { name: 'Phone number' })).toHaveFocus()
  })

  it('shows a flag on the button and on every country in the list', async () => {
    const user = userEvent.setup()
    render(<Phone />)
    await user.click(countryButton(/united states \+1/i))
    await screen.findByText('Singapore')
    expect(screen.getAllByRole('option')).toHaveLength(COUNTRY_OPTIONS.length)
  })

  it('names the button after the picked country', async () => {
    const user = userEvent.setup()
    render(<Phone />)
    await user.click(countryButton(/united states \+1/i))
    await user.click(await screen.findByRole('option', { name: /Singapore/ }))
    expect(countryButton(/singapore \+65/i)).toBeInTheDocument()
  })

  it('finds a country by calling code', async () => {
    const user = userEvent.setup()
    render(<Phone />)
    await user.click(countryButton(/united states \+1/i))
    await user.keyboard('+65')
    await user.keyboard('{Enter}')
    expect(countryButton(/singapore \+65/i)).toBeInTheDocument()
  })

  it('works inside a modal dialog', async () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Add a phone number</DialogTitle>
          <DialogDescription>We send a code to it.</DialogDescription>
          <Phone />
        </DialogContent>
      </Dialog>,
    )
    fireEvent.click(countryButton(/united states \+1/i))
    fireEvent.click(await screen.findByText('Singapore'))
    expect(countryButton(/singapore \+65/i)).toBeInTheDocument()
  })

  it('keeps the digits when the country changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Phone onChange={onChange} />)
    await user.type(screen.getByRole('textbox', { name: 'Phone number' }), '5305550142')
    expect(screen.getByRole('textbox', { name: 'Phone number' })).toHaveValue('(530) 555-0142')
    await user.click(countryButton(/united states \+1/i))
    await user.click(await screen.findByRole('option', { name: /United Kingdom/ }))
    expect(countryButton(/united kingdom \+44/i)).toBeInTheDocument()
    expect(onChange).toHaveBeenLastCalledWith({ country: 'GB', nationalNumber: '5305550142' })
  })

  it('disables the country button and the number together', () => {
    render(<InternationalPhoneInput aria-label="Phone number" value={EMPTY_INTERNATIONAL_PHONE} onChange={vi.fn()} disabled />)
    expect(countryButton(/united states \+1/i)).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Phone number' })).toBeDisabled()
  })

  it('reads a pasted international number into a country and digits', async () => {
    const onChange = vi.fn()
    const onBlur = vi.fn()
    render(<Phone onChange={onChange} onBlur={onBlur} />)
    const input = screen.getByRole('textbox', { name: 'Phone number' })
    fireEvent.change(input, { target: { value: '+65 8123 4567' } })
    fireEvent.blur(input)
    await waitFor(() => expect(input).toHaveValue('8123 4567'))
    expect(countryButton(/singapore \+65/i)).toBeInTheDocument()
    expect(onChange).toHaveBeenLastCalledWith({ country: 'SG', nationalNumber: '81234567' })
    expect(onBlur).toHaveBeenCalled()
  })
})
