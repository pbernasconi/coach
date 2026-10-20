import { CircleCheck, Inbox } from 'lucide-react'
import { Button, EmptyState, ErrorState, InlineNotice, RowsSkeleton, Skeleton, StatusPill } from '../../src'
import { Grid, Specimen } from './Specimen'

/** Status pills, notices, skeletons, and the empty and error states. */
export function FeedbackSection() {
  return (
    <Grid>
      <Specimen title="StatusPill">
        <StatusPill>Draft</StatusPill>
        <StatusPill tone="brand">New</StatusPill>
        <StatusPill tone="success" icon={<CircleCheck />}>
          Done
        </StatusPill>
        <StatusPill tone="warning">Due soon</StatusPill>
        <StatusPill tone="danger">Overdue</StatusPill>
        <StatusPill tone="info">Shared</StatusPill>
      </Specimen>
      <Specimen title="Skeleton">
        <div className="flex w-full flex-col gap-2">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-4 w-2/5" />
          <RowsSkeleton rows={2} />
        </div>
      </Specimen>
      <Specimen title="InlineNotice" wide>
        <div className="grid w-full gap-2 sm:grid-cols-2">
          <InlineNotice tone="info" title="Sync is paused">
            Changes save on this device only.
          </InlineNotice>
          <InlineNotice tone="success" title="Export ready" />
          <InlineNotice
            tone="warning"
            title="Storage is almost full"
            action={
              <Button variant="plain" size="compact" className="-ml-3">
                Free up space
              </Button>
            }
          >
            You used 92% of the space on your plan.
          </InlineNotice>
          <InlineNotice tone="danger" title="We could not save the note">
            Check the connection and try again.
          </InlineNotice>
        </div>
      </Specimen>
      <Specimen title="EmptyState">
        <EmptyState
          icon={Inbox}
          title="No notes yet"
          description="Notes you add show here."
          action={<Button size="compact">Add a note</Button>}
        />
      </Specimen>
      <Specimen title="ErrorState: retryable and permission">
        <div className="grid w-full gap-2">
          <ErrorState error={new Error('x')} title="We could not load your notes" onRetry={() => {}} />
          <ErrorState error={{ status: 403 }} title="unused" />
        </div>
      </Specimen>
    </Grid>
  )
}
