import { describe, expect, it } from 'vitest'
import { maskValue } from '../src/components/display/maskValue'

describe('maskValue', () => {
  it.each([
    ['A1B2C3D4', 4, '••C3D4'],
    ['A1B2C3D4', 2, '••D4'],
    ['K7Q2-9F4M-X3TB', 4, '••X3TB'],
    ['1234', 4, '••••'],
    ['12', 4, '••••'],
    ['', 4, '••••'],
    ['ABCDEF', 0, '••••'],
  ] as const)('%j with %i visible → %j', (value, visible, expected) => {
    expect(maskValue(value, visible)).toBe(expected)
  })

  it('never shows the whole value', () => {
    for (const value of ['a', 'ab', 'abcd', 'abcde']) expect(maskValue(value, 4)).not.toContain(value)
  })
})
