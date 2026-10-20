import { cn } from '../../lib/cn'
import {
  formatMoney,
  formatMoneyHidden,
  formatMoneyLabel,
  formatSignedMoney,
  MONEY_HIDDEN_LABEL,
} from '../../lib/format/money'

export interface MoneyDisplayProps {
  /** Integer cents. `null` means the viewer may not see it: it shows "$••••", never $0.00. */
  cents: number | null
  currency?: string
  /** Show a "+" on gains and colour the sign: for a change, not for a total. */
  signed?: boolean
  className?: string
}

/**
 * One amount of money, with tabular digits and a spoken label ("negative 45 dollars and 99 cents").
 *
 *     <MoneyDisplay cents={129900} />            $1,299.00
 *     <MoneyDisplay cents={-852} signed />       −$8.52 (danger ink)
 *     <MoneyDisplay cents={null} />              $••••
 */
export function MoneyDisplay({ cents, currency = 'USD', signed = false, className }: MoneyDisplayProps) {
  if (cents === null) {
    return (
      <span role="img" aria-label={MONEY_HIDDEN_LABEL} className={cn('tabular-nums text-ink-muted', className)}>
        {formatMoneyHidden(currency)}
      </span>
    )
  }
  const tone = signed && cents > 0 ? 'text-success-ink' : signed && cents < 0 ? 'text-danger-ink' : undefined
  return (
    <span role="img" aria-label={formatMoneyLabel(cents, currency)} className={cn('tabular-nums', tone, className)}>
      {signed ? formatSignedMoney(cents, currency) : formatMoney(cents, currency)}
    </span>
  )
}
