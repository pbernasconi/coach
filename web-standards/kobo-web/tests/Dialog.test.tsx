import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../src'

describe('Dialog', () => {
  it('opens from a Button trigger and closes with the close button', async () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Rename note</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename note</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Rename note' }))
    expect(screen.getByRole('dialog', { name: 'Rename note' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
