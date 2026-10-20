import { describe, expect, it } from 'vitest'
import { getAvatarColor, getInitials } from '../src/components/display/avatarInitials'

describe('getInitials', () => {
  it.each([
    ['Ada Park', 'AP'],
    ['Ada Lovelace King', 'AL'],
    ['tamsin', 'T'],
    ['  rina   oduya ', 'RO'],
    ['', '?'],
    ['   ', '?'],
  ])('%j → %j', (name, expected) => {
    expect(getInitials(name)).toBe(expected)
  })
})

describe('getAvatarColor', () => {
  it('gives the same tint for the same seed', () => {
    expect(getAvatarColor('ada')).toBe(getAvatarColor('ada'))
  })

  it('gives a tint for an empty seed', () => {
    expect(getAvatarColor('')).not.toBe('')
  })
})
