/**
 * Pure date helpers for `DateTextInput`, `DatePicker` and `Calendar`. The cases are
 * tests/vectors/date-picker-field.json.
 *
 * A date is an ISO calendar day string, `yyyy-MM-dd`. A JS `Date` is only made at local midnight, for
 * react-day-picker, so a day never moves across time zones.
 */

export type IsoDate = string

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** The ISO day of a year, month (1–12) and day, or null when that day does not exist (Feb 30). */
export function isoFromParts(year: number, month: number, day: number): IsoDate | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) return null
  if (day > daysInMonth(year, month)) return null
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

/** The year, month and day of an ISO day, or null when the text is not a real `yyyy-MM-dd` day. */
export function parseIsoDate(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  return isoFromParts(year, month, day) ? { year, month, day } : null
}

/** A JS `Date` at local midnight, for react-day-picker. Empty or invalid text gives undefined. */
export function isoToDate(iso: string | undefined): Date | undefined {
  const parts = iso ? parseIsoDate(iso) : null
  return parts ? new Date(parts.year, parts.month - 1, parts.day) : undefined
}

/** The ISO day of a JS `Date`, read in local time. */
export function dateToIso(date: Date): IsoDate {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Today as an ISO day, in local time. */
export function todayIso(now: Date = new Date()): IsoDate {
  return dateToIso(now)
}

/** The ISO day `days` after (or before) a day. */
export function addDays(iso: IsoDate, days: number): IsoDate {
  const date = isoToDate(iso)
  if (!date) return iso
  date.setDate(date.getDate() + days)
  return dateToIso(date)
}

/** The ISO weekday: 1 is Monday, 7 is Sunday. */
export function isoWeekday(iso: IsoDate): number {
  const day = isoToDate(iso)?.getDay() ?? 0
  return day === 0 ? 7 : day
}

/** "Jul 15, 2026". */
export function formatMediumDate(iso: IsoDate): string {
  const parts = parseIsoDate(iso)
  return parts ? `${SHORT_MONTHS[parts.month - 1]} ${parts.day}, ${parts.year}` : ''
}

/** "Jul 15". */
export function formatShortDate(iso: IsoDate): string {
  const parts = parseIsoDate(iso)
  return parts ? `${SHORT_MONTHS[parts.month - 1]} ${parts.day}` : ''
}

/** The MM/DD/YYYY mask over up to eight digits: "0314" → "03/14". Other characters are dropped. */
export function maskDateDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/** "03/14/1971" from "1971-03-14"; "" from an empty or invalid day. */
export function isoToMaskText(iso: string | null | undefined): string {
  const parts = iso ? parseIsoDate(iso) : null
  return parts ? `${pad(parts.month)}/${pad(parts.day)}/${pad(parts.year, 4)}` : ''
}

/** A two-digit year: 61–99 are 1961–1999, 00–60 are 2000–2060. */
function fullYear(year: string): number {
  const value = Number(year)
  return year.length === 2 ? (value > 60 ? 1900 + value : 2000 + value) : value
}

/**
 * The ISO day of a date in a common written form, or null: "2026-07-24", "3/4/1971", "3/4/71" (only when the
 * month or the day has one digit, so a half-typed "12/25/19" stays as it is), "Jul 24, 2026", "July 24 2026".
 */
export function parseWrittenDate(raw: string): IsoDate | null {
  const text = raw.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (iso) return isoFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/.exec(text)
  if (us) {
    const [, month = '', day = '', year = ''] = us
    if (year.length === 2 && month.length === 2 && day.length === 2) return null
    return isoFromParts(fullYear(year), Number(month), Number(day))
  }
  const named = /^([a-z]+)\.? (\d{1,2}),? (\d{4})$/i.exec(text)
  if (named) {
    const name = (named[1] ?? '').toLowerCase()
    const month = MONTHS.findIndex((full) => full === name || (name.length >= 3 && full.startsWith(name))) + 1
    return month > 0 ? isoFromParts(Number(named[3]), month, Number(named[2])) : null
  }
  return null
}

/** The field text for typed or pasted text: a written date becomes MM/DD/YYYY, anything else is masked digits. */
export function normalizeDateText(raw: string): string {
  const written = parseWrittenDate(raw)
  return written ? isoToMaskText(written) : maskDateDigits(raw)
}

export type DateTextStatus = 'EMPTY' | 'INCOMPLETE' | 'INVALID' | 'BEFORE_MIN' | 'AFTER_MAX' | 'UNAVAILABLE' | 'VALID'

export interface DateBounds {
  /** The first day that can be picked, inclusive. */
  min?: IsoDate
  /** The last day that can be picked, inclusive. */
  max?: IsoDate
  /** True for a day that is inside the bounds but cannot be picked (a weekend). */
  isUnavailable?: (iso: IsoDate) => boolean
}

export interface DateMessages {
  invalid: string
  beforeMin: string
  afterMax: string
  unavailable: string
}

export const DEFAULT_DATE_MESSAGES: DateMessages = {
  invalid: 'Please enter a valid date',
  beforeMin: 'That date has already passed',
  afterMax: 'That date is too far in the future',
  unavailable: 'That date is not available',
}

export interface DateTextResult {
  status: DateTextStatus
  /** The ISO day, when the text is a full real date (in or out of bounds). */
  date?: IsoDate
  /** The error to show, or null when there is none yet (empty, half typed, valid). */
  message: string | null
}

/** Checks the text of a date field (MM/DD/YYYY) against the bounds. */
export function evaluateDateText(
  text: string,
  bounds: DateBounds = {},
  messages: DateMessages = DEFAULT_DATE_MESSAGES,
): DateTextResult {
  const digits = text.replace(/\D/g, '')
  if (!digits) return { status: 'EMPTY', message: null }
  if (digits.length < 8) return { status: 'INCOMPLETE', message: null }
  const date = isoFromParts(Number(digits.slice(4, 8)), Number(digits.slice(0, 2)), Number(digits.slice(2, 4)))
  if (!date) return { status: 'INVALID', message: messages.invalid }
  if (bounds.min && date < bounds.min) return { status: 'BEFORE_MIN', date, message: messages.beforeMin }
  if (bounds.max && date > bounds.max) return { status: 'AFTER_MAX', date, message: messages.afterMax }
  if (bounds.isUnavailable?.(date)) return { status: 'UNAVAILABLE', date, message: messages.unavailable }
  return { status: 'VALID', date, message: null }
}

/** True when a day is inside the bounds and available. */
export function isSelectableDate(iso: IsoDate, bounds: DateBounds = {}): boolean {
  return evaluateDateText(isoToMaskText(iso), bounds).status === 'VALID'
}

export interface QuickDateChip {
  label: string
  value: IsoDate
}

export interface QuickDateLabels {
  today: string
  tomorrow: string
  /** The label of the first day that can be picked, when it is after tomorrow. */
  earliest: (shortDate: string) => string
}

const DEFAULT_QUICK_LABELS: QuickDateLabels = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  earliest: (shortDate) => `Earliest — ${shortDate}`,
}

/**
 * The shortcut chips under a calendar: Today and Tomorrow when they can be picked. When neither can and the
 * first day is later, one "Earliest — Sep 3" chip. A chip is never a day that cannot be picked.
 */
export function quickDateChips(
  today: IsoDate,
  bounds: DateBounds = {},
  labels: QuickDateLabels = DEFAULT_QUICK_LABELS,
): QuickDateChip[] {
  const tomorrow = addDays(today, 1)
  const chips = [
    { label: labels.today, value: today },
    { label: labels.tomorrow, value: tomorrow },
  ].filter((chip) => isSelectableDate(chip.value, bounds))
  if (chips.length > 0) return chips
  if (bounds.min && bounds.min > tomorrow && isSelectableDate(bounds.min, bounds)) {
    return [{ label: labels.earliest(formatShortDate(bounds.min)), value: bounds.min }]
  }
  return []
}
