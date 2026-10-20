import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ReviewAcknowledgement } from '../src/components/data/ReviewAcknowledgement'

function Harness() {
  const [checked, setChecked] = useState(false)
  return (
    <div>
      <ReviewAcknowledgement checked={checked} onCheckedChange={setChecked}>
        I checked the guest list.
      </ReviewAcknowledgement>
      <output>{checked ? 'checked' : 'unchecked'}</output>
    </div>
  )
}

describe('ReviewAcknowledgement', () => {
  it('toggles through its label and from the keyboard', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const box = screen.getByRole('checkbox', { name: 'I checked the guest list.' })
    expect(box).not.toBeChecked()

    await user.click(screen.getByText('I checked the guest list.'))
    expect(box).toBeChecked()
    expect(screen.getByText('checked')).toBeInTheDocument()

    await user.keyboard(' ')
    expect(box).not.toBeChecked()
  })
})
