import { useState } from 'react'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet, Input, Label, Textarea } from '../../src'
import { Grid, Specimen } from './Specimen'

/** Fields, labels, help text and errors. */
export function FieldsSection() {
  const [query, setQuery] = useState('Lisbon')
  const [title, setTitle] = useState('')
  return (
    <Grid>
      <Specimen title="Field with help and a clear button">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="c-search">Search trips</FieldLabel>
            <Input
              id="c-search"
              value={query}
              placeholder="City or country"
              aria-describedby="c-search-help"
              onChange={(event) => setQuery(event.target.value)}
              onClear={() => setQuery('')}
            />
            <FieldDescription id="c-search-help">Matches the trip name and the notes.</FieldDescription>
          </Field>
          <Field>
            <Label htmlFor="c-notes" optional>
              Notes
            </Label>
            <Textarea id="c-notes" placeholder="Anything to remember" />
          </Field>
        </FieldGroup>
      </Specimen>
      <Specimen title="Required and invalid">
        <FieldSet legend="New task">
          <Field invalid={title.length === 0}>
            <FieldLabel htmlFor="c-title" required>
              Title
            </FieldLabel>
            <Input id="c-title" value={title} aria-invalid={title.length === 0} onChange={(e) => setTitle(e.target.value)} />
            <FieldError errors={title.length === 0 ? [{ message: 'Add a title.' }] : []} />
          </Field>
          <Field>
            <FieldLabel htmlFor="c-disabled">Owner</FieldLabel>
            <Input id="c-disabled" value="Sam Lee" disabled readOnly />
          </Field>
        </FieldSet>
      </Specimen>
    </Grid>
  )
}
