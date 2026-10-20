import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CharacterCount } from '../src/components/fields/CharacterCount'
import { CountedTextarea } from '../src/components/fields/CountedTextarea'

describe('CountedTextarea', () => {
  it('shows the count and passes maxLength to the textarea', () => {
    render(<CountedTextarea value="Pack" onChange={() => {}} maxLength={80} aria-label="Note" />)
    expect(screen.getByText('4/80')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveAttribute('maxlength', '80')
  })

  it('always shows the counter, and marks it at the limit', () => {
    const { rerender } = render(<CountedTextarea value={'a'.repeat(10)} onChange={() => {}} maxLength={80} />)
    expect(screen.getByText('10/80')).toBeVisible()
    expect(screen.getByText('10/80')).not.toHaveAttribute('data-at-limit')
    rerender(<CountedTextarea value={'a'.repeat(80)} onChange={() => {}} maxLength={80} />)
    expect(screen.getByText('80/80')).toHaveAttribute('data-at-limit', 'true')
  })

  it('links the help line and the counter to the textarea', () => {
    render(<CountedTextarea value="" onChange={() => {}} maxLength={80} helper="Only you see it" aria-label="Note" />)
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveAccessibleDescription('Only you see it 0/80')
  })

  it('reports the new text', () => {
    const onChange = vi.fn()
    render(<CountedTextarea value="" onChange={onChange} maxLength={80} aria-label="Note" />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), { target: { value: 'Lemons' } })
    expect(onChange).toHaveBeenCalledWith('Lemons')
  })
})

describe('CharacterCount', () => {
  it('shows the count in a polite live region', () => {
    render(<CharacterCount current={32} max={40} />)
    expect(screen.getByText('32/40')).toHaveAttribute('aria-live', 'polite')
  })
})
