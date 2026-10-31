'use client'

import * as React from 'react'
import { ArrowUp, Check, Plus } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button, focusRing } from '../controls/Button'
import { joinPicks, type ChatQuestion } from './chatQuestions'

const chip = (on: boolean) =>
  cn(
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-subhead transition-colors duration-(--motion-state) ease-standard',
    on ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line-strong bg-surface text-ink hover:bg-surface-raised',
    focusRing,
  )

const roundArrow = cn('inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand disabled:bg-surface-raised disabled:text-ink-faint', focusRing)

/** A one-line field with a round send arrow, for a text question or an "Add another…" pick. */
function AnswerField({ placeholder, onSubmit, initial = '' }: { placeholder: string; onSubmit: (text: string) => void; initial?: string }) {
  const [text, setText] = React.useState(initial)
  return (
    <form
      className="flex items-center gap-2 rounded-control border border-line bg-surface py-1 pr-1 pl-3 focus-within:border-line-strong"
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim()) onSubmit(text.trim())
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-faint"
      />
      <button type="submit" aria-label="Send answer" disabled={!text.trim()} className={roundArrow}>
        <ArrowUp aria-hidden="true" className="size-4" />
      </button>
    </form>
  )
}

/**
 * The controls of one question card: chips for a choice (with "Add another…"), a field for a text question, or the
 * two buttons of a confirm. `onAnswer` gets the answer as words.
 */
export function ChatQuestionInput({ question, onAnswer, disabled = false }: { question: ChatQuestion; onAnswer: (answer: string) => void; disabled?: boolean }) {
  const [picked, setPicked] = React.useState<string[]>([])
  const [other, setOther] = React.useState(false)

  if (question.kind === 'text') {
    return <AnswerField placeholder={question.placeholder || 'Type your answer'} onSubmit={onAnswer} />
  }
  if (question.kind === 'confirm') {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="compact" disabled={disabled} onClick={() => onAnswer(question.confirm?.primary ?? 'Yes')}>
          {question.confirm?.primary ?? 'Yes'}
        </Button>
        {question.confirm?.secondary && (
          <Button size="compact" variant="outline" disabled={disabled} onClick={() => onAnswer(question.confirm?.secondary ?? '')}>
            {question.confirm.secondary}
          </Button>
        )}
      </div>
    )
  }
  const multi = question.kind === 'multi'
  const toggle = (option: string) => {
    if (!multi) return onAnswer(option)
    setPicked((now) => (now.includes(option) ? now.filter((p) => p !== option) : [...now, option]))
  }
  const extra = picked.filter((p) => !question.options.includes(p))
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2" role="group" aria-label={question.title}>
        {[...question.options, ...extra].map((option) => {
          const on = picked.includes(option)
          return (
            <button key={option} type="button" disabled={disabled} aria-pressed={multi ? on : undefined} onClick={() => toggle(option)} className={chip(on)}>
              {on && <Check aria-hidden="true" className="size-3.5" />}
              {option}
            </button>
          )
        })}
        {question.allowOther && !other && (
          <button type="button" onClick={() => setOther(true)} className={chip(false)}>
            <Plus aria-hidden="true" className="size-3.5" />
            Add another…
          </button>
        )}
      </div>
      {other && (
        <AnswerField
          placeholder="Add another…"
          onSubmit={(text) => {
            setOther(false)
            if (multi) setPicked((now) => (now.includes(text) ? now : [...now, text]))
            else onAnswer(text)
          }}
        />
      )}
      {multi && (
        <div className="flex items-center justify-end gap-3">
          <span className="text-footnote text-ink-muted">{picked.length} selected</span>
          <button type="button" aria-label="Send answer" disabled={!picked.length || disabled} onClick={() => onAnswer(joinPicks(picked))} className={roundArrow}>
            <ArrowUp aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
