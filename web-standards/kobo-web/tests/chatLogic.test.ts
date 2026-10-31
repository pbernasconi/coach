import { describe, expect, it } from 'vitest'
import { barFractions } from '../src/components/chat/breakdownBars'
import { applyLabel, changeStatusPill } from '../src/components/chat/changeCard'
import { answersText, joinPicks, nextQuestion, type ChatQuestion } from '../src/components/chat/chatQuestions'
import { farFromBottom } from '../src/components/chat/chatScroll'
import { timestampIndexes, timestampLabel } from '../src/components/chat/chatTimestamps'
import { acceptedFiles, canSend, composerKeyAction } from '../src/components/chat/composerRules'
import { createEventStreamParser } from '../src/components/chat/serverSentEvents'

const q = (id: string, title: string): ChatQuestion => ({ id, title, kind: 'text', options: [] })

describe('composer rules', () => {
  it('sends on Enter, not Shift-Enter or while composing', () => {
    expect(composerKeyAction({ key: 'Enter' })).toBe('send')
    expect(composerKeyAction({ key: 'Enter', shiftKey: true })).toBeNull()
    expect(composerKeyAction({ key: 'Enter', isComposing: true })).toBeNull()
    expect(composerKeyAction({ key: 'a' })).toBeNull()
  })
  it('is ready with words or a finished file, never while busy or uploading', () => {
    expect(canSend('hi', [], false)).toBe(true)
    expect(canSend('  ', [], false)).toBe(false)
    expect(canSend('', [{ state: 'ready' }], false)).toBe(true)
    expect(canSend('hi', [{ state: 'uploading' }], false)).toBe(false)
    expect(canSend('', [{ state: 'failed' }], false)).toBe(false)
    expect(canSend('hi', [], true)).toBe(false)
  })
  it('keeps the files the accept list takes, up to the limit', () => {
    const files = [
      { name: 'a.jpg', type: 'image/jpeg' },
      { name: 'b.pdf', type: 'application/pdf' },
      { name: 'c.zip', type: 'application/zip' },
      { name: 'd.md', type: '' },
    ]
    expect(acceptedFiles(files, 'image/*,application/pdf,.md', 6).map((f) => f.name)).toEqual(['a.jpg', 'b.pdf', 'd.md'])
    expect(acceptedFiles(files, 'image/*,application/pdf,.md', 1).map((f) => f.name)).toEqual(['a.jpg'])
    expect(acceptedFiles(files, '', 6)).toHaveLength(4)
  })
})

describe('question answers', () => {
  it('writes a line per question, skipped ones as skip', () => {
    expect(answersText([q('a', 'Where'), q('b', 'When')], { a: 'Lisbon' })).toBe('Where: Lisbon\nWhen: skip')
  })
  it('joins picks, and no picks is a skip', () => {
    expect(joinPicks(['Mon', ' Wed '])).toBe('Mon, Wed')
    expect(joinPicks([])).toBe('skip')
  })
  it('goes to the next unanswered question, wrapping, then null', () => {
    const qs = [q('a', 'A'), q('b', 'B'), q('c', 'C')]
    expect(nextQuestion(qs, { a: 'x' }, 0)).toBe(1)
    expect(nextQuestion(qs, { c: 'x' }, 2)).toBe(0)
    expect(nextQuestion(qs, { a: 'x', b: 'y', c: 'z' }, 1)).toBeNull()
  })
})

describe('change card words', () => {
  it('counts the rows for Apply', () => {
    expect(applyLabel([{ label: 'Tue', rows: [{ title: 'A' }] }])).toBe('Apply')
    expect(applyLabel([{ label: 'Tue', rows: [{ title: 'A' }] }, { label: 'Wed', rows: [{ title: 'B' }, { title: 'C' }] }])).toBe('Apply 3 changes')
    expect(applyLabel([{ label: 'Tue', rows: [{ title: 'A' }] }], 2)).toBe('Apply 2 changes')
  })
  it('has a pill for every decided status', () => {
    expect(changeStatusPill('open')).toBeNull()
    expect(changeStatusPill('applied')).toEqual({ label: 'Applied', tone: 'success' })
    expect(changeStatusPill('stale')?.label).toBe('Out of date')
  })
})

describe('chat scroll and bars', () => {
  it('is far from the bottom past 1.5 screens', () => {
    expect(farFromBottom({ scrollTop: 0, scrollHeight: 1000, clientHeight: 300 })).toBe(true)
    expect(farFromBottom({ scrollTop: 500, scrollHeight: 1000, clientHeight: 300 })).toBe(false)
    expect(farFromBottom({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 })).toBe(false)
  })
  it('scales bars to the biggest value', () => {
    expect(barFractions([50, 100, -3, Number.NaN])).toEqual([0.5, 1, 0, 0])
    expect(barFractions([0, 0])).toEqual([0, 0])
  })
})

describe('timestamps', () => {
  it('marks the first message, gaps of an hour and new days', () => {
    const t = ['2026-03-03T09:00:00', '2026-03-03T09:20:00', null, '2026-03-03T10:30:00', '2026-03-04T08:00:00']
    expect([...timestampIndexes(t)]).toEqual([0, 3, 4])
  })
  it('says today, yesterday, a weekday, then a date', () => {
    const now = new Date('2026-03-10T12:00:00')
    expect(timestampLabel('2026-03-10T09:05:00', now)).toBe('Today 09:05')
    expect(timestampLabel('2026-03-09T18:20:00', now)).toBe('Yesterday 18:20')
    expect(timestampLabel('2026-03-06T18:20:00', now)).toBe('Friday 18:20')
    expect(timestampLabel('2026-02-26T11:33:00', now)).toBe('Feb 26 at 11:33')
  })
})

describe('event stream parser', () => {
  it('reads events split across chunks and skips comments', () => {
    const parse = createEventStreamParser()
    expect(parse(': padding\n\nevent: text\ndata: {"del')).toEqual([])
    expect(parse('ta":"Hi"}\n\nevent: done\r\ndata: {}\r\n\r\ndata: plain\n\n')).toEqual([
      { event: 'text', data: '{"delta":"Hi"}' },
      { event: 'done', data: '{}' },
      { event: 'message', data: 'plain' },
    ])
  })
})
