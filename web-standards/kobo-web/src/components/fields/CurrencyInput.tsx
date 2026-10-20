'use client'

import * as React from 'react'
import { NumericFormat, type NumberFormatValues } from 'react-number-format'
import { cn } from '../../lib/cn'
import { Input } from './Input'
import {
  centsToDecimalString,
  decimalSeparatorFor,
  decimalStringToCents,
  normalizePastedAmount,
  padDecimalString,
} from './currencyText'

type InputRest = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'prefix' | 'inputMode'
>

interface CurrencyInputBaseProps extends InputRest {
  /** The number of decimals of the currency (ISO 4217 minor units): USD 2, JPY 0, KWD 3. */
  decimalDigits?: number
  /** The currency symbol before the amount. Set it for a currency that is not US dollars. */
  prefix?: string
  /** Always show every decimal: 500 shows "$5.00", not "$5". */
  fixedDecimalScale?: boolean
  /** The locale that reads a pasted amount: in "de-DE", a pasted "12,50" is 12.50. The default is the browser's. */
  locale?: string
  ref?: React.Ref<HTMLInputElement>
}

interface CentsProps extends CurrencyInputBaseProps {
  /** The amount in minor units (cents). `null` is an empty field. */
  value: number | null | undefined
  /** Fires with the amount in minor units, or `null` when the field has no number. Never 0 for empty. */
  onChange: (cents: number | null) => void
  stringValue?: never
  onStringChange?: never
  formatOnBlur?: never
}

interface StringProps extends CurrencyInputBaseProps {
  /** The plain decimal string ("1234.5"), for a form library that keeps strings. */
  stringValue: string | undefined
  onStringChange: (value: string) => void
  /** On blur, pad the value to every decimal ("123" → "123.00"). Empty text stays empty. */
  formatOnBlur?: boolean
  value?: never
  onChange?: never
}

export type CurrencyInputProps = CentsProps | StringProps

/**
 * A money field: a currency symbol, thousands commas and a decimal keypad on a phone.
 * Cents in, cents out. An empty or invalid field is `null`, never 0.
 *
 *     const [cents, setCents] = useState<number | null>(null)
 *     <CurrencyInput aria-label="Price" value={cents} onChange={setCents} />
 *     <CurrencyInput aria-label="Tip" stringValue={text} onStringChange={setText} formatOnBlur />
 */
export function CurrencyInput(props: CurrencyInputProps) {
  const {
    value,
    onChange,
    stringValue,
    onStringChange,
    formatOnBlur = false,
    decimalDigits = 2,
    prefix = '$',
    fixedDecimalScale = false,
    locale,
    placeholder = `${prefix}0${decimalDigits > 0 ? `.${'0'.repeat(decimalDigits)}` : ''}`,
    className,
    onBlur,
    onPaste,
    ref,
    ...rest
  } = props
  const centsMode = onChange !== undefined
  // The text the person typed last, with its cents. "5." and "5" are both 500 cents: keep the typed one.
  const typed = React.useRef<{ cents: number | null; text: string } | null>(null)

  const emit = (text: string) => {
    if (centsMode) {
      const cents = decimalStringToCents(text, decimalDigits)
      typed.current = { cents, text }
      onChange(cents)
    } else {
      onStringChange?.(text)
    }
  }

  let shown: string
  if (centsMode) {
    const cents = value ?? null
    shown =
      typed.current && typed.current.cents === cents
        ? typed.current.text
        : cents === null
          ? ''
          : centsToDecimalString(cents, decimalDigits, fixedDecimalScale)
  } else {
    shown = stringValue ?? ''
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    onPaste?.(event)
    if (event.defaultPrevented) return
    const input = event.currentTarget
    const wholeField = input.value === '' || (input.selectionStart === 0 && input.selectionEnd === input.value.length)
    if (!wholeField) return
    // A paste over the whole field reads the pasted text, so "12,50" from a German page is 12.50, not 1,250.
    const plain = normalizePastedAmount(event.clipboardData.getData('text'), decimalSeparatorFor(locale))
    if (plain === null) return
    event.preventDefault()
    const [whole = '', fraction] = plain.split('.')
    const clamped = fraction === undefined || decimalDigits === 0 ? whole : `${whole}.${fraction.slice(0, decimalDigits)}`
    emit(clamped.replace(/^0+(?=\d)/, ''))
  }

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    onBlur?.(event)
    if (centsMode) {
      typed.current = null
      return
    }
    if (!formatOnBlur || !stringValue || stringValue === '.') return
    const padded = padDecimalString(stringValue, decimalDigits)
    if (padded !== stringValue) onStringChange?.(padded)
  }

  return (
    <NumericFormat
      {...rest}
      getInputRef={ref}
      customInput={Input}
      value={shown}
      valueIsNumericString
      onValueChange={(values: NumberFormatValues) => emit(values.value)}
      thousandSeparator=","
      prefix={prefix}
      decimalScale={decimalDigits}
      fixedDecimalScale={fixedDecimalScale}
      allowNegative={false}
      inputMode="decimal"
      autoComplete={rest.autoComplete ?? 'off'}
      placeholder={placeholder}
      className={cn('tabular-nums', className)}
      onPaste={handlePaste}
      onBlur={handleBlur}
    />
  )
}
