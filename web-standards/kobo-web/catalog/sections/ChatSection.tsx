import { useState } from 'react'
import { CalendarDays, Clock, NotebookPen, Plane } from 'lucide-react'
import {
  Button,
  ChatAttachmentStrip,
  ChatBreakdownCard,
  ChatChangeCard,
  ChatComposer,
  ChatConversation,
  ChatConversationContent,
  ChatFeedbackRow,
  ChatMarkdown,
  ChatMessage,
  ChatQuestionCard,
  ChatQuestionInput,
  ChatQuickReplies,
  ChatScrollButton,
  ChatStatusLine,
  ChatThought,
  ChatTimestamp,
  ChatTypingDots,
  ChatWelcome,
  type ChatRating,
} from '../../src'
import { Grid, Specimen } from './Specimen'

const REPLY = `Thursday is free after **13:30**, so the review fits there.

- Move *Team review* to Thu 14:00
- Keep the design sync on Tuesday

Want me to make the change?`

/** The chat components: transcript, composer, reply parts and cards. */
export function ChatSection() {
  const [text, setText] = useState('')
  const [rating, setRating] = useState<ChatRating>(null)
  const [answer, setAnswer] = useState('')
  return (
    <Grid>
      <Specimen title="ChatConversation with messages" wide>
        <div className="flex h-80 w-full flex-col rounded-card border border-line">
          <ChatConversation>
            <ChatConversationContent>
              <ChatTimestamp at="2026-03-03T09:12:00Z" />
              <ChatMessage from="user">Can we move the review to Thursday?</ChatMessage>
              <ChatMessage from="assistant" header={<ChatThought>The person asked to move the review. Thursday afternoon is free.</ChatThought>} footer={<ChatFeedbackRow text={REPLY} rating={rating} onRate={setRating} />}>
                <ChatMarkdown>{REPLY}</ChatMarkdown>
              </ChatMessage>
              <ChatQuickReplies replies={['Yes, move it', 'Keep it']} onReply={() => {}} />
            </ChatConversationContent>
            <ChatScrollButton />
          </ChatConversation>
        </div>
      </Specimen>
      <Specimen title="ChatComposer" wide>
        <ChatComposer
          value={text}
          onValueChange={setText}
          canSend={text.trim().length > 0}
          onSubmit={() => setText('')}
          onAttach={() => {}}
          attachments={<ChatAttachmentStrip size="compact" onRemove={() => {}} items={[{ id: 'a', name: 'Agenda.pdf', kind: 'pdf', state: 'ready' }, { id: 'b', name: 'Notes.txt', kind: 'text', state: 'uploading' }]} />}
        />
      </Specimen>
      <Specimen title="ChatStatusLine, ChatTypingDots">
        <ChatStatusLine>Reading your notes</ChatStatusLine>
        <ChatTypingDots />
      </Specimen>
      <Specimen title="ChatAttachmentStrip on a sent message">
        <ChatAttachmentStrip items={[{ id: 'c', name: 'Itinerary.pdf', kind: 'pdf' }, { id: 'd', name: 'Packing list.txt', kind: 'text', state: 'failed' }]} />
      </Specimen>
      <Specimen title="ChatWelcome" wide>
        <ChatWelcome
          greeting="Hi Sam,"
          title="How can I help?"
          prompts={[
            { title: 'Plan my trip to Lisbon', icon: <Plane /> },
            { title: 'What is on this week?', icon: <CalendarDays /> },
            { title: 'Short on time today', icon: <Clock /> },
          ]}
          onPrompt={(p) => setText(p.title)}
        />
      </Specimen>
      <Specimen title="ChatChangeCard" wide>
        <ChatChangeCard
          title="Move the review, lunch on Wednesday"
          summary="3 changes · Tue 3 Mar to Wed 4 Mar"
          status="open"
          checked="Checked against your calendar: no clashes"
          days={[
            { label: 'Tue 3 Mar', rows: [{ title: 'Design sync', meta: '10:00 · 30 min', tag: 'Skipped', tone: 'skip', icon: <NotebookPen /> }] },
            { label: 'Wed 4 Mar', rows: [
              { title: 'Team review', meta: '14:00 · 1 h', tag: 'From Tue', tone: 'move', icon: <NotebookPen /> },
              { title: 'Lunch with the new hire', meta: '12:00 · 1 h', tag: 'New', tone: 'new', icon: <NotebookPen /> },
            ] },
          ]}
          onApply={() => {}}
          onDismiss={() => {}}
        />
        <ChatChangeCard title="Move the review" status="applied" days={[{ label: 'Wed 4 Mar', rows: [{ title: 'Team review', meta: '14:00', tag: 'From Tue', tone: 'move' }] }]} onUndo={() => {}} />
      </Specimen>
      <Specimen title="ChatQuestionCard" wide>
        <ChatQuestionCard
          onSubmit={setAnswer}
          questions={[
            { id: 'q1', title: 'Which days are you away?', kind: 'multi', options: ['Mon', 'Tue', 'Wed'], allowOther: true },
            { id: 'q2', title: 'Pack the tent?', kind: 'confirm', options: [], confirm: { primary: 'Yes, pack it', secondary: 'Leave it' } },
            { id: 'q3', title: 'Anything else?', kind: 'text', options: [], placeholder: 'A note for the trip' },
          ]}
        />
        {answer && <pre className="text-footnote text-ink-muted">{answer}</pre>}
      </Specimen>
      <Specimen title="ChatQuestionInput: single">
        <ChatQuestionInput question={{ id: 's', title: 'Which room?', kind: 'single', options: ['North', 'South'] }} onAnswer={() => {}} />
      </Specimen>
      <Specimen title="ChatBreakdownCard">
        <ChatBreakdownCard
          caption="This week"
          title="Time by project"
          total="14 h 20 m"
          rows={[
            { label: 'Garden', value: 420, display: '7 h' },
            { label: 'Kitchen', value: 300, display: '5 h' },
            { label: 'Reading', value: 140, display: '2 h 20 m' },
          ]}
          action={<Button variant="outline" size="compact">Open the planner</Button>}
        />
      </Specimen>
    </Grid>
  )
}
