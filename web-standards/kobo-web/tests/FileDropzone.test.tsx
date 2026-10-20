import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FileDropzone } from '../src/components/fields/FileDropzone'
import { checkFile, formatFileLimit, matchesAccept } from '../src/components/fields/fileRules'

const pdf = (size = 7) => new File(['x'.repeat(size)], 'notes.pdf', { type: 'application/pdf' })
const zone = (name: RegExp = /Drop a file here/) => screen.getByRole('button', { name })

describe('FileDropzone', () => {
  it('shows the label, the browse line and the limits', () => {
    render(<FileDropzone onFileSelect={vi.fn()} accept=".pdf,.csv" maxSize={10 * 1024 * 1024} />)
    expect(zone()).toHaveTextContent('or browse files')
    expect(zone()).toHaveTextContent('Accepted: .pdf,.csv · Max 10 MB')
  })

  it('shows a caller description in place of the limits, and hides the browse line with null', () => {
    render(<FileDropzone onFileSelect={vi.fn()} label="Add a recipe card" description="PDF, up to 10 MB" browseLabel={null} maxSize={5} />)
    const button = zone(/Add a recipe card/)
    expect(button).toHaveTextContent('PDF, up to 10 MB')
    expect(button).not.toHaveTextContent('browse files')
    expect(button).not.toHaveTextContent('Max')
  })

  it('takes a file from the picker', async () => {
    const user = userEvent.setup()
    const onFileSelect = vi.fn()
    const { container } = render(<FileDropzone onFileSelect={onFileSelect} accept=".pdf" />)
    const input = container.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('no file input')
    expect(input).toHaveAttribute('accept', '.pdf')
    const file = pdf()
    await user.upload(input, file)
    expect(onFileSelect).toHaveBeenCalledWith(file)
  })

  it('opens the picker with Enter and Space', async () => {
    const user = userEvent.setup()
    const { container } = render(<FileDropzone onFileSelect={vi.fn()} />)
    const input = container.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('no file input')
    const click = vi.spyOn(input, 'click')
    zone().focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(click).toHaveBeenCalledTimes(2)
  })

  it('takes a dropped file and says so while a file is over it', () => {
    const onFileSelect = vi.fn()
    render(<FileDropzone onFileSelect={onFileSelect} />)
    fireEvent.dragOver(zone(), { dataTransfer: { files: [] } })
    expect(screen.getByRole('button', { name: /Drop to add the file/ })).toBeInTheDocument()
    fireEvent.dragLeave(screen.getByRole('button', { name: /Drop to add the file/ }), { dataTransfer: { files: [] } })
    const file = pdf()
    fireEvent.drop(zone(), { dataTransfer: { files: [file] } })
    expect(onFileSelect).toHaveBeenCalledWith(file)
  })

  it('shows why a file is too large when there is no onReject', () => {
    const onFileSelect = vi.fn()
    render(<FileDropzone onFileSelect={onFileSelect} maxSize={100} />)
    fireEvent.drop(zone(), { dataTransfer: { files: [pdf(200)] } })
    expect(onFileSelect).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('That file is too large. The largest size is 100 bytes.')
  })

  it('rejects a dropped file of the wrong type through onReject', () => {
    const onFileSelect = vi.fn()
    const onReject = vi.fn()
    render(<FileDropzone onFileSelect={onFileSelect} onReject={onReject} accept="image/*" />)
    const file = pdf()
    fireEvent.drop(zone(), { dataTransfer: { files: [file] } })
    expect(onReject).toHaveBeenCalledWith(file, 'type')
    expect(onFileSelect).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('takes nothing while disabled', () => {
    const onFileSelect = vi.fn()
    render(<FileDropzone onFileSelect={onFileSelect} disabled />)
    expect(zone()).toBeDisabled()
    fireEvent.drop(zone(), { dataTransfer: { files: [pdf()] } })
    expect(onFileSelect).not.toHaveBeenCalled()
  })
})

describe('fileRules', () => {
  it.each([
    [10 * 1024 * 1024, '10 MB'],
    [512 * 1024, '512 KB'],
    [500, '500 bytes'],
  ])('formatFileLimit(%i) is %s', (bytes, text) => {
    expect(formatFileLimit(bytes)).toBe(text)
  })

  it.each([
    ['notes.PDF', 'application/pdf', '.pdf', true],
    ['photo.png', 'image/png', 'image/*', true],
    ['list.csv', 'text/csv', 'text/csv, .pdf', true],
    ['notes.pdf', 'application/pdf', 'image/*', false],
    ['anything.bin', '', undefined, true],
  ])('matchesAccept(%s, %s, %j) is %s', (name, type, accept, result) => {
    expect(matchesAccept({ name, type }, accept)).toBe(result)
  })

  it('checks the type before the size', () => {
    expect(checkFile({ name: 'a.txt', type: 'text/plain', size: 999 }, { accept: '.pdf', maxSize: 10 })).toBe('type')
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: 999 }, { accept: '.pdf', maxSize: 10 })).toBe('maxSize')
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: 5 }, { accept: '.pdf', maxSize: 10 })).toBeNull()
  })
})
