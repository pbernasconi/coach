'use client'

import { useState } from 'react'
import { MailCheck } from 'lucide-react'
import { Button } from '../../src/components/controls/Button'
import { StatusPill } from '../../src/components/feedback/StatusPill'
import { LoadingSkeleton } from '../../src/components/feedback/LoadingSkeleton'
import { StatusCard } from '../../src/components/feedback/StatusCard'
import { SuccessState } from '../../src/components/feedback/SuccessState'
import { clickableRowProps } from '../../src/components/data/clickableRow'
import { DataTable, type DataTableColumn } from '../../src/components/data/DataTable'
import { DetailPanel } from '../../src/components/data/DetailPanel'
import { FloatingSelectionBar } from '../../src/components/data/FloatingSelectionBar'
import { KeyValueList } from '../../src/components/data/KeyValueList'
import { KeyValueRow } from '../../src/components/data/KeyValueRow'
import { LoadMoreRow } from '../../src/components/data/LoadMoreRow'
import { ReviewAcknowledgement } from '../../src/components/data/ReviewAcknowledgement'
import { ReviewDisclosure } from '../../src/components/data/ReviewDisclosure'
import { ReviewSection } from '../../src/components/data/ReviewSection'
import { SortableColumnHeader } from '../../src/components/data/SortableColumnHeader'
import { ariaSort, type SortDirection } from '../../src/components/data/sortModel'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '../../src/components/data/Table'
import { Timeline } from '../../src/components/data/Timeline'
import { PageGateState } from '../../src/patterns/PageGateState'
import { RouteErrorScreen } from '../../src/patterns/RouteErrorScreen'
import { Grid, Specimen } from './Specimen'

interface FileRow {
  id: string
  name: string
  owner: string
  size: number
  status: 'Shared' | 'Private'
}

const FILES: FileRow[] = [
  { id: '1', name: 'Recipes', owner: 'Rosa Diaz', size: 30, status: 'Shared' },
  { id: '2', name: 'Trip plan', owner: 'Ben Ito', size: 12, status: 'Private' },
  { id: '3', name: 'Garden notes', owner: 'Ada Park', size: 21, status: 'Shared' },
]

const COLUMNS: DataTableColumn<FileRow>[] = [
  { key: 'name', header: 'Name', sortable: true, className: 'font-semibold' },
  { key: 'owner', header: 'Owner', sortable: true },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusPill tone={row.status === 'Shared' ? 'info' : 'neutral'}>{row.status}</StatusPill>,
  },
  { key: 'size', header: 'Size (KB)', sortable: true, numeric: true },
]

