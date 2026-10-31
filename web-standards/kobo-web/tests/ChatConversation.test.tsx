import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChatConversation, ChatConversationContent, ChatScrollButton } from '../src/components/chat/ChatConversation'
import { ChatMessage } from '../src/components/chat/ChatMessage'

describe('ChatConversation', () => {
  it('is a labelled log of messages, with no jump arrow at the bottom', () => {
    render(
      <ChatConversation label="Chat with the assistant">
        <ChatConversationContent>
          <ChatMessage from="user">Hi</ChatMessage>
          <ChatMessage from="assistant">Hello</ChatMessage>
        </ChatConversationContent>
        <ChatScrollButton />
      </ChatConversation>,
    )
    const log = screen.getByRole('log', { name: 'Chat with the assistant' })
    expect(log).toHaveTextContent('Hi')
    expect(log).toHaveTextContent('Hello')
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument()
  })
})
