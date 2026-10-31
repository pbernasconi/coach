import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChatChangeCard } from '../src/components/chat/ChatChangeCard'
import { ChatFeedbackRow } from '../src/components/chat/ChatFeedbackRow'
import { ChatQuestionCard } from '../src/components/chat/ChatQuestionCard'
import { ChatQuickReplies } from '../src/components/chat/ChatQuickReplies'
import { ChatThought } from '../src/components/chat/ChatThought'
import { ChatWelcome } from '../src/components/chat/ChatWelcome'
import { ChatHistoryList } from '../src/components/chat/ChatHistoryList'
import { ChatMarkdown } from '../src/components/chat/ChatMarkdown'
import { ChatAttachmentStrip } from '../src/components/chat/ChatAttachmentStrip'
import { ChatBreakdownCard } from '../src/components/chat/ChatBreakdownCard'
import { ChatMessage } from '../src/components/chat/ChatMessage'
import { ChatStatusLine } from '../src/components/chat/ChatStatusLine'

const days = [
  { label: 'Tue 3 Mar', rows: [{ title: 'Design sync', tag: 'Skipped', tone: 'skip' as const }] },
  { label: 'Wed 4 Mar', rows: [{ title: 'Team review', tag: 'From Tue', tone: 'move' as const }] },
]

