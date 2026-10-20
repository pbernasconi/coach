import { ZxcvbnFactory } from '@zxcvbn-ts/core'
import { adjacencyGraphs, dictionary as commonDictionary } from '@zxcvbn-ts/language-common'
import { dictionary as enDictionary, translations } from '@zxcvbn-ts/language-en'

/** One composition rule of a password. */
export interface PasswordRule {
  id: string
  /** Positive words for the checklist ("At least 8 characters"). */
  label: string
  test: (value: string) => boolean
}

/** One rule with its pass state, for the live checklist. */
export interface PasswordRuleState {
  id: string
  label: string
  met: boolean
}

export const PASSWORD_MIN_LENGTH = 8

/** The default rules: length, mixed case, a number and a symbol. */
export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (value) => value.length >= PASSWORD_MIN_LENGTH },
  { id: 'case', label: 'Upper & lowercase letters', test: (value) => /[a-z]/.test(value) && /[A-Z]/.test(value) },
  { id: 'number', label: 'At least one number', test: (value) => /\d/.test(value) },
  { id: 'symbol', label: 'At least one symbol', test: (value) => /[^A-Za-z0-9]/.test(value) },
]

/** The meter words for each zxcvbn score (0 to 4). */
export const STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'] as const

/** The lowest zxcvbn score that passes the strength gate. */
export const MIN_STRENGTH = 2

/** The meter tone for each score. Score 0 is danger, but the rule rows never turn red. */
export const STRENGTH_TONES = ['danger', 'warning', 'warning', 'info', 'success'] as const

/** Pass or fail for each rule. */
export function validatePassword(value: string, rules: readonly PasswordRule[] = PASSWORD_RULES): PasswordRuleState[] {
  return rules.map((rule) => ({ id: rule.id, label: rule.label, met: rule.test(value) }))
}

/** True when every composition rule passes. The strength gate is separate. */
export function passwordMeetsRules(value: string, rules: readonly PasswordRule[] = PASSWORD_RULES): boolean {
  return rules.every((rule) => rule.test(value))
}

// The scorer is built on the first call, not at import, so a page that never scores a password does no work.
let scorer: ZxcvbnFactory | null = null

/** The zxcvbn score (0 to 4) of a password. An empty password is 0 without zxcvbn. */
export function scorePassword(value: string): number {
  if (value.length === 0) return 0
  scorer ??= new ZxcvbnFactory({
    dictionary: { ...commonDictionary, ...enDictionary },
    graphs: adjacencyGraphs,
    translations,
  })
  return scorer.check(value).score
}

/** The full state of a password: each rule, the score and the gates. */
export interface PasswordState {
  rules: PasswordRuleState[]
  score: number
  strengthMet: boolean
  valid: boolean
  /** Rules met, plus one when the strength gate passes. */
  metCount: number
  /** The rules, plus one for the strength gate. */
  totalCount: number
}

/** Checks a password against the rules and the strength gate. */
export function passwordState(
  value: string,
  rules: readonly PasswordRule[] = PASSWORD_RULES,
  minStrength: number = MIN_STRENGTH,
): PasswordState {
  const ruleStates = validatePassword(value, rules)
  const score = scorePassword(value)
  const strengthMet = value.length > 0 && score >= minStrength
  const valid = ruleStates.every((rule) => rule.met) && strengthMet
  const metCount = ruleStates.filter((rule) => rule.met).length + (strengthMet ? 1 : 0)
  return { rules: ruleStates, score, strengthMet, valid, metCount, totalCount: ruleStates.length + 1 }
}
