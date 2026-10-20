import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CountryCombobox } from '../src/components/fields/CountryCombobox'
import { CountryFlagIcon } from '../src/components/fields/CountryFlagIcon'
import { flagEmoji } from '../src/components/fields/countries'

function Picker({ countries, onPick }: { countries?: string[]; onPick?: (code: string) => void }) {
  const [value, setValue] = useState<string | undefined>()
  return (
    <CountryCombobox
      aria-label="Country"
      value={value}
      countries={countries}
      onValueChange={(code) => {
        setValue(code)
        onPick?.(code)
      }}
    />
  )
}

describe('CountryCombobox', () => {
  it('shows the placeholder, then the picked country', async () => {
    const user = userEvent.setup()
    render(<Picker />)
    const button = screen.getByRole('combobox', { name: 'Country' })
    expect(button).toHaveTextContent('Select a country')
    await user.click(button)
    await user.click(await screen.findByRole('option', { name: /Singapore/ }))
    expect(button).toHaveTextContent('Singapore')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('puts the exact ISO code first: "ch" is Switzerland', async () => {
    const user = userEvent.setup()
    render(<Picker />)
    await user.click(screen.getByRole('combobox', { name: 'Country' }))
    await user.keyboard('ch')
    const options = await screen.findAllByRole('option')
    expect(options[0]).toHaveTextContent('Switzerland')
    expect(screen.queryByRole('option', { name: /Cambodia/ })).not.toBeInTheDocument()
  })

  it('opens with a letter typed on the closed button as the search', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(<Picker onPick={onPick} />)
    screen.getByRole('combobox', { name: 'Country' }).focus()
    await user.keyboard('j')
    const search = await screen.findByPlaceholderText('Search countries')
    expect(search).toHaveValue('j')
    await waitFor(() => expect(search).toHaveFocus())
    await user.type(search, 'p', { skipClick: true, initialSelectionStart: 1, initialSelectionEnd: 1 })
    expect(screen.getByPlaceholderText('Search countries')).toHaveValue('jp')
    expect((await screen.findAllByRole('option'))[0]).toHaveTextContent('Japan')
    await user.keyboard('{Enter}')
    expect(onPick).toHaveBeenCalledWith('JP')
  })

  it('lists only the given countries', async () => {
    const user = userEvent.setup()
    render(<Picker countries={['ca', 'MX']} />)
    await user.click(screen.getByRole('combobox', { name: 'Country' }))
    expect(await screen.findAllByRole('option')).toHaveLength(2)
  })
})

describe('CountryFlagIcon', () => {
  it('is decorative by default', () => {
    render(<CountryFlagIcon country="US" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('speaks the country name, or a custom label, when not decorative', () => {
    render(
      <>
        <CountryFlagIcon country="SG" decorative={false} />
        <CountryFlagIcon country="GB" decorative={false} label="United Kingdom" />
      </>,
    )
    expect(screen.getByRole('img', { name: 'Singapore flag' })).toHaveTextContent(flagEmoji('SG'))
    expect(screen.getByRole('img', { name: 'United Kingdom' })).toHaveTextContent(flagEmoji('GB'))
  })
})
