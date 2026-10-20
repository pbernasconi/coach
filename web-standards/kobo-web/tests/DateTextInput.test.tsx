import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DateTextInput } from '../src/components/fields/DateTextInput'

const INVALID = 'Please enter a valid date'
const field = (name = 'Date') => screen.getByRole('textbox', { name })

describe('DateTextInput typing', () => {
  it('shows an ISO value as MM/DD/YYYY with a numeric keypad hint', () => {
    render(<DateTextInput value="1971-03-14" onChange={vi.fn()} aria-label="Birthday" autoComplete="bday" />)
    expect(field('Birthday')).toHaveValue('03/14/1971')
    expect(field('Birthday')).toHaveAttribute('placeholder', 'MM/DD/YYYY')
    expect(field('Birthday')).toHaveAttribute('inputmode', 'numeric')
    expect(field('Birthday')).toHaveAttribute('autocomplete', 'bday')
  })

  it('lets an optional date be cleared with no error', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onErrorChange = vi.fn()
    render(<DateTextInput value="2026-07-10" onChange={onChange} onErrorChange={onErrorChange} aria-label="Date" clearable />)
    await user.clear(field())
    expect(onChange).toHaveBeenLastCalledWith('')
    expect(onErrorChange).toHaveBeenLastCalledWith(null)
  })

  it('adds slashes while digits are typed and emits the ISO day', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateTextInput value="" onChange={onChange} aria-label="Date" />)
    await user.type(field(), '03')
    expect(field()).toHaveValue('03')
    await user.type(field(), '14')
    expect(field()).toHaveValue('03/14')
    await user.type(field(), '1971')
    expect(field()).toHaveValue('03/14/1971')
    expect(onChange).toHaveBeenLastCalledWith('1971-03-14')
  })

  it('stays calm while a date is half typed, but tells the parent, and shows the error on blur', async () => {
    const user = userEvent.setup()
    const onErrorChange = vi.fn()
    render(<DateTextInput value="" onChange={vi.fn()} onErrorChange={onErrorChange} aria-label="Date" />)
    await user.type(field(), '0314')
    expect(field()).toHaveValue('03/14')
    expect(screen.queryByText(INVALID)).not.toBeInTheDocument()
    expect(field()).toHaveAttribute('aria-invalid', 'false')
    expect(onErrorChange).toHaveBeenLastCalledWith(INVALID)
    await user.tab()
    expect(screen.getByText(INVALID)).toBeInTheDocument()
    expect(field()).toHaveAttribute('aria-invalid', 'true')
  })

  it('backspaces through a slash', async () => {
    const user = userEvent.setup()
    render(<DateTextInput value="" onChange={vi.fn()} aria-label="Date" />)
    await user.type(field(), '031')
    expect(field()).toHaveValue('03/1')
    await user.keyboard('{Backspace}')
    expect(field()).toHaveValue('03')
  })

  it('drops letters and stops at eight digits', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateTextInput value="" onChange={onChange} aria-label="Date" />)
    await user.type(field(), 'a0b3c1d4e1971xyz999')
    expect(field()).toHaveValue('03/14/1971')
    expect(onChange).toHaveBeenLastCalledWith('1971-03-14')
  })

  it.each([
    ['1980-05-15', '05/15/1980', '1980-05-15'],
    ['3/4/1971', '03/04/1971', '1971-03-04'],
    ['Jul 24, 2026', '07/24/2026', '2026-07-24'],
  ])('reads a pasted %s', async (pasted, shown, iso) => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateTextInput value="" onChange={onChange} aria-label="Date" />)
    await user.click(field())
    await user.paste(pasted)
    expect(field()).toHaveValue(shown)
    expect(onChange).toHaveBeenLastCalledWith(iso)
  })

  it('keeps a day that does not exist local and shows the error at once', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onErrorChange = vi.fn()
    render(<DateTextInput value="" onChange={onChange} onErrorChange={onErrorChange} aria-label="Date" />)
    await user.type(field(), '02301971')
    expect(screen.getByText(INVALID)).toBeInTheDocument()
    expect(onErrorChange).toHaveBeenLastCalledWith(INVALID)
    expect(onChange).not.toHaveBeenCalled()
    expect(field()).toHaveAttribute('aria-invalid', 'true')
  })

  it('takes Feb 29 only in a leap year and clears the error when fixed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onErrorChange = vi.fn()
    render(<DateTextInput value="" onChange={onChange} onErrorChange={onErrorChange} aria-label="Date" />)
    await user.type(field(), '02292023')
    expect(screen.getByText(INVALID)).toBeInTheDocument()
    await user.clear(field())
    await user.type(field(), '02292024')
    expect(screen.queryByText(INVALID)).not.toBeInTheDocument()
    expect(onErrorChange).toHaveBeenLastCalledWith(null)
    expect(onChange).toHaveBeenLastCalledWith('2024-02-29')
  })

  it('checks inclusive min and max with the caller messages', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DateTextInput
        value=""
        onChange={onChange}
        min="1900-01-01"
        max="2026-12-31"
        messages={{ beforeMin: 'Date is too early', afterMax: 'Date is too late' }}
        aria-label="Date"
      />,
    )
    await user.type(field(), '12311899')
    expect(screen.getByText('Date is too early')).toBeInTheDocument()
    await user.clear(field())
    await user.type(field(), '01012027')
    expect(screen.getByText('Date is too late')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
    await user.clear(field())
    await user.type(field(), '01011900')
    expect(onChange).toHaveBeenLastCalledWith('1900-01-01')
    await user.clear(field())
    await user.type(field(), '12312026')
    expect(onChange).toHaveBeenLastCalledWith('2026-12-31')
  })
})

