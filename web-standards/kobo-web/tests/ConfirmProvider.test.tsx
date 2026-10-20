import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Button, ConfirmProvider, confirmBlocker, useConfirm } from '../src'

function Plain() {
  const confirm = useConfirm()
  const [answer, setAnswer] = useState('none')
  return (
    <>
      <Button onClick={async () => setAnswer(String(await confirm({ title: 'Delete the note?', destructive: true })))}>
        Delete
      </Button>
      <p>answer: {answer}</p>
    </>
  )
}

function WithReason() {
  const confirm = useConfirm()
  const [answer, setAnswer] = useState('none')
  const ask = async () => {
    const result = await confirm({ title: 'Archive the trip?', reason: { label: 'Reason', required: true } })
    setAnswer(`${result.confirmed}:${result.reason ?? ''}`)
  }
  return (
    <>
      <Button onClick={ask}>Archive</Button>
      <p>answer: {answer}</p>
    </>
  )
}

const renderWith = (ui: React.ReactNode) => render(<ConfirmProvider>{ui}</ConfirmProvider>)

describe('useConfirm', () => {
  it('resolves true on confirm', async () => {
    renderWith(<Plain />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('alertdialog', { name: 'Delete the note?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText('answer: true')).toBeInTheDocument()
  })

  it('resolves false on cancel and on Escape', async () => {
    renderWith(<Plain />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(await screen.findByText('answer: false')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.keyboard('{Escape}')
    expect(await screen.findByText('answer: false')).toBeInTheDocument()
  })

  it('blocks the action until a required reason is typed, then returns it', async () => {
    renderWith(<WithReason />)
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }))
    const confirmButton = screen.getByRole('button', { name: 'Confirm' })
    expect(confirmButton).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox', { name: /Reason/ }), '  No longer needed ')
    await userEvent.click(confirmButton)
    expect(await screen.findByText('answer: true:No longer needed')).toBeInTheDocument()
  })
})

describe('confirmBlocker', () => {
  it('passes an empty optional reason and stops a short one', () => {
    const reason = { label: 'Reason', minLength: 5 }
    expect(confirmBlocker({ reason }, { reason: '', typedWord: '' })).toBeNull()
    expect(confirmBlocker({ reason }, { reason: 'abc', typedWord: '' })).toBe('reason-short')
  })
  it('matches a typed word without case by default', () => {
    const typedWord = { label: 'Type DELETE', expected: 'DELETE' }
    expect(confirmBlocker({ typedWord }, { reason: '', typedWord: 'delete' })).toBeNull()
    expect(confirmBlocker({ typedWord: { ...typedWord, caseSensitive: true } }, { reason: '', typedWord: 'delete' })).toBe(
      'word-mismatch',
    )
  })
})
