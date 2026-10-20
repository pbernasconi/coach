import { describe, expect, it } from 'vitest'
import vectors from './vectors/password-strength.json'
import {
  MIN_STRENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  STRENGTH_LABELS,
  passwordMeetsRules,
  passwordState,
  scorePassword,
  validatePassword,
} from '../src/components/fields/passwordRules'

const rule = (id: string) => {
  const found = PASSWORD_RULES.find((r) => r.id === id)
  if (!found) throw new Error(`no rule ${id}`)
  return found
}

describe('password rules', () => {
  it('has the four rules with stable ids', () => {
    expect(PASSWORD_RULES.map((r) => r.id)).toEqual(['length', 'case', 'number', 'symbol'])
  })

  it.each([
    ['length', 'Aa1!aaa', false],
    ['length', 'a'.repeat(PASSWORD_MIN_LENGTH), true],
    ['case', 'alllower1!', false],
    ['case', 'ALLUPPER1!', false],
    ['case', 'MixedCase', true],
    ['number', 'abcdEfgh', false],
    ['number', 'abcdEfg1', true],
    ['symbol', 'abcdEfg1', false],
    ['symbol', 'abcdEfg1!', true],
    ['symbol', 'abcdEfg1🔑', true],
  ])('%s rule on %j is %s', (id, value, met) => {
    expect(rule(id).test(value)).toBe(met)
  })

  it('reports each rule for a weak value', () => {
    const byId = Object.fromEntries(validatePassword('password').map((s) => [s.id, s.met]))
    expect(byId).toEqual({ length: true, case: false, number: false, symbol: false })
    expect(passwordMeetsRules('Newpassword1!')).toBe(true)
  })
})

describe('password strength vectors', () => {
  it('matches the shared gate and labels', () => {
    expect(MIN_STRENGTH).toBe(vectors.minScore)
    expect([...STRENGTH_LABELS]).toEqual(vectors.labels)
  })

  it.each(vectors.cases)('$name', ({ input, score, strengthMet, valid }) => {
    expect(scorePassword(input)).toBe(score)
    const state = passwordState(input)
    expect(state.strengthMet).toBe(strengthMet)
    expect(state.valid).toBe(valid)
  })
})