function TableSpecimen() {
  const [sort, setSort] = useState<{ field: 'name' | 'size' | null; direction: SortDirection }>({
    field: null,
    direction: 'asc',
  })
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <Table>
      <TableCaption>Files, with a sortable header and keyboard rows</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead aria-sort={ariaSort('name', sort.field, sort.direction)}>
            <SortableColumnHeader field="name" label="Name" activeField={sort.field} direction={sort.direction}
              onSortChange={(field, direction) => setSort({ field, direction })} />
          </TableHead>
          <TableHead numeric aria-sort={ariaSort('size', sort.field, sort.direction)}>
            <SortableColumnHeader field="size" label="Size" align="right" defaultDirection="desc"
              activeField={sort.field} direction={sort.direction}
              onSortChange={(field, direction) => setSort({ field, direction })} />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {FILES.map((file) => (
          <TableRow key={file.id} data-state={picked === file.id ? 'selected' : undefined}
            className="cursor-pointer" {...clickableRowProps(() => setPicked(file.id), { selected: picked === file.id })}>
            <TableCell>{file.name}</TableCell>
            <TableCell numeric>{file.size} KB</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
          <TableCell numeric>63 KB</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}

function DataTableSpecimen() {
  const [selected, setSelected] = useState<FileRow | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  return (
    <div className="flex w-full flex-col">
      <DataTable columns={COLUMNS} data={FILES} getRowKey={(row) => row.id}
        getRowAriaLabel={(row) => `Open ${row.name}`} onRowClick={setSelected}
        isRowSelected={(row) => selected?.id === row.id} pinRow={(row) => row.id === '2'} />
      <LoadMoreRow hasMore isLoading={false} onLoadMore={() => {}} count={{ loaded: 3, total: 40 }} />
      <div className="flex gap-2 pt-2">
        <Button size="compact" variant="secondary" onClick={() => setChecked(new Set(['1', '3']))}>
          Select two files
        </Button>
      </div>
      <DetailPanel open={selected !== null} onClose={() => setSelected(null)} title={selected?.name}>
        <KeyValueList>
          <KeyValueRow label="Owner" value={selected?.owner} />
          <KeyValueRow label="Size" value={`${selected?.size ?? 0} KB`} />
        </KeyValueList>
      </DetailPanel>
      <FloatingSelectionBar count={checked.size} itemNoun="file" hint="ZIP file" onDismiss={() => setChecked(new Set())}>
        <Button size="compact" onClick={() => setChecked(new Set())}>Download</Button>
      </FloatingSelectionBar>
    </div>
  )
}

function ReviewSpecimen() {
  const [agreed, setAgreed] = useState(false)
  return (
    <div className="flex w-full flex-col gap-3">
      <ReviewSection title="Trip details" onEdit={() => {}} rows={[
        { label: 'From', value: 'Lisbon' },
        { label: 'To', value: 'Porto' },
        { label: 'Note', value: 'Take the coast road and stop for lunch in Aveiro on the way north' },
      ]} />
      <ReviewAcknowledgement checked={agreed} onCheckedChange={setAgreed}>I checked the guest list.</ReviewAcknowledgement>
      <ReviewDisclosure>When you select Share, everyone on the guest list can see the trip.</ReviewDisclosure>
      <Button disabled={!agreed}>Share</Button>
    </div>
  )
}

/** Tables, sort, paging, detail panels, key-value rows, timelines, review blocks and page states. */
export function DataSection() {
  return (
    <Grid>
      <Specimen title="Table, SortableColumnHeader, clickableRowProps" wide>
        <TableSpecimen />
      </Specimen>
      <Specimen title="DataTable, LoadMoreRow, DetailPanel, FloatingSelectionBar (select a row)" wide>
        <DataTableSpecimen />
      </Specimen>
      <Specimen title="LoadMoreRow: failed and ceiling">
        <div className="flex w-full flex-col">
          <LoadMoreRow hasMore isLoading={false} error={new Error('offline')} onLoadMore={() => {}} />
          <LoadMoreRow hasMore={false} bounded isLoading={false} onLoadMore={() => {}} count={{ loaded: 500, total: 2000 }} />
        </div>
      </Specimen>
      <Specimen title="KeyValueList">
        <KeyValueList className="w-full">
          <KeyValueRow label="Email" value="rosa@example.com" />
          <KeyValueRow label="Time zone" description="Used for reminders" value="Lisbon"
            action={<Button variant="plain" size="compact">Change</Button>} />
        </KeyValueList>
      </Specimen>
      <Specimen title="Timeline">
        <Timeline steps={[
          { label: 'Booked', time: 'Jul 7, 9:00 AM', tone: 'success' },
          { label: 'Checked in', time: 'Jul 8, 6:10 AM', tone: 'success' },
          { label: 'Boarding', tone: 'info', current: true },
          { label: 'Landed', tone: 'neutral' },
        ]} />
        <Timeline variant="compact" title="Compact" steps={[
          { label: 'Sent', tone: 'success' },
          { label: 'Needs attention', tone: 'danger' },
        ]} />
      </Specimen>
      <Specimen title="ReviewSection, ReviewAcknowledgement, ReviewDisclosure">
        <ReviewSpecimen />
      </Specimen>
      <Specimen title="StatusCard">
        <StatusCard icon={MailCheck} title="We sent you a new link" action={<Button variant="outline" size="compact">Back</Button>}>
          Check your inbox.
        </StatusCard>
        <StatusCard tone="neutral" spin title="Checking your link" />
      </Specimen>
      <Specimen title="SuccessState">
        <SuccessState title="Invite sent" description="We sent an invite to rosa@example.com."
          action={<Button variant="outline" size="compact">Send another</Button>} />
      </Specimen>
      <Specimen title="LoadingSkeleton: table and profile">
        <div className="flex w-full flex-col gap-4">
          <LoadingSkeleton variant="profile" />
          <LoadingSkeleton variant="table" />
        </div>
      </Specimen>
      <Specimen title="PageGateState: denied and error">
        <div className="grid w-full gap-2">
          <PageGateState status="denied" title="Shared notes" />
          <PageGateState status="error" error={new Error('offline')} onRetry={() => {}} title="Templates" />
        </div>
      </Specimen>
      <Specimen title="RouteErrorScreen" wide>
        <RouteErrorScreen error={new Error('render failed')} reset={() => {}} className="min-h-0 w-full"
          secondaryAction={<Button variant="outline" asChild><a href="#data">Go home</a></Button>} />
      </Specimen>
    </Grid>
  )
}
