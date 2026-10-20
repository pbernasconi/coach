import { describe, expect, it } from 'vitest'
import vectors from './vectors/email-chips.json'
import { addEmailChips, isEmailShape, type EmailChipsParseResult } from '../src/components/fields/emailChips'

describe('isEmailShape', () => {
  it.each(['ana@harbor.example', 'first.last+tag@sub.domain.co', 'A@B.IO'])('accepts %s', (value) => {
    expect(isEmailShape(value)).toBe(true)
  })

  it.each(['', 'ana', 'ana@', '@harbor.example', 'ana@harbor', 'a n@harbor.example', 'ana@@harbor.example', 'ana@harbor.'])(
    'rejects %j',
    (value) => {
      expect(isEmailShape(value)).toBe(false)
    },
  )
})

describe('addEmailChips', () => {
  it('adds a list split on commas, semicolons and spaces', () => {
    expect(addEmailChips([], 'a@x.io, b@x.io;c@x.io  d@x.io', 5)).toEqual({
      next: ['a@x.io', 'b@x.io', 'c@x.io', 'd@x.io'],
      rejected: [],
    })
  })

  it('adds the valid values and reports every invalid one', () => {
    expect(addEmailChips([], 'nope, a@x.io', 5)).toEqual({ next: ['a@x.io'], rejected: [{ value: 'nope', reason: 'INVALID' }] })
  })

  const cases = vectors.cases as Array<EmailChipsParseResult & { current: string[]; raw: string; maxCount: number }>
  it.each(cases)('vector: $raw onto $current (max $maxCount)', ({ current, raw, maxCount, next, rejected }) => {
    expect(addEmailChips(current, raw, maxCount)).toEqual({ next, rejected })
  })
})
