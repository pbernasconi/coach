import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InlineNotice, Meter, meterTone, MoneyDisplay, StatTile, statDelta } from '../src'

describe('MoneyDisplay', () => {
  it('speaks the amount', () => {
    render(<MoneyDisplay cents={-4599} />)
    expect(screen.getByRole('img', { name: 'negative 45 dollars and 99 cents' })).toHaveTextContent('−$45.99')
  })
  it('masks a hidden amount and never shows zero', () => {
    render(<MoneyDisplay cents={null} />)
    expect(screen.getByRole('img', { name: 'Amount hidden' })).toHaveTextContent('$••••')
  })
  it('signs a change', () => {
    render(<MoneyDisplay cents={852} signed />)
    expect(screen.getByRole('img')).toHaveTextContent('+$8.52')
  })
})

describe('statDelta', () => {
  it('marks a rise as good by default', () => {
    expect(statDelta(3, '+3')).toEqual({ text: '+3', tone: 'success', direction: 'up' })
  })
  it('marks a fall as good when less is better', () => {
    expect(statDelta(-2, '−2', { goodWhen: 'down' }).tone).toBe('success')
    expect(statDelta(2, '+2', { goodWhen: 'down' }).tone).toBe('danger')
  })
  it('is neutral and flat for no change', () => {
    expect(statDelta(0, '0')).toEqual({ text: '0', tone: 'neutral', direction: 'flat' })
  })
  it('renders the delta text next to the value', () => {
    render(<StatTile label="Open tasks" value="18" delta={statDelta(3, '+3')} />)
    expect(screen.getByText('+3')).toBeInTheDocument()
  })
})

describe('Meter', () => {
  it('exposes a clamped value and a label', () => {
    render(<Meter value={1.4} label="Storage used" />)
    const meter = screen.getByRole('meter', { name: 'Storage used' })
    expect(meter).toHaveAttribute('aria-valuenow', '100')
    expect(meter).toHaveAttribute('aria-valuetext', '100 percent')
  })
  it.each([
    [0.2, false, 'success'],
    [0.6, false, 'warning'],
    [0.9, false, 'danger'],
    [0.2, true, 'danger'],
    [0.9, true, 'success'],
  ])('meterTone(%d, higherIsBetter=%s) → %s', (value, higherIsBetter, tone) => {
    expect(meterTone(value, { higherIsBetter })).toBe(tone)
  })
})

describe('InlineNotice', () => {
  it('is an alert for danger and a note otherwise', () => {
    const { rerender } = render(<InlineNotice tone="danger" title="Save failed" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Save failed')
    rerender(<InlineNotice tone="info" title="Heads up" />)
    expect(screen.getByRole('note')).toHaveTextContent('Heads up')
  })
})
