import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Separator } from '../src/components/display/Separator'

describe('Separator', () => {
  it('is decorative by default, so a screen reader skips it', () => {
    render(<Separator />)
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })

  it('is a separator with its orientation when it is not decorative', () => {
    render(<Separator decorative={false} orientation="vertical" />)
    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical')
  })
})
