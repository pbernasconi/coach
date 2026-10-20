import { Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Button, Spinner } from '../../src'
import { Grid, Specimen } from './Specimen'

/** Buttons and the spinner. */
export function ControlsSection() {
  const [saving, setSaving] = useState(false)
  const save = () => {
    setSaving(true)
    setTimeout(() => setSaving(false), 1500)
  }
  return (
    <Grid>
      <Specimen title="Variants">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="tonal">Tonal</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="destructive">
          <Trash2 /> Delete
        </Button>
        <Button variant="plain">Plain</Button>
      </Specimen>
      <Specimen title="Sizes and states">
        <Button size="compact">
          <Plus /> Compact
        </Button>
        <Button size="icon" variant="secondary" aria-label="Close">
          <X />
        </Button>
        <Button size="icon-compact" variant="plain" aria-label="Add">
          <Plus />
        </Button>
        <Button disabled>Disabled</Button>
        <Button loading={saving} onClick={save}>
          {saving ? 'Saving' : 'Click to save'}
        </Button>
      </Specimen>
      <Specimen title="Spinner">
        <Spinner size="sm" />
        <Spinner />
        <Spinner size="lg" />
        <Spinner size="xl" className="text-brand-ink" />
      </Specimen>
      <Specimen title="As a link">
        <Button asChild variant="outline">
          <a href="#controls">Open the section</a>
        </Button>
      </Specimen>
    </Grid>
  )
}
