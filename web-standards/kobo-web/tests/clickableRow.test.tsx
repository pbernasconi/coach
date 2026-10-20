import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { clickableRowProps } from '../src/components/data/clickableRow'

const renderRow = (activate: () => void, cell: React.ReactNode = 'Groceries') =>
  render(
    <table>
      <tbody>
        <tr {...clickableRowProps(activate)}>
          <td>{cell}</td>
        </tr>
      </tbody>
    </table>,
  )

describe('clickableRowProps', () => {
  it('puts the row in the tab order and keeps its row role', () => {
    renderRow(vi.fn())
    expect(screen.getByRole('row')).toHaveAttribute('tabIndex', '0')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('sets aria-selected only when the caller says the row is selectable', () => {
    expect(clickableRowProps(vi.fn())).not.toHaveProperty('aria-selected')
    expect(clickableRowProps(vi.fn(), { selected: true })['aria-selected']).toBe(true)
    expect(clickableRowProps(vi.fn(), { selected: false })['aria-selected']).toBe(false)
  })

  it('activates on click, Enter and Space', () => {
    const activate = vi.fn()
    renderRow(activate)
    const row = screen.getByRole('row')
    fireEvent.click(row)
    fireEvent.keyDown(row, { key: 'Enter' })
    fireEvent.keyDown(row, { key: ' ' })
    expect(activate).toHaveBeenCalledTimes(3)
  })

  it('prevents the default of Space (page down) and Enter', () => {
    renderRow(vi.fn())
    const row = screen.getByRole('row')
    expect(fireEvent.keyDown(row, { key: ' ' })).toBe(false)
    expect(fireEvent.keyDown(row, { key: 'Enter' })).toBe(false)
  })

  it('ignores keys that do not activate', () => {
    const activate = vi.fn()
    renderRow(activate)
    fireEvent.keyDown(screen.getByRole('row'), { key: 'a' })
    fireEvent.keyDown(screen.getByRole('row'), { key: 'ArrowDown' })
    expect(activate).not.toHaveBeenCalled()
  })

  it('does not activate the row from a control in it', () => {
    const activate = vi.fn()
    renderRow(activate, <button type="button">Rename</button>)
    const rename = screen.getByRole('button', { name: 'Rename' })
    fireEvent.keyDown(rename, { key: 'Enter' })
    fireEvent.click(rename)
    expect(activate).not.toHaveBeenCalled()
  })
})
