'use client'

import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from '../controls/Button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../overlays/Command'
import { Popover, PopoverContent, PopoverTrigger } from '../overlays/Popover'
import { commandFilter } from '../overlays/selectSearch'
import { COUNTRY_OPTIONS, type CountryCode } from './countries'
import { CountryFlagIcon } from './CountryFlagIcon'

export interface CountryComboboxProps {
  id?: string
  /** The ISO 3166-1 alpha-2 code, in any case. */
  value?: string
  onValueChange: (value: CountryCode) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
  /** Only these countries. The default is every country. */
  countries?: readonly CountryCode[]
  'aria-invalid'?: boolean
  'aria-label'?: string
}

/**
 * A searchable country picker with flags. Typing the ISO code ("CH") finds the country first, then name
 * prefixes. A letter typed on the closed button opens the list with that letter as the search.
 *
 *     <CountryCombobox aria-label="Country" value={country} onValueChange={setCountry} />
 */
export function CountryCombobox({
  id,
  value,
  onValueChange,
  placeholder = 'Select a country',
  searchPlaceholder = 'Search countries',
  emptyText = 'No country found.',
  className,
  disabled = false,
  countries,
  'aria-invalid': ariaInvalid,
  'aria-label': ariaLabel,
}: CountryComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const options = React.useMemo(() => {
    if (!countries) return COUNTRY_OPTIONS
    const allowed = new Set(countries.map((country) => country.toUpperCase()))
    return COUNTRY_OPTIONS.filter((option) => allowed.has(option.country))
  }, [countries])

  const current = value?.toUpperCase()
  const selected = options.find((option) => option.country === current)

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (!next) setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={changeOpen} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            'w-full justify-between px-3 font-normal aria-[invalid=true]:border-danger-ink',
            !selected && 'text-ink-faint',
            className,
          )}
          onKeyDown={(event) => {
            if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey && !open) {
              event.preventDefault()
              setSearch(event.key)
              setOpen(true)
            }
          }}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
            {selected ? (
              <>
                <CountryFlagIcon country={selected.country} size="sm" />
                <span className="min-w-0 truncate">{selected.name}</span>
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown aria-hidden="true" className="ml-auto text-ink-faint" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] min-w-(--radix-popover-trigger-width) p-0" align="start">
        <Command filter={commandFilter}>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.country}
                  value={option.name}
                  keywords={[option.country]}
                  onSelect={() => {
                    onValueChange(option.country)
                    changeOpen(false)
                  }}
                  data-country-option={option.country}
                >
                  <CountryFlagIcon country={option.country} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  <span className="w-7 shrink-0 text-right text-footnote font-semibold text-ink-muted">{option.country}</span>
                  <Check aria-hidden="true" className={cn('text-brand-ink', current === option.country ? 'opacity-100' : 'opacity-0')} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
