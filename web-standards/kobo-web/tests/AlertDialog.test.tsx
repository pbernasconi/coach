import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../src/components/controls/Button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../src/components/overlays/AlertDialog'

function Example({ onDelete = () => {} }: { onDelete?: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete note</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete the note?</AlertDialogTitle>
          <AlertDialogDescription>You cannot undo this.</AlertDialogDescription>
        </AlertDialogHeader>
        <div>Packing list</div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

describe('AlertDialog', () => {
  it('shows the title, description, content and both buttons', async () => {
    render(<Example />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete note' }))
    const alert = screen.getByRole('alertdialog', { name: 'Delete the note?' })
    expect(alert).toHaveAccessibleDescription('You cannot undo this.')
    expect(screen.getByRole('heading', { name: 'Delete the note?' })).toBeInTheDocument()
    expect(screen.getByText('Packing list')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('puts the focus on cancel when it opens', async () => {
    render(<Example />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete note' }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('runs the action and closes', async () => {
    const onDelete = vi.fn()
    render(<Example onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete note' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('closes on cancel and on Escape, without the action', async () => {
    const onDelete = vi.fn()
    render(<Example onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete note' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete note' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
  })
})
