import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { Button } from '../src/components/controls/Button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../src/components/overlays/DropdownMenu'

beforeAll(() => {
  // jsdom has no ResizeObserver or pointer capture; Radix popper and menus use them.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
})

function Example({ onRename = () => {} }: { onRename?: () => void }) {
  const [pinned, setPinned] = useState(false)
  const [sort, setSort] = useState('name')
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Note actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Note</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onRename}>
              Rename <DropdownMenuShortcut>R</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>Share</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={pinned} onCheckedChange={setPinned}>
            Pinned
          </DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
            <DropdownMenuRadioItem value="name">By name</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="date">By date</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Trips</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
      <p>
        pinned: {String(pinned)}, sort: {sort}
      </p>
    </>
  )
}

async function open() {
  screen.getByRole('button', { name: 'Note actions' }).focus()
  await userEvent.keyboard('{Enter}')
  return screen.getByRole('menu')
}

describe('DropdownMenu', () => {
  it('opens from the keyboard and shows the items, the label and the separator', async () => {
    render(<Example />)
    await open()
    expect(screen.getByRole('menuitem', { name: /Rename/ })).toBeInTheDocument()
    expect(screen.getByText('Note')).toBeInTheDocument()
    expect(screen.getByRole('separator')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Share' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('runs an item and closes; Escape closes and gives the focus back', async () => {
    const onRename = vi.fn()
    render(<Example onRename={onRename} />)
    await open()
    await userEvent.click(screen.getByRole('menuitem', { name: /Rename/ }))
    expect(onRename).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await open()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Note actions' })).toHaveFocus()
  })

  it('toggles a checkbox item and picks a radio item', async () => {
    render(<Example />)
    await open()
    expect(screen.getByRole('menuitemcheckbox', { name: 'Pinned' })).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Pinned' }))
    expect(screen.getByText('pinned: true, sort: name')).toBeInTheDocument()

    await open()
    expect(screen.getByRole('menuitemcheckbox', { name: 'Pinned' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'By date' }))
    expect(screen.getByText('pinned: true, sort: date')).toBeInTheDocument()
  })

  it('opens a sub-menu with the arrow key', async () => {
    render(<Example />)
    await open()
    const subTrigger = screen.getByRole('menuitem', { name: 'Move to' })
    expect(subTrigger).toHaveAttribute('aria-haspopup', 'menu')
    subTrigger.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(await screen.findByRole('menuitem', { name: 'Trips' })).toBeInTheDocument()
  })
})
