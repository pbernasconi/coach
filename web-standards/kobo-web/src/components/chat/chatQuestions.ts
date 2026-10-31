/** A question the assistant asks on a card, before it answers. */
export type ChatQuestion = {
  id: string
  title: string
  subtitle?: string | null
  /** single: pick one (a tap answers). multi: pick any, then the arrow. text: a field. confirm: two buttons and Skip. */
  kind: 'single' | 'multi' | 'text' | 'confirm'
  options: string[]
  /** Adds an "Add another…" chip that turns into a field. */
  allowOther?: boolean
  placeholder?: string | null
  confirm?: { primary: string; secondary?: string | null } | null
}

/** What the person said to each question, by id. `skip` when they skipped it. */
export type ChatAnswers = Record<string, string>

export const SKIP_ANSWER = 'skip'

/** Several picks as one answer: "Mon, Wed". Blank picks are dropped, and an empty pick list is a skip. */
export function joinPicks(picks: string[]): string {
  const clean = picks.map((p) => p.trim()).filter(Boolean)
  return clean.length ? clean.join(', ') : SKIP_ANSWER
}

/**
 * The answers as one message, a line per question in order: "Title: answer". A question without an answer is
 * skipped.
 */
export function answersText(questions: ChatQuestion[], answers: ChatAnswers): string {
  return questions.map((q) => `${q.title}: ${answers[q.id]?.trim() || SKIP_ANSWER}`).join('\n')
}

/** The question to show after answering `index`: the next unanswered one, or null when all are answered. */
export function nextQuestion(questions: ChatQuestion[], answers: ChatAnswers, index: number): number | null {
  for (let step = 1; step <= questions.length; step++) {
    const i = (index + step) % questions.length
    const q = questions[i]
    if (q && !(q.id in answers)) return i
  }
  return null
}
