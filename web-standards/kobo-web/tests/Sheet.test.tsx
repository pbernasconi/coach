import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Button } from '../src/components/controls/Button'
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../src/components/overlays/Sheet'

function Example({ modal = true, showOverlay = true }: { modal?: boolean; showOverlay?: boolean }) {
  return (
    <>
      <button type="button">Page action</button>
      <Sheet modal={modal}>
        <SheetTrigger asChild>
          <Button>Open trip</Button>
        </SheetTrigger>
        <SheetContent side="left" showOverlay={showOverlay}>
          <SheetHeader>
            <SheetTitle>Trip to Lisbon</SheetTitle>
            <SheetDescription>Three days in May.</SheetDescription>
          </SheetHeader>
          <SheetBody>Packing list</SheetBody>
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="secondary">Done</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

describe('Sheet', () => {
  it('opens from its trigger with a title and description', async () => {
    render(<Example />)
    await userEvent.click(screen.getByRole('button', { name: 'Open trip' }))
    const sheet = screen.getByRole('dialog', { name: 'Trip to Lisbon' })
    expect(sheet).toHaveAccessibleDescription('Three days in May.')
    expect(screen.getByText('Packing list')).toBeInTheDocument()
  })

  it('closes with the close button, a SheetClose and Escape', async () => {
    render(<Example />)
    await userEvent.click(screen.getByRole('button', { name: 'Open trip' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Open trip' }))
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Open trip' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('moves the focus into the sheet and back to the trigger', async () => {
    render(<Example />)
    const trigger = screen.getByRole('button', { name: 'Open trip' })
    await userEvent.click(trigger)
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    await userEvent.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
  })

  it('as a non-modal side panel, keeps the page usable', async () => {
    render(<Example modal={false} showOverlay={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open trip' }))
    expect(screen.getByRole('dialog', { name: 'Trip to Lisbon' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page action' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Page action' })).not.toHaveAttribute('aria-hidden')
  })
})
