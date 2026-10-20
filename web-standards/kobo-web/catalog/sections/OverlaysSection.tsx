import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldLabel,
  Input,
  useConfirm,
} from '../../src'
import { Grid, Specimen } from './Specimen'

/** The dialog and the confirm flows. */
export function OverlaysSection() {
  const confirm = useConfirm()
  const [answer, setAnswer] = useState('—')
  const askPlain = async () => setAnswer(String(await confirm({ title: 'Delete the note?', description: 'You cannot undo this.', destructive: true, confirmLabel: 'Delete' })))
  const askReason = async () => {
    const result = await confirm({ title: 'Archive the trip?', reason: { label: 'Reason', required: true, minLength: 5 } })
    setAnswer(result.confirmed ? `archived: ${result.reason}` : 'cancelled')
  }
  const askWord = async () =>
    setAnswer(String(await confirm({ title: 'Delete the workspace?', destructive: true, typedWord: { label: 'Type DELETE to continue', expected: 'DELETE' } })))

  return (
    <Grid>
      <Specimen title="Dialog (full screen on a phone)">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Rename note</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename note</DialogTitle>
              <DialogDescription>The new name shows in every list.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <Field>
                <FieldLabel htmlFor="c-rename">Name</FieldLabel>
                <Input id="c-rename" defaultValue="Packing list" />
              </Field>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button>Save</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Specimen>
      <Specimen title="useConfirm">
        <Button variant="destructive" onClick={askPlain}>
          Delete
        </Button>
        <Button variant="secondary" onClick={askReason}>
          With a reason
        </Button>
        <Button variant="outline" onClick={askWord}>
          Type to confirm
        </Button>
        <p className="w-full text-footnote text-ink-muted">Answer: {answer}</p>
      </Specimen>
    </Grid>
  )
}
