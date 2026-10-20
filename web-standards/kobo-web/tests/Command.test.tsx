import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '../src/components/overlays/Command'
import { Popover, PopoverContent, PopoverTrigger } from '../src/components/overlays/Popover'
import { commandFilter, rankOption, searchOptions } from '../src/components/overlays/selectSearch'
import vectors from './vectors/select-search.json'

describe('CommandDialog', () => {
  it('has a safe default name, and takes a fixed title', () => {
    const { unmount } = render(
      <CommandDialog open>
        <CommandList>
          <CommandEmpty>No results</CommandEmpty>
        </CommandList>
      </CommandDialog>,
    )
    expect(screen.getByRole('dialog', { name: 'Command menu' })).toBeInTheDocument()
    unmount()
    render(
      <CommandDialog open title="Search notes">
        <CommandList>
          <CommandEmpty>No matching notes</CommandEmpty>
        </CommandList>
      </CommandDialog>,
    )
    expect(screen.getByRole('dialog', { name: 'Search notes' })).toBeInTheDocument()
  })
})

describe('Command', () => {
  function Palette({ onSelect }: { onSelect: (value: string) => void }) {
    return (
      <Command filter={commandFilter}>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandEmpty>No notes found.</CommandEmpty>
          <CommandGroup heading="Notes">
            <CommandItem value="Trip to Lisbon" onSelect={onSelect}>
              Trip to Lisbon <CommandShortcut>⌘1</CommandShortcut>
            </CommandItem>
            <CommandItem value="Garden plan" onSelect={onSelect}>
              Garden plan
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    )
  }

  it('filters as people type and runs the highlighted item with Enter', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Palette onSelect={onSelect} />)
    await user.type(screen.getByPlaceholderText('Search'), 'gar')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('Garden plan')
  })

  it('shows the empty text when nothing matches', async () => {
    const user = userEvent.setup()
    render(<Palette onSelect={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search'), 'zz')
    expect(screen.getByText('No notes found.')).toBeInTheDocument()
  })
})

describe('Popover', () => {
  function Filters() {
    const [open, setOpen] = useState(false)
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger>Filters</PopoverTrigger>
        <PopoverContent aria-label="Filters panel">Only shared notes</PopoverContent>
      </Popover>
    )
  }

  it('opens from its trigger and closes with Escape', async () => {
    const user = userEvent.setup()
    render(<Filters />)
    const trigger = screen.getByRole('button', { name: 'Filters' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Filters panel' })).toHaveTextContent('Only shared notes')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})

describe('selectSearch (select-search.json)', () => {
  type Option = { value: string; label: string; keywords?: string[]; description?: string }
  const sets = vectors.optionSets as Record<string, Option[]>

  it.each(vectors.cases)('$optionSet: $query', ({ optionSet, query, values }) => {
    expect(searchOptions(sets[optionSet] ?? [], query).map((option) => option.value)).toEqual(values)
  })

  it('ranks an exact keyword over a label prefix over a keyword prefix over a substring', () => {
    expect(rankOption({ label: 'Switzerland', keywords: ['CH'] }, 'ch')).toBe(4)
    expect(rankOption({ label: 'Chad', keywords: ['TD'] }, 'ch')).toBe(3)
    expect(rankOption({ label: 'Switzerland', keywords: ['CH'] }, 'c')).toBe(2)
    expect(rankOption({ label: 'Czechia', keywords: ['CZ'] }, 'ch')).toBe(1)
    expect(rankOption({ label: 'Cambodia', keywords: ['KH'] }, 'ch')).toBe(0)
    expect(commandFilter('Switzerland', ' CH ', ['CH'])).toBe(4)
  })
})
