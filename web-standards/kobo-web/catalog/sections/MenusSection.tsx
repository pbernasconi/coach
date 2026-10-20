import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '../../src/components/controls/Button'
import { Field, FieldLabel } from '../../src/components/fields/Field'
import { Input } from '../../src/components/fields/Input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../src/components/overlays/AlertDialog'
import { ConfirmDialog } from '../../src/components/overlays/ConfirmDialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../../src/components/overlays/DropdownMenu'
import { FormDialog } from '../../src/components/overlays/FormDialog'
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../src/components/overlays/Sheet'
import { Toaster, toast } from '../../src/components/overlays/Toaster'
import { Grid, Specimen } from './Specimen'

const SIDES = ['top', 'right', 'bottom', 'left'] as const
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Sheets, alerts, menus, toasts and the form and confirm dialogs. */
export function MenusSection() {
  const [pinned, setPinned] = useState(true)
  const [sort, setSort] = useState('name')
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const save = async () => {
    setSaving(true)
    await wait(1200)
    setSaving(false)
    setFormOpen(false)
    toast.success('Trip renamed')
  }
  const remove = async () => {
    setDeleting(true)
    await wait(1200)
    setDeleting(false)
    setConfirmOpen(false)
    toast('Trip deleted', { action: { label: 'Undo', onClick: () => toast.info('Trip restored') } })
  }

  return (
    <Grid>
      <Toaster />
      <Specimen title="Sheet (each side, and a non-modal panel)">
        {SIDES.map((side) => (
          <Sheet key={side}>
            <SheetTrigger asChild>
              <Button variant="secondary">{side}</Button>
            </SheetTrigger>
            <SheetContent side={side}>
              <SheetHeader>
                <SheetTitle>Trip to Lisbon</SheetTitle>
                <SheetDescription>Three days in May with Ana and Theo.</SheetDescription>
              </SheetHeader>
              <SheetBody>
                <Field>
                  <FieldLabel htmlFor={`c-sheet-${side}`}>Name</FieldLabel>
                  <Input id={`c-sheet-${side}`} defaultValue="Trip to Lisbon" />
                </Field>
              </SheetBody>
              <SheetFooter>
                <SheetClose asChild>
                  <Button variant="secondary">Cancel</Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button>Save</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        ))}
        <Sheet modal={false}>
          <SheetTrigger asChild>
            <Button variant="outline">Side panel</Button>
          </SheetTrigger>
          <SheetContent showOverlay={false} onInteractOutside={(event) => event.preventDefault()}>
            <SheetHeader>
              <SheetTitle>Recipe notes</SheetTitle>
              <SheetDescription>The page behind stays usable.</SheetDescription>
            </SheetHeader>
            <SheetBody>Soak the beans overnight. Add salt at the end.</SheetBody>
          </SheetContent>
        </Sheet>
      </Specimen>

      <Specimen title="AlertDialog">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Delete note</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete the note?</AlertDialogTitle>
              <AlertDialogDescription>“Packing list” goes away on all your devices. You cannot undo this.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => toast('Note deleted')}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Specimen>

      <Specimen title="DropdownMenu">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="Note actions">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Note</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem>
                Rename <DropdownMenuShortcut>R</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                Duplicate <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>Share</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={pinned} onCheckedChange={setPinned}>
              Pinned
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel inset>Sort</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
              <DropdownMenuRadioItem value="name">By name</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="date">By date</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger inset>Move to</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Trips</DropdownMenuItem>
                <DropdownMenuItem>Recipes</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
        <p className="w-full text-footnote text-ink-muted">
          Pinned: {pinned ? 'yes' : 'no'} · Sort: {sort}
        </p>
      </Specimen>

      <Specimen title="Toaster (each tone)">
        <Button variant="secondary" onClick={() => toast('Draft kept')}>
          Neutral
        </Button>
        <Button variant="secondary" onClick={() => toast.success('Note saved', { description: 'It is on all your devices.' })}>
          Success
        </Button>
        <Button variant="secondary" onClick={() => toast.info('Sync is on')}>
          Info
        </Button>
        <Button variant="secondary" onClick={() => toast.warning('Storage is almost full')}>
          Warning
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.error('We could not save the note', { action: { label: 'Retry', onClick: () => toast.success('Note saved') } })}
        >
          Danger
        </Button>
        <Button variant="secondary" onClick={() => toast.promise(wait(1500), { loading: 'Uploading files', success: 'Files uploaded', error: 'Upload failed' })}>
          Loading
        </Button>
      </Specimen>

      <Specimen title="FormDialog">
        <Button variant="secondary" onClick={() => setFormOpen(true)}>
          Rename trip
        </Button>
        <FormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          title="Rename trip"
          description="The new name shows in every list."
          submitLabel="Rename"
          onSubmit={save}
          loading={saving}
          preventCloseWhileLoading
        >
          <Field>
            <FieldLabel htmlFor="c-form-name">Name</FieldLabel>
            <Input id="c-form-name" defaultValue="Trip to Lisbon" />
          </Field>
        </FormDialog>
      </Specimen>

      <Specimen title="ConfirmDialog (stays open while it works)">
        <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
          Delete trip
        </Button>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Delete the trip?"
          description="Trip to Lisbon and its notes go away. You cannot undo this."
          confirmLabel="Delete"
          variant="destructive"
          loading={deleting}
          onConfirm={remove}
        />
      </Specimen>
    </Grid>
  )
}
