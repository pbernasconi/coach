import { describe, expect, it } from 'vitest'
import { isAtLimit, isNearLimit } from '../src/components/fields/characterLimit'

describe('character limit rules', () => {
  it.each([
    [79, 80, false],
    [80, 80, true],
    [81, 80, true],
  ])('isAtLimit(%i, %i) is %s', (length, max, expected) => {
    expect(isAtLimit(length, max)).toBe(expected)
  })

  it.each([
    [0, 400, false],
    [31, 40, false],
    [32, 40, true],
    [40, 40, true],
  ])('isNearLimit(%i, %i) is %s', (length, max, expected) => {
    expect(isNearLimit(length, max)).toBe(expected)
  })
})
