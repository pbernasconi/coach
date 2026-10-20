import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CurrencyInput } from '../src/components/fields/CurrencyInput'

function StringHarness({ formatOnBlur }: { formatOnBlur?: boolean }) {
  const [value, setValue] = useState('')
  return (
    <>
      <CurrencyInput aria-label="Price" stringValue={value} onStringChange={setValue} formatOnBlur={formatOnBlur} />
      <output aria-label="Raw">{value}</output>
    </>
  )
}

function CentsHarness({
  fixedDecimalScale,
  initial = null,
  locale = 'en-US',
}: {
  fixedDecimalScale?: boolean
  initial?: number | null
  locale?: string
}) {
  const [cents, setCents] = useState<number | null>(initial)
  return (
    <>
      <CurrencyInput aria-label="Price" value={cents} onChange={setCents} fixedDecimalScale={fixedDecimalScale} locale={locale} />
      <output aria-label="Cents">{cents === null ? 'null' : cents}</output>
    </>
  )
}

const field = () => screen.getByRole('textbox', { name: 'Price' })
const output = (name: string) => screen.getByRole('status', { name })

describe('CurrencyInput, string mode', () => {
  it('pads "123" to "123.00" on blur', async () => {
    const user = userEvent.setup()
    render(<StringHarness formatOnBlur />)
    await user.type(field(), '123')
    expect(output('Raw')).toHaveTextContent(/^123$/)
    await user.tab()
    expect(output('Raw')).toHaveTextContent(/^123\.00$/)
    expect(field()).toHaveValue('$123.00')
  })

  it('pads "123.5" and keeps "123.45" on blur', async () => {
    const user = userEvent.setup()
    render(<StringHarness formatOnBlur />)
    await user.type(field(), '123.5')
    await user.tab()
    expect(output('Raw')).toHaveTextContent(/^123\.50$/)
    await user.clear(field())
    await user.type(field(), '123.45')
    await user.tab()
    expect(output('Raw')).toHaveTextContent(/^123\.45$/)
  })

  it('leaves an empty field empty on blur', async () => {
    const user = userEvent.setup()
    render(<StringHarness formatOnBlur />)
    await user.click(field())
    await user.tab()
    expect(output('Raw')).toHaveTextContent('')
  })

  it('does not pad without formatOnBlur', async () => {
    const user = userEvent.setup()
    render(<StringHarness />)
    await user.type(field(), '123')
    await user.tab()
    expect(output('Raw')).toHaveTextContent(/^123$/)
  })
})

describe('CurrencyInput, cents mode', () => {
  it.each([
    [500, '$5.00'],
    [0, '$0.00'],
    [1250, '$12.50'],
    [123456, '$1,234.56'],
  ])('shows %i cents as %s with fixedDecimalScale', (cents, text) => {
    render(<CentsHarness fixedDecimalScale initial={cents} />)
    expect(field()).toHaveValue(text)
  })

  it('shows an empty field for null, and $5 for 500 without fixedDecimalScale', () => {
    const { unmount } = render(<CentsHarness initial={null} />)
    expect(field()).toHaveValue('')
    expect(field()).toHaveAttribute('placeholder', '$0.00')
    unmount()
    render(<CentsHarness initial={500} />)
    expect(field()).toHaveValue('$5')
  })

  it('reports cents as the person types, and keeps a typed point', async () => {
    const user = userEvent.setup()
    render(<CentsHarness />)
    await user.type(field(), '5')
    expect(output('Cents')).toHaveTextContent(/^500$/)
    await user.type(field(), '.')
    expect(field()).toHaveValue('$5.')
    await user.type(field(), '25')
    expect(output('Cents')).toHaveTextContent(/^525$/)
    expect(field()).toHaveValue('$5.25')
  })

  it('reports null, never 0, when the field is cleared', async () => {
    const user = userEvent.setup()
    render(<CentsHarness initial={500} />)
    await user.clear(field())
    expect(output('Cents')).toHaveTextContent(/^null$/)
  })

  it('stops at two decimals and adds thousands commas', async () => {
    const user = userEvent.setup()
    render(<CentsHarness />)
    await user.type(field(), '1234.567')
    expect(field()).toHaveValue('$1,234.56')
    expect(output('Cents')).toHaveTextContent(/^123456$/)
  })

  it('reads a pasted German amount in a German locale', async () => {
    const user = userEvent.setup()
    render(<CentsHarness locale="de-DE" />)
    await user.click(field())
    await user.paste('1.234,56')
    expect(output('Cents')).toHaveTextContent(/^123456$/)
    expect(field()).toHaveValue('$1,234.56')
  })

  it('reads "12,50" pasted over the whole amount as twelve fifty', async () => {
    const user = userEvent.setup()
    render(<CentsHarness initial={123450} />)
    await user.tripleClick(field())
    await user.paste('12,50')
    expect(output('Cents')).toHaveTextContent(/^1250$/)
  })

  it('opens the decimal keypad on a phone', () => {
    render(<CentsHarness />)
    expect(field()).toHaveAttribute('inputmode', 'decimal')
  })
})
