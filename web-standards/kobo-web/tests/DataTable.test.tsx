import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DataTable, type DataTableColumn } from '../src/components/data/DataTable'

interface FileRow {
  id: string
  name: string
  size: number
  owner: string
}

const columns: DataTableColumn<FileRow>[] = [
  { key: 'name', header: 'Name' },
  { key: 'owner', header: 'Owner' },
  { key: 'size', header: 'Size', numeric: true },
]

const files: FileRow[] = [
  { id: '1', name: 'Recipes', size: 30, owner: 'Rosa Diaz' },
  { id: '2', name: 'Trip plan', size: 10, owner: 'Ben Ito' },
  { id: '3', name: 'Garden notes', size: 20, owner: 'Ada Park' },
]

const bodyRows = () => screen.getAllByRole('row').slice(1)

describe('DataTable', () => {
  it('renders headers and the cells of every row', () => {
    render(<DataTable columns={columns} data={files} />)
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Name', 'Owner', 'Size'])
    expect(bodyRows()).toHaveLength(3)
    expect(screen.getByRole('cell', { name: 'Trip plan' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '30' })).toBeInTheDocument()
  })

  it('opens a row on click and from the keyboard', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    render(
      <DataTable columns={columns} data={files} onRowClick={onRowClick} getRowAriaLabel={(row) => `Open ${row.name}`} />,
    )
    await user.click(screen.getByRole('row', { name: 'Open Trip plan' }))
    expect(onRowClick).toHaveBeenLastCalledWith(files[1])

    screen.getByRole('row', { name: 'Open Recipes' }).focus()
    await user.keyboard('{Enter}')
    expect(onRowClick).toHaveBeenLastCalledWith(files[0])
  })

  it('makes only the rows that isRowClickable allows clickable', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    render(
      <DataTable columns={columns} data={files} onRowClick={onRowClick} isRowClickable={(row) => row.id !== '3'} />,
    )
    const [first, , third] = bodyRows()
    expect(first).toHaveAttribute('tabIndex', '0')
    expect(third).not.toHaveAttribute('tabIndex')
    if (third) await user.click(third)
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('names a clickable row "Open row N" by default', () => {
    render(<DataTable columns={columns} data={files} onRowClick={vi.fn()} />)
    expect(screen.getByRole('row', { name: 'Open row 2' })).toBeInTheDocument()
  })

  it('marks selected rows', () => {
    render(<DataTable columns={columns} data={files} isRowSelected={(row) => row.id === '2'} />)
    const [first, second] = bodyRows()
    expect(second).toHaveAttribute('data-state', 'selected')
    expect(first).not.toHaveAttribute('data-state')
  })

  it('sorts ascending, then descending, then not at all, and sets aria-sort', async () => {
    const user = userEvent.setup()
    const sortable = columns.map((column) => ({ ...column, sortable: true }))
    render(<DataTable columns={sortable} data={files} getRowKey={(row) => row.id} />)
    const sizeHeader = () => screen.getAllByRole('columnheader')[2]

    await user.click(screen.getByRole('button', { name: 'Sort by Size, ascending' }))
    expect(bodyRows().map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      'Trip plan',
      'Garden notes',
      'Recipes',
    ])
    expect(sizeHeader()).toHaveAttribute('aria-sort', 'ascending')

    await user.click(screen.getByRole('button', { name: 'Sort by Size, descending' }))
    expect(bodyRows()[0]).toHaveTextContent('Recipes')
    expect(sizeHeader()).toHaveAttribute('aria-sort', 'descending')

    await user.click(screen.getByRole('button', { name: 'Clear sorting by Size' }))
    expect(bodyRows()[0]).toHaveTextContent('Recipes')
    expect(sizeHeader()).toHaveAttribute('aria-sort', 'none')
  })

  it('starts from defaultSort', () => {
    render(<DataTable columns={columns.map((c) => ({ ...c, sortable: true }))} data={files} defaultSort={{ field: 'name', direction: 'asc' }} />)
    expect(bodyRows()[0]).toHaveTextContent('Garden notes')
  })

  it('keeps a pinned row on top, before and after a sort', async () => {
    const user = userEvent.setup()
    const sortable = columns.map((column) => ({ ...column, sortable: true }))
    render(<DataTable columns={sortable} data={files} pinRow={(row) => row.id === '3'} />)
    expect(bodyRows()[0]).toHaveTextContent('Garden notes')
    await user.click(screen.getByRole('button', { name: 'Sort by Name, ascending' }))
    await user.click(screen.getByRole('button', { name: 'Sort by Name, descending' }))
    expect(bodyRows()[0]).toHaveTextContent('Garden notes')
  })

  it('shows the default empty words, or a custom empty state, under the headers', () => {
    const { rerender } = render(<DataTable columns={columns} data={[]} />)
    expect(screen.getByRole('cell', { name: 'No results found' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()

    rerender(<DataTable columns={columns} data={[]} emptyState={<button type="button">Add a file</button>} />)
    expect(screen.getByRole('button', { name: 'Add a file' })).toBeInTheDocument()
  })

  it('renders custom cells', () => {
    render(
      <DataTable
        columns={[{ key: 'owner', header: 'Owner', render: (row: FileRow) => <strong>{row.owner.toUpperCase()}</strong> }]}
        data={files}
      />,
    )
    expect(screen.getByText('ROSA DIAZ')).toBeInTheDocument()
  })
})
