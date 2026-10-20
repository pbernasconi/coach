'use client'

import * as React from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../overlays/Command'
import { Popover, PopoverContent, PopoverTrigger } from '../overlays/Popover'
import { COUNTRY_OPTIONS, getCountryOption, type CountryCode } from './countries'
import { CountryFlagIcon } from './CountryFlagIcon'
import { Input } from './Input'
import { formatNationalNumber, phoneValueFromInput, type InternationalPhoneValue } from './phoneNumber'

export interface InternationalPhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: InternationalPhoneValue
  onChange: (value: InternationalPhoneValue) => void
  /** The first words of the country button name: "Country code: Singapore +65". */
  countryLabel?: string
  searchPlaceholder?: string
  emptyText?: string
  ref?: React.Ref<HTMLInputElement>
}

/**
 * A phone number field with a country button (flag and calling code) in front. Tab goes straight to the
 * number. A pasted "+65 8123 4567" picks Singapore. Changing the country keeps the digits.
 *
 *     const [phone, setPhone] = useState(EMPTY_INTERNATIONAL_PHONE)
 *     <InternationalPhoneInput aria-label="Phone number" value={phone} onChange={setPhone} />
 */
export function InternationalPhoneInput({
  value,
  onChange,
  className,
  disabled,
  placeholder = 'Phone number',
  countryLabel = 'Country code',
  searchPlaceholder = 'Search countries',
  emptyText = 'No country found.',
  ref,
  ...props
}: InternationalPhoneInputProps) {
  const [open, setOpen] = React.useState(false)
  const selected = getCountryOption(value.country)
  const invalid = props['aria-invalid'] === true || props['aria-invalid'] === 'true'

  const pickCountry = (country: CountryCode) => {
    onChange({ country, nationalNumber: value.nationalNumber })
    setOpen(false)
  }

  // The country list is a Popover + Command in a portal, so Escape and an outside click close it, and it
  // works inside a Dialog.
  return (
    <div
      data-international-phone-input=""
      className={cn(
        'relative flex h-10 w-full rounded-control border bg-surface',
        'transition-[border-color,box-shadow] duration-(--motion-state) ease-standard',
        'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30',
        // The list is in a portal, so focus-within ends when it opens: keep the ring while it is open.
        open && 'border-ring ring-2 ring-ring/30',
        invalid ? 'border-danger-ink' : 'border-line-strong',
        disabled && 'opacity-45',
        className,
      )}
    >
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            role="combobox"
            aria-expanded={open}
            aria-label={`${countryLabel}: ${selected.name} ${selected.callingCode}`}
            disabled={disabled}
            className={cn(
              'flex h-full w-28 shrink-0 items-center justify-between gap-1 rounded-l-control border-r border-line-strong px-2',
              'text-body text-ink hover:bg-surface-raised focus-visible:outline-none disabled:pointer-events-none',
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <CountryFlagIcon country={selected.country} size="sm" />
              <span className="truncate tabular-nums">{selected.callingCode}</span>
            </span>
            <ChevronsUpDown aria-hidden="true" className="ml-auto size-3.5 text-ink-faint" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(21.25rem,calc(100vw-2rem))] p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="h-[300px]">
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {COUNTRY_OPTIONS.map((option) => (
                  <CommandItem
                    key={option.country}
                    value={`${option.name} ${option.country} ${option.callingCode}`}
                    onSelect={() => pickCountry(option.country)}
                    className="py-2.5"
                    data-country-option={option.country}
                  >
                    <CountryFlagIcon country={option.country} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{option.name}</span>
                    <span className="text-ink-muted tabular-nums">{option.callingCode}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        {...props}
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete={props.autoComplete ?? 'tel-national'}
        disabled={disabled}
        value={formatNationalNumber(value)}
        onChange={(event) => onChange(phoneValueFromInput(event.target.value, value.country))}
        placeholder={placeholder}
        className="h-full rounded-l-none border-0 bg-transparent tabular-nums focus-visible:ring-0 disabled:opacity-100"
      />
    </div>
  )
}