describe('ChatChangeCard', () => {
  it('applies or turns down an open card', async () => {
    const user = userEvent.setup()
    const apply = vi.fn()
    const dismiss = vi.fn()
    render(<ChatChangeCard title="Move the review" days={days} status="open" onApply={apply} onDismiss={dismiss} />)
    expect(screen.getByRole('region', { name: 'Move the review' })).toBeInTheDocument()
    expect(screen.getByText('From Tue')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Apply 2 changes' }))
    await user.click(screen.getByRole('button', { name: 'Not now' }))
    expect(apply).toHaveBeenCalledOnce()
    expect(dismiss).toHaveBeenCalledOnce()
  })

  it('says Applied and offers Undo, which can ask first', async () => {
    const user = userEvent.setup()
    const undo = vi.fn()
    const confirm = vi.fn()
    const { rerender } = render(<ChatChangeCard title="Move" days={days} status="applied" onUndo={undo} />)
    expect(screen.getByText('Applied')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(undo).toHaveBeenCalled()
    rerender(
      <ChatChangeCard title="Move" days={days} status="applied" onUndo={undo} undoConfirm={{ message: 'You moved Team review since.', count: 1, onConfirm: confirm, onCancel: vi.fn() }} />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('You moved Team review since.')
    await user.click(screen.getByRole('button', { name: 'Undo 1' }))
    expect(confirm).toHaveBeenCalled()
  })

  it('has no buttons once dismissed', () => {
    render(<ChatChangeCard title="Move" days={days} status="dismissed" onApply={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getByText('Dismissed')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('ChatQuestionCard', () => {
  it('walks through the questions and sends the answers as one message', async () => {
    const user = userEvent.setup()
    const submit = vi.fn()
    render(
      <ChatQuestionCard
        onSubmit={submit}
        questions={[
          { id: 'q1', title: 'Which room?', kind: 'single', options: ['North', 'South'] },
          { id: 'q2', title: 'Which days?', kind: 'multi', options: ['Mon', 'Tue', 'Wed'] },
          { id: 'q3', title: 'Bring snacks?', kind: 'confirm', options: [], confirm: { primary: 'Yes', secondary: 'No' } },
          { id: 'q4', title: 'Anything else?', kind: 'text', options: [] },
        ]}
      />,
    )
    expect(screen.getByText('1 of 4')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'South' }))
    await user.click(screen.getByRole('button', { name: 'Mon' }))
    await user.click(screen.getByRole('button', { name: 'Wed' }))
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Send answer' }))
    await user.click(screen.getByRole('button', { name: 'No' }))
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(submit).toHaveBeenCalledWith('Which room?: South\nWhich days?: Mon, Wed\nBring snacks?: No\nAnything else?: skip')
  })

  it('adds another pick from a field', async () => {
    const user = userEvent.setup()
    const submit = vi.fn()
    render(<ChatQuestionCard onSubmit={submit} questions={[{ id: 'q', title: 'Which days?', kind: 'multi', options: ['Mon', 'Tue'], allowOther: true }]} />)
    await user.click(screen.getByRole('button', { name: 'Add another…' }))
    await user.type(screen.getByRole('textbox', { name: 'Add another…' }), 'Sun{Enter}')
    expect(screen.getByRole('button', { name: 'Sun' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getAllByRole('button', { name: 'Send answer' }).at(-1)!)
    expect(submit).toHaveBeenCalledWith('Which days?: Sun')
  })
})

describe('reply parts', () => {
  it('rates a reply and clears the rating on a second tap', async () => {
    const user = userEvent.setup()
    const rate = vi.fn()
    const { rerender } = render(<ChatFeedbackRow text="Hi" rating={null} onRate={rate} />)
    await user.click(screen.getByRole('button', { name: 'Good reply' }))
    expect(rate).toHaveBeenLastCalledWith('up')
    rerender(<ChatFeedbackRow text="Hi" rating="up" onRate={rate} />)
    expect(screen.getByRole('button', { name: 'Good reply' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Good reply' }))
    expect(rate).toHaveBeenLastCalledWith(null)
  })

  it('sends a quick reply', async () => {
    const user = userEvent.setup()
    const reply = vi.fn()
    render(<ChatQuickReplies replies={['Yes', 'No']} onReply={reply} />)
    await user.click(screen.getByRole('button', { name: 'No' }))
    expect(reply).toHaveBeenCalledWith('No')
  })

  it('folds the thought and opens it on click', async () => {
    const user = userEvent.setup()
    render(<ChatThought>Thursday is free.</ChatThought>)
    expect(screen.queryByText('Thursday is free.')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thought' }))
    expect(screen.getByText('Thursday is free.')).toBeVisible()
  })

  it('fills the composer from a starter prompt', async () => {
    const user = userEvent.setup()
    const pick = vi.fn()
    render(<ChatWelcome title="How can I help?" prompts={[{ title: 'Plan a trip' }]} onPrompt={pick}><p>composer</p></ChatWelcome>)
    expect(screen.getByText('composer')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How can I help?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Plan a trip' }))
    expect(pick).toHaveBeenCalledWith({ title: 'Plan a trip' })
  })

  it('lists past chats, marks the open one and opens a pick', async () => {
    const user = userEvent.setup()
    const pick = vi.fn()
    const today = new Date().toISOString()
    render(<ChatHistoryList activeId="b" onSelect={pick} items={[{ id: 'a', title: 'Trip', updatedAt: today }, { id: 'b', title: 'Review', updatedAt: today }]} />)
    expect(screen.getByRole('region', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Review' })).toHaveAttribute('aria-current', 'page')
    await user.click(screen.getByRole('button', { name: 'Trip' }))
    expect(pick).toHaveBeenCalledWith('a')
  })

  it('renders Markdown and leaves raw HTML out', () => {
    render(<ChatMarkdown>{'Move **Team review** to Thursday.\n\n- one\n- two\n\n<script>bad()</script>'}</ChatMarkdown>)
    expect(screen.getByText('Team review').tagName).toBe('STRONG')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(document.querySelector('script')).toBeNull()
  })

  it('shows a status line, user bubble, attachments and a breakdown', async () => {
    const user = userEvent.setup()
    const remove = vi.fn()
    render(
      <>
        <ChatStatusLine>Reading your notes</ChatStatusLine>
        <ChatMessage from="user">Hello</ChatMessage>
        <ChatAttachmentStrip items={[{ id: 'a', name: 'Plan.pdf', kind: 'pdf', state: 'uploading' }]} onRemove={remove} />
        <ChatBreakdownCard title="Time" total="3 h" rows={[{ label: 'Garden', value: 2, display: '2 h' }]} />
      </>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Reading your notes')
    expect(screen.getByText('Uploading Plan.pdf')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove Plan.pdf' }))
    expect(remove).toHaveBeenCalledWith('a')
    expect(screen.getByRole('region', { name: 'Time' })).toHaveTextContent('2 h')
  })
})