describe('DateTextInput and its parent', () => {
  it('shows a new value from the parent and drops the old error', async () => {
    const user = userEvent.setup()
    const onErrorChange = vi.fn()
    const { rerender } = render(<DateTextInput value="1971-03-14" onChange={vi.fn()} onErrorChange={onErrorChange} aria-label="Date" />)
    await user.clear(field())
    expect(screen.queryByText(INVALID)).not.toBeInTheDocument()
    await user.tab()
    expect(screen.getByText(INVALID)).toBeInTheDocument()
    rerender(<DateTextInput value="2000-12-31" onChange={vi.fn()} onErrorChange={onErrorChange} aria-label="Date" />)
    expect(field()).toHaveValue('12/31/2000')
    expect(screen.queryByText(INVALID)).not.toBeInTheDocument()
    expect(onErrorChange).toHaveBeenLastCalledWith(null)
  })

  it('checks the value again when the value or the bounds change', () => {
    const onErrorChange = vi.fn()
    const props = { onChange: vi.fn(), onErrorChange, 'aria-label': 'Date', messages: { beforeMin: 'Date is too early' } }
    const { rerender } = render(<DateTextInput {...props} value="2026-07-09" min="2026-07-10" />)
    expect(screen.getByText('Date is too early')).toBeInTheDocument()
    expect(onErrorChange).toHaveBeenLastCalledWith('Date is too early')
    rerender(<DateTextInput {...props} value="2026-07-15" min="2026-07-10" />)
    expect(screen.queryByText('Date is too early')).not.toBeInTheDocument()
    expect(onErrorChange).toHaveBeenLastCalledWith(null)
    rerender(<DateTextInput {...props} value="2026-07-15" min="2026-07-16" />)
    expect(screen.getByText('Date is too early')).toBeInTheDocument()
  })

  it('adds its error to the caller description', async () => {
    const user = userEvent.setup()
    render(
      <>
        <DateTextInput value="" onChange={vi.fn()} aria-label="Date" aria-invalid aria-describedby="help" />
        <p id="help">Help</p>
      </>,
    )
    expect(field()).toHaveAttribute('aria-invalid', 'true')
    expect(field()).toHaveAttribute('aria-describedby', 'help')
    await user.type(field(), '071')
    await user.tab()
    const error = screen.getByText(INVALID)
    expect(field().getAttribute('aria-describedby')?.split(' ')).toEqual(['help', error.id])
  })
})

