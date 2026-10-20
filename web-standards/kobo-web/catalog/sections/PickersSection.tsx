import { useState } from 'react'
import { FileText, Map, StickyNote } from 'lucide-react'
import { Button } from '../../src/components/controls/Button'
import { Calendar } from '../../src/components/fields/Calendar'
import { CountryCombobox } from '../../src/components/fields/CountryCombobox'
import { CountryFlagIcon } from '../../src/components/fields/CountryFlagIcon'
import { CurrencyInput } from '../../src/components/fields/CurrencyInput'
import { DatePicker } from '../../src/components/fields/DatePicker'
import { DateTextInput } from '../../src/components/fields/DateTextInput'
import { addDays, formatMediumDate, isoToDate, quickDateChips, todayIso } from '../../src/components/fields/dateText'
import { Field, FieldDescription, FieldLabel } from '../../src/components/fields/Field'
import { FileDropzone } from '../../src/components/fields/FileDropzone'
import { InternationalPhoneInput } from '../../src/components/fields/InternationalPhoneInput'
import { EMPTY_INTERNATIONAL_PHONE, toE164 } from '../../src/components/fields/phoneNumber'
import { formatMoney } from '../../src/lib/format/money'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '../../src/components/overlays/Command'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '../../src/components/overlays/Popover'
import { Grid, Specimen } from './Specimen'

function NoteCommands({ onPick }: { onPick: (value: string) => void }) {
  return (
    <>
      <CommandInput placeholder="Search notes and actions" />
      <CommandList>
        <CommandEmpty>No notes found.</CommandEmpty>
        <CommandGroup heading="Notes">
          <CommandItem onSelect={onPick}>
            <StickyNote aria-hidden="true" /> Trip to Lisbon
          </CommandItem>
          <CommandItem onSelect={onPick}>
            <Map aria-hidden="true" /> Garden plan
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={onPick}>
            <FileText aria-hidden="true" /> New note <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </>
  )
}

/** Popover, Command, money, date, phone, country and file pickers. */
export function PickersSection() {
  const today = todayIso()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [picked, setPicked] = useState('')
  const [price, setPrice] = useState<number | null>(129900)
  const [tip, setTip] = useState('')
  const [start, setStart] = useState('')
  const [birthday, setBirthday] = useState('1990-04-12')
  const [dateError, setDateError] = useState<string | null>(null)
  const [day, setDay] = useState<Date | undefined>(isoToDate(addDays(today, 2)))
  const [phone, setPhone] = useState(EMPTY_INTERNATIONAL_PHONE)
  const [country, setCountry] = useState<string | undefined>('CH')
  const [file, setFile] = useState<File | null>(null)

  return (
    <Grid>
      <Specimen title="Popover">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Sharing</Button>
          </PopoverTrigger>
          <PopoverContent align="start">
            <p className="text-headline text-ink">Shared with 3 people</p>
            <p className="mt-1 text-body text-ink-muted">Ada Park, Ben Ortiz and Chloe Lam can edit this note.</p>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverAnchor asChild>
            <span className="text-body text-ink-muted">Anchored to this text</span>
          </PopoverAnchor>
          <PopoverTrigger asChild>
            <Button variant="plain" size="compact">
              Open
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56">The panel lines up with the anchor, not the button.</PopoverContent>
        </Popover>
      </Specimen>
      <Specimen title="Command and CommandDialog">
        <div className="flex w-full flex-col gap-3">
          <Command className="border border-line">
            <NoteCommands onPick={setPicked} />
          </Command>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => setPaletteOpen(true)}>
              Open the command menu
            </Button>
            {picked && <span className="text-body text-ink-muted">Picked: {picked}</span>}
          </div>
          <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen} title="Search notes">
            <NoteCommands
              onPick={(value) => {
                setPicked(value)
                setPaletteOpen(false)
              }}
            />
          </CommandDialog>
        </div>
      </Specimen>
      <Specimen title="CurrencyInput">
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="catalog-price">Price</FieldLabel>
            <CurrencyInput id="catalog-price" value={price} onChange={setPrice} fixedDecimalScale />
            <FieldDescription>{price === null ? 'No amount' : `${formatMoney(price)} (${price} cents)`}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="catalog-tip">Tip (string mode)</FieldLabel>
            <CurrencyInput id="catalog-tip" stringValue={tip} onStringChange={setTip} formatOnBlur />
            <FieldDescription>Pads to two decimals when you leave the field.</FieldDescription>
          </Field>
        </div>
      </Specimen>
      <Specimen title="DateTextInput">
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="catalog-start">Trip start</FieldLabel>
            <DateTextInput
              id="catalog-start"
              aria-label="Trip start"
              value={start}
              onChange={setStart}
              onErrorChange={setDateError}
              min={today}
              quickActions={quickDateChips(today, { min: today })}
            />
            <FieldDescription>{dateError ? 'Not a usable date yet' : start ? formatMediumDate(start) : 'Type or pick a day'}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="catalog-birthday">Birthday</FieldLabel>
            <DateTextInput
              id="catalog-birthday"
              aria-label="Birthday"
              value={birthday}
              onChange={setBirthday}
              max={today}
              captionLayout="dropdown"
              autoComplete="bday"
              clearable
            />
          </Field>
        </div>
      </Specimen>
      <Specimen title="DatePicker and Calendar">
        <div className="flex w-full flex-col gap-3">
          <DatePicker aria-label="Due date" value={start} onChange={setStart} min={today} clearable />
          <Calendar mode="single" selected={day} onSelect={setDay} className="rounded-card border border-line" />
        </div>
      </Specimen>
      <Specimen title="InternationalPhoneInput">
        <Field>
          <FieldLabel htmlFor="catalog-phone">Phone number</FieldLabel>
          <InternationalPhoneInput id="catalog-phone" value={phone} onChange={setPhone} />
          <FieldDescription>Saved as {toE164(phone) ?? 'nothing yet'}. Paste “+65 8123 4567” to switch country.</FieldDescription>
        </Field>
      </Specimen>
      <Specimen title="CountryCombobox and CountryFlagIcon">
        <div className="flex w-full flex-col gap-3">
          <CountryCombobox aria-label="Country" value={country} onValueChange={setCountry} />
          <div className="flex items-center gap-2">
            <CountryFlagIcon country="JP" size="sm" />
            <CountryFlagIcon country="BR" />
            <CountryFlagIcon country="NZ" size="lg" decorative={false} />
            <span className="text-body text-ink-muted">Type “ch” in the list: Switzerland comes first.</span>
          </div>
        </div>
      </Specimen>
      <Specimen title="FileDropzone">
        <div className="flex w-full flex-col gap-3">
          <FileDropzone accept=".pdf,image/*" maxSize={10 * 1024 * 1024} onFileSelect={setFile} />
          <FileDropzone variant="compact" label="Add another file" onFileSelect={setFile} />
          {file && <span className="text-body text-ink-muted">Added: {file.name}</span>}
        </div>
      </Specimen>
    </Grid>
  )
}
