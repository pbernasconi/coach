import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TruncatedText } from '../src/components/display/TruncatedText'

function fakeWidths(scrollWidth: number, clientWidth: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scrollWidth)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(clientWidth)
}

afterEach(() => vi.restoreAllMocks())

describe('TruncatedText', () => {
  it('shows the full text in a tooltip when the line is clipped', async () => {
    fakeWidths(400, 100)
    const user = userEvent.setup()
    render(<TruncatedText>A long title for a note about the trip</TruncatedText>)
    await user.hover(screen.getByText('A long title for a note about the trip'))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('A long title for a note about the trip')
  })

  it('shows no tooltip when the text fits', async () => {
    fakeWidths(100, 100)
    const user = userEvent.setup()
    render(<TruncatedText>Short</TruncatedText>)
    await user.hover(screen.getByText('Short'))
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows an em dash for an empty value', () => {
    render(<TruncatedText>{''}</TruncatedText>)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('takes a custom empty value', () => {
    render(<TruncatedText empty="No title" />)
    expect(screen.getByText('No title')).toBeInTheDocument()
  })
})
