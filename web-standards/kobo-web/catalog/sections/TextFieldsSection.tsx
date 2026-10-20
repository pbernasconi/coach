import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../src/components/controls/Button'
import { ResendCodeButton } from '../../src/components/controls/ResendCodeButton'
import { CharacterCount } from '../../src/components/fields/CharacterCount'
import { CountedTextarea } from '../../src/components/fields/CountedTextarea'
import { EmailChipsInput } from '../../src/components/fields/EmailChipsInput'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../../src/components/fields/Form'
import { Input } from '../../src/components/fields/Input'
import { LabeledField } from '../../src/components/fields/LabeledField'
import { OptionalFieldDisclosure } from '../../src/components/fields/OptionalFieldDisclosure'
import { OtpInput, PinInput } from '../../src/components/fields/OtpInput'
import { PasswordInput } from '../../src/components/fields/PasswordInput'
import { PasswordRequirements } from '../../src/components/fields/PasswordRequirements'
import { SearchInput } from '../../src/components/fields/SearchInput'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '../../src/components/fields/Select'
import { Textarea } from '../../src/components/fields/Textarea'
import { Grid, Specimen } from './Specimen'

function TaskForm() {
  const form = useForm<{ title: string }>({ defaultValues: { title: '' } })
  return (
    <Form {...form}>
      <form className="flex w-full flex-col gap-3" onSubmit={form.handleSubmit(() => form.reset())}>
        <FormField
          control={form.control}
          name="title"
          rules={{ required: 'Add a title.' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Task title</FormLabel>
              <FormControl>
                <Input placeholder="Pack for the trip" {...field} />
              </FormControl>
              <FormDescription>It shows on the task list.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="compact" className="self-start">
          Save task
        </Button>
      </form>
    </Form>
  )
}

/** Selects, search, passwords, codes, chips, counters and form bindings. */
export function TextFieldsSection() {
  const [city, setCity] = useState('')
  const [query, setQuery] = useState('')
  const [password, setPassword] = useState('')
  const [passwordFocused, setPasswordFocused] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const [code, setCode] = useState('')
  const [emails, setEmails] = useState(['sam.lee@example.com'])
  const [note, setNote] = useState('')
  const [title, setTitle] = useState('')
  const [reset, setReset] = useState(0)

  return (
    <Grid>
      <Specimen title="Select">
        <Select value={city} onValueChange={setCity}>
          <SelectTrigger aria-label="City" className="w-56">
            <SelectValue placeholder="Pick a city" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Europe</SelectLabel>
              <SelectItem value="lisbon">Lisbon</SelectItem>
              <SelectItem value="oslo">Oslo</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Asia</SelectLabel>
              <SelectItem value="kyoto">Kyoto</SelectItem>
              <SelectItem value="hanoi" disabled>
                Hanoi (full)
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Specimen>

      <Specimen title="Search">
        <SearchInput aria-label="Search recipes" placeholder="Search recipes" value={query} onChange={(e) => setQuery(e.target.value)} />
      </Specimen>

      <Specimen title="Password with requirements (inline)">
        <div className="flex w-full flex-col gap-3">
          <PasswordInput aria-label="New password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <PasswordRequirements value={password} />
        </div>
      </Specimen>

      <Specimen title="Password with requirements (popover, on focus)">
        <div ref={anchorRef} className="w-full">
          <PasswordInput
            aria-label="Password, popover"
            defaultVisible
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
          <PasswordRequirements value="" focused={passwordFocused} presentation="popover" anchorRef={anchorRef} />
        </div>
      </Specimen>

      <Specimen title="One-time code and resend">
        <div className="flex w-full flex-col items-center gap-3">
          <OtpInput autoFocus={false} resetKey={reset} onValueChange={setCode} />
          <p className="text-footnote text-ink-muted">Code so far: {code || 'none'}</p>
          <ResendCodeButton
            cooldownSeconds={5}
            destination="s•••@example.com"
            onResend={async () => {
              setReset((n) => n + 1)
            }}
          />
        </div>
      </Specimen>

      <Specimen title="PIN">
        <PinInput length={4} autoFocus={false} />
      </Specimen>

      <Specimen title="Email chips">
        <EmailChipsInput
          className="w-full"
          aria-describedby="c-share-help"
          value={emails}
          onChange={setEmails}
          maxCount={4}
          placeholder="Add an email"
        />
        <p id="c-share-help" className="text-footnote text-ink-muted">
          Share the trip with up to 4 people. Paste a list or press Enter.
        </p>
      </Specimen>

      <Specimen title="Counted textarea and a focus counter">
        <div className="flex w-full flex-col gap-4">
          <CountedTextarea aria-label="Trip note" value={note} onChange={setNote} maxLength={80} helper="Only you see this note." />
          <div className="group/character-field flex items-center gap-2">
            <Input aria-label="Recipe name" maxLength={40} value={title} onChange={(e) => setTitle(e.target.value)} />
            <CharacterCount current={title.length} max={40} />
          </div>
        </div>
      </Specimen>

      <Specimen title="Optional field and a labeled field">
        <div className="flex w-full flex-col gap-3">
          <LabeledField label="Recipe name">
            <Input placeholder="Lemon tart" />
          </LabeledField>
          <OptionalFieldDisclosure label="Note">
            <Textarea aria-label="Note" placeholder="Anything to remember" />
          </OptionalFieldDisclosure>
        </div>
      </Specimen>

      <Specimen title="Form (react-hook-form)">
        <TaskForm />
      </Specimen>
    </Grid>
  )
}
