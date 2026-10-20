import { useState } from 'react'
import { Button, EmptyState, QueryBoundary, RowsSkeleton, SkeletonRegion, SkipLink, type QueryLike } from '../../src'
import { Grid, Specimen } from './Specimen'

type State = 'loading' | 'error' | 'empty' | 'ready'

const queryFor = (state: State, retry: () => void): QueryLike<string[]> => ({
  data: state === 'empty' ? [] : state === 'ready' ? ['Packing list', 'Lisbon trip', 'Recipes to try'] : undefined,
  error: state === 'error' ? new Error('offline') : null,
  isError: state === 'error',
  isFetching: false,
  refetch: retry,
})

/** QueryBoundary in its four states, SkeletonRegion and SkipLink. */
export function PatternsSection() {
  const [state, setState] = useState<State>('loading')
  return (
    <Grid>
      <Specimen title="QueryBoundary" wide>
        <div className="flex w-full flex-col gap-3">
          <div role="group" aria-label="State" className="flex flex-wrap gap-2">
            {(['loading', 'error', 'empty', 'ready'] as const).map((option) => (
              <Button key={option} size="compact" variant={state === option ? 'tonal' : 'secondary'} aria-pressed={state === option} onClick={() => setState(option)}>
                {option}
              </Button>
            ))}
          </div>
          <QueryBoundary
            query={queryFor(state, () => setState('loading'))}
            loading={<RowsSkeleton rows={3} />}
            errorTitle="We could not load your notes"
            isEmpty={(items) => items.length === 0}
            empty={<EmptyState title="No notes yet" description="Notes you add show here." />}
          >
            {(items) => (
              <ul className="divide-y divide-line">
                {items.map((item) => (
                  <li key={item} className="py-row text-body">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </QueryBoundary>
        </div>
      </Specimen>
      <Specimen title="SkeletonRegion">
        <SkeletonRegion label="Loading notes" className="w-full">
          <RowsSkeleton rows={1} />
        </SkeletonRegion>
      </Specimen>
      <Specimen title="SkipLink (press Tab on this page)">
        <SkipLink label="Skip to main content (sample)" />
        <p className="text-footnote text-ink-muted">The real one is the first element of the page.</p>
      </Specimen>
    </Grid>
  )
}
