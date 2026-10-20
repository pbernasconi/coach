import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar, AvatarFallback, AvatarImage } from '../src/components/display/Avatar'

describe('Avatar', () => {
  it('shows the fallback initials while the picture has not loaded', () => {
    render(
      <Avatar>
        <AvatarImage src="/photo.png" alt="Ada Park" />
        <AvatarFallback>AP</AvatarFallback>
      </Avatar>,
    )
    expect(screen.getByText('AP')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Ada Park' })).not.toBeInTheDocument()
  })
})
