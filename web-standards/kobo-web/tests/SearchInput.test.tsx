import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SearchInput } from '../src/components/fields/SearchInput'

function Controlled({ onClear }: { onClear: () => void }) {
  const [value, setValue] = useState('')
  return <SearchInput aria-label="Search notes" value={value} onChange={(e) => setValue(e.target.value)} onClear={onClear} />
}

describe('SearchInput', () => {
  it('is a search box with a clear button only when it has text', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(<Controlled onClear={onClear} />)
    const box = screen.getByRole('searchbox', { name: 'Search notes' })
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
    await user.type(box, 'tart')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(box).toHaveValue('')
    expect(box).toHaveFocus()
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('clears an uncontrolled field', async () => {
    const user = userEvent.setup()
    render(<SearchInput aria-label="Search" defaultValue="oslo" />)
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('')
  })
})
