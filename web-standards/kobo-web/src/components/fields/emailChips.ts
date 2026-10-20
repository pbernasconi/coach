/** Why one typed or pasted value did not become a chip. */
export type EmailChipRejection = 'INVALID' | 'DUPLICATE' | 'TOO_MANY'

/** The words for each rejection. */
export type EmailChipMessages = Record<EmailChipRejection, string>

/** The default words for each rejection. A caller can pass its own. */
export const DEFAULT_EMAIL_CHIP_MESSAGES: EmailChipMessages = {
  INVALID: 'Enter a full email address, like name@example.com.',
  DUPLICATE: 'This email address is already in the list.',
  TOO_MANY: 'The list is full. Remove an address to add another.',
}

const LOCAL_PART = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]{1,64}$/
const DOMAIN_LABEL = /^[a-z0-9-]{1,63}$/
const TOP_LEVEL_LABEL = /^[a-z]{2,63}$/

/**
 * The address rule: a dot-atom local part (no leading, trailing or double dot, at most 64 characters), one `@`,
 * and a domain of letter, digit and hyphen labels (no label starts or ends with a hyphen) with a top-level label of
 * 2 or more letters. At most 254 characters. Compared lowercased.
 */
export function isEmailShape(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  if (normalized.length > 254) return false
  const parts = normalized.split('@')
  if (parts.length !== 2) return false
  const [local = '', domain = ''] = parts
  if (!LOCAL_PART.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false
  const labels = domain.split('.')
  if (labels.length < 2) return false
  const validLabel = (label: string) => DOMAIN_LABEL.test(label) && !label.startsWith('-') && !label.endsWith('-')
  return labels.every(validLabel) && TOP_LEVEL_LABEL.test(labels[labels.length - 1] ?? '')
}

/** Splits pasted text on commas, semicolons and white space. */
export function splitEmailList(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/** True when pasted text holds a separator, so it is a list and not one address. */
export function hasEmailSeparator(text: string): boolean {
  return /[\s,;]/.test(text)
}

export interface EmailChipsParseResult {
  /** The chips after the add, in order. */
  next: string[]
  /** Every value that did not become a chip, in order, with its reason. They stay in the input to fix. */
  rejected: Array<{ value: string; reason: EmailChipRejection }>
}

/**
 * Adds the addresses in `raw` to `current`. Duplicates compare without case, also inside one paste.
 * Adding stops at `maxCount`. Every value that does not fit is TOO_MANY.
 */
export function addEmailChips(current: readonly string[], raw: string, maxCount: number): EmailChipsParseResult {
  const next = [...current]
  const rejected: EmailChipsParseResult['rejected'] = []
  for (const value of splitEmailList(raw)) {
    const reason: EmailChipRejection | null = !isEmailShape(value)
      ? 'INVALID'
      : next.some((chip) => chip.toLowerCase() === value.toLowerCase())
        ? 'DUPLICATE'
        : next.length >= maxCount
          ? 'TOO_MANY'
          : null
    if (reason) {
      rejected.push({ value, reason })
      continue
    }
    next.push(value)
  }
  return { next, rejected }
}
