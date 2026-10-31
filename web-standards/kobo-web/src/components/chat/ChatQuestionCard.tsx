'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'
import { ChatQuestionInput } from './ChatQuestionInput'
import { SKIP_ANSWER, answersText, nextQuestion, type ChatAnswers, type ChatQuestion } from './chatQuestions'

export interface ChatQuestionCardProps {
  questions: ChatQuestion[]
  /** All answered (or skipped): the answers as one message, a line per question ("Title: answer"). */
  onSubmit: (text: string) => void
  disabled?: boolean
  className?: string
}

const pagerArrow = cn('inline-flex size-6 items-center justify-center rounded-badge text-ink-muted hover:text-ink disabled:opacity-30', focusRing)

/**
 * The assistant's questions before it answers, one card at a time with "1 of N": a choice (chips), several picks, a
 * text field, or a confirm with two buttons. Every question can be skipped. When the last one is answered the
 * answers go back as one message.
 *
 *     <ChatQuestionCard questions={reply.questions} onSubmit={send} />
 */
export function ChatQuestionCard({ questions, onSubmit, disabled = false, className }: ChatQuestionCardProps) {
  const [index, setIndex] = React.useState(0)
  const [answers, setAnswers] = React.useState<ChatAnswers>({})
  const question = questions[index]
  if (!question) return null

  const answer = (text: string) => {
    const next = { ...answers, [question.id]: text }
    setAnswers(next)
    const to = nextQuestion(questions, next, index)
    if (to === null) onSubmit(answersText(questions, next))
    else setIndex(to)
  }

  return (
    <section aria-label="Questions" className={cn('w-full rounded-card border border-line bg-surface p-4', className)}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-headline text-ink">{question.title}</h3>
          {question.subtitle && <p className="text-footnote text-ink-muted">{question.subtitle}</p>}
        </div>
        {questions.length > 1 && (
          <div className="flex items-center gap-0.5 text-footnote text-ink-muted">
            <button type="button" aria-label="Previous question" disabled={index === 0} onClick={() => setIndex(index - 1)} className={pagerArrow}>
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <span>{index + 1} of {questions.length}</span>
            <button type="button" aria-label="Next question" disabled={index === questions.length - 1} onClick={() => setIndex(index + 1)} className={pagerArrow}>
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        )}
      </div>
      <div className="mt-3">
        <ChatQuestionInput key={question.id} question={question} onAnswer={answer} disabled={disabled} />
      </div>
      <div className="mt-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => answer(SKIP_ANSWER)}
          className={cn('rounded-badge text-footnote text-ink-muted underline underline-offset-2 hover:text-ink', focusRing)}
        >
          Skip
        </button>
      </div>
    </section>
  )
}
