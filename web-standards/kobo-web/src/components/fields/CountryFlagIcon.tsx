import * as React from 'react'
import { cn } from '../../lib/cn'
import { flagEmoji, getCountryOption, type CountryCode } from './countries'

const SIZE_CLASS = {
  sm: 'size-4 text-body',
  md: 'size-5 text-headline',
  lg: 'size-6 text-title2',
} as const

export interface CountryFlagIconProps extends React.ComponentProps<'span'> {
  /** The ISO 3166-1 alpha-2 code ("US"). */
  country: CountryCode
  /** A flag next to the country name is decoration (the default). Set false to make the flag speak. */
  decorative?: boolean
  /** The spoken name when the flag is not decorative. The default is "{Country} flag". */
  label?: string
  size?: keyof typeof SIZE_CLASS
}

/**
 * The flag of a country as an emoji in a fixed box. Decorative by default: put the name next to it.
 *
 *     <CountryFlagIcon country="SG" />  <CountryFlagIcon country="SG" decorative={false} />
 */
export function CountryFlagIcon({ country, decorative = true, label, size = 'md', className, ...props }: CountryFlagIconProps) {
  const code = country.toUpperCase()
  return (
    <span
      {...props}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : (label ?? `${getCountryOption(code).name} flag`)}
      data-country={code}
      data-country-flag=""
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-badge leading-none',
        SIZE_CLASS[size],
        className,
      )}
    >
      {flagEmoji(code)}
    </span>
  )
}
