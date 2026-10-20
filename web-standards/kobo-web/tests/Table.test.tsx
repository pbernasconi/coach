import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '../src/components/data/Table'

describe('Table', () => {
  it('renders a named table with column headers, cells and a footer', () => {
    render(
      <Table>
        <TableCaption>Recent files</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead numeric>Size</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow data-state="selected">
            <TableCell>notes.txt</TableCell>
            <TableCell numeric>12 KB</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell numeric>12 KB</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    )
    const table = screen.getByRole('table', { name: 'Recent files' })
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Name', 'Size'])
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(within(table).getAllByRole('cell', { name: '12 KB' })).toHaveLength(2)
  })

  it('passes a ref to the table element', () => {
    let node: HTMLTableElement | null = null
    render(
      <Table ref={(element) => { node = element }}>
        <TableBody>
          <TableRow>
            <TableCell>Row</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    expect(node).toBe(screen.getByRole('table'))
  })
})
