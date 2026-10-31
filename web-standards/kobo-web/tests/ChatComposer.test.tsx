import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChatComposer } from '../src/components/chat/ChatComposer'

function Harness({ onSubmit, onAttach, busy = false, onStop }: { onSubmit: (t: string) => void; onAttach?: (f: File[]) => void; busy?: boolean; onStop?: () => void }) {
  const [text, setText] = useState('')
  return (
    <ChatComposer
      value={text}
      onValueChange={setText}
      canSend={text.trim().length > 0}
      busy={busy}
      onStop={onStop}
      onAttach={onAttach}
      onSubmit={() => {
        onSubmit(text)
        setText('')
      }}
    />
  )
}

describe('ChatComposer', () => {
  it('sends on Enter and keeps Shift-Enter as a new line', async () => {
    const user = userEvent.setup()
    const sent = vi.fn()
    render(<Harness onSubmit={sent} />)
    const field = screen.getByRole('textbox', { name: 'Ask anything' })
    await user.type(field, 'Line one{Shift>}{Enter}{/Shift}two')
    expect(field).toHaveValue('Line one\ntwo')
    await user.keyboard('{Enter}')
    expect(sent).toHaveBeenCalledWith('Line one\ntwo')
    expect(field).toHaveValue('')
  })

  it('disables Send while empty', async () => {
    const user = userEvent.setup()
    const sent = vi.fn()
    render(<Harness onSubmit={sent} />)
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await user.type(screen.getByRole('textbox'), 'Hi')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(sent).toHaveBeenCalledWith('Hi')
  })

  it('shows Stop while an answer streams', async () => {
    const user = userEvent.setup()
    const stop = vi.fn()
    render(<Harness onSubmit={vi.fn()} busy onStop={stop} />)
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    expect(stop).toHaveBeenCalled()
  })

  it('hands picked files to onAttach', async () => {
    const user = userEvent.setup()
    const attach = vi.fn()
    const { container } = render(<Harness onSubmit={vi.fn()} onAttach={attach} />)
    expect(screen.getByRole('button', { name: 'Add photos and files' })).toBeInTheDocument()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    await user.upload(input, file)
    expect(attach).toHaveBeenCalledWith([file])
  })
})