describe('DateTextInput calendar', () => {
  const openCalendar = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Open calendar for Date' }))
    return screen.findByRole('grid')
  }

  it('fills the field and emits the ISO day when a day is picked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateTextInput value="2026-07-10" onChange={onChange} aria-label="Date" />)
    const grid = await openCalendar(user)
    await user.click(within(grid).getByRole('button', { name: /July 15th, 2026/ }))
    expect(onChange).toHaveBeenLastCalledWith('2026-07-15')
    expect(field()).toHaveValue('07/15/2026')
  })

  it('opens only from its button, or with Alt+ArrowDown', async () => {
    const user = userEvent.setup()
    render(<DateTextInput value="2026-07-10" onChange={vi.fn()} aria-label="Date" />)
    await user.click(field())
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}')
    expect(await screen.findByRole('grid')).toBeInTheDocument()
    expect(field()).toHaveValue('07/10/2026')
  })

  it('commits a shortcut, but never one outside the bounds', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DateTextInput
        value="2026-07-10"
        onChange={onChange}
        min="2026-07-10"
        aria-label="Date"
        quickActions={[
          { label: 'Too early', value: '2026-07-09' },
          { label: 'Next Monday', value: '2026-07-13' },
        ]}
      />,
    )
    await openCalendar(user)
    await user.click(screen.getByRole('button', { name: 'Too early' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('grid')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next Monday' }))
    expect(onChange).toHaveBeenLastCalledWith('2026-07-13')
    expect(field()).toHaveValue('07/13/2026')
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  it('brings back the last value with Escape', async () => {
    const user = userEvent.setup()
    const onErrorChange = vi.fn()
    render(<DateTextInput value="2026-07-10" onChange={vi.fn()} onErrorChange={onErrorChange} aria-label="Date" />)
    await user.clear(field())
    await user.type(field(), '071')
    await user.keyboard('{Escape}')
    expect(field()).toHaveValue('07/10/2026')
    expect(screen.queryByText(INVALID)).not.toBeInTheDocument()
    expect(onErrorChange).toHaveBeenLastCalledWith(null)
  })

  it('disables days outside the inclusive bounds', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateTextInput value="2026-07-10" onChange={onChange} min="2026-07-10" max="2026-07-15" aria-label="Date" />)
    const grid = await openCalendar(user)
    const day = (label: string) => within(grid).getByRole('button', { name: new RegExp(label) })
    expect(day('July 9th, 2026')).toBeDisabled()
    expect(day('July 10th, 2026')).toBeEnabled()
    expect(day('July 16th, 2026')).toBeDisabled()
    await user.click(day('July 15th, 2026'))
    expect(onChange).toHaveBeenLastCalledWith('2026-07-15')
  })

  it('clears a shown error when a day is picked', async () => {
    const user = userEvent.setup()
    const onErrorChange = vi.fn()
    render(<DateTextInput value="2026-07-10" onChange={vi.fn()} onErrorChange={onErrorChange} aria-label="Date" />)
    await user.clear(field())
    await user.type(field(), '071')
    await user.tab()
    expect(field()).toHaveAttribute('aria-invalid', 'true')
    const grid = await openCalendar(user)
    await user.click(within(grid).getByRole('button', { name: /July 15th, 2026/ }))
    expect(onErrorChange).toHaveBeenLastCalledWith(null)
    expect(field()).toHaveAttribute('aria-invalid', 'false')
    expect(field()).not.toHaveAttribute('aria-describedby')
  })

  it('shows a half-typed error when Enter commits', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateTextInput value="" onChange={onChange} aria-label="Date" />)
    await user.type(field(), '071')
    await user.keyboard('{Enter}')
    const error = screen.getByText(INVALID)
    expect(field()).toHaveAttribute('aria-invalid', 'true')
    expect(field()).toHaveAttribute('aria-describedby', error.id)
    expect(onChange).not.toHaveBeenCalled()
  })
})
