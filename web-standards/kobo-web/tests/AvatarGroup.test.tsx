import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AvatarGroup } from '../src/components/display/AvatarGroup'

const users = [
  { initials: 'AP', name: 'Ada Park' },
  { initials: 'LM', name: 'Leo Marsh' },
  { initials: 'RO', name: 'Rina Oduya' },
  { initials: 'TS', name: 'Tomas Sel' },
  { initials: 'NV', name: 'Nora Vale' },
]

describe('AvatarGroup', () => {
  it('shows up to three avatars by default and a +N chip', () => {
    render(<AvatarGroup users={users} />)
    for (const initials of ['AP', 'LM', 'RO']) expect(screen.getByText(initials)).toBeInTheDocument()
    expect(screen.queryByText('TS')).not.toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('shows no chip when everyone fits', () => {
    render(<AvatarGroup users={users.slice(0, 3)} max={3} />)
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument()
  })

  it('respects a custom max', () => {
    render(<AvatarGroup users={users} max={2} />)
    expect(screen.queryByText('RO')).not.toBeInTheDocument()
    expect(screen.getByText('+3')).toBeInTheDocument()
  })

  it('shows the name in a tooltip, not a native title', async () => {
    const user = userEvent.setup()
    render(<AvatarGroup users={[{ initials: 'AP', name: 'Ada Park' }]} max={5} />)
    const avatar = screen.getByRole('listitem')
    expect(avatar).not.toHaveAttribute('title')
    await user.hover(avatar)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Ada Park')
  })

  it('is one list named with every name', () => {
    render(<AvatarGroup users={users} max={3} />)
    expect(screen.getByRole('list', { name: 'Ada Park, Leo Marsh, Rina Oduya, Tomas Sel, Nora Vale' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('names the +N chip and an empty group', () => {
    const { rerender } = render(<AvatarGroup users={users} max={3} />)
    expect(screen.getByRole('listitem', { name: '2 more members' })).toBeInTheDocument()
    rerender(<AvatarGroup users={[]} />)
    expect(screen.getByRole('list', { name: 'No members' })).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('takes custom words', () => {
    render(<AvatarGroup users={users} max={1} moreLabel={(n) => `and ${n} others`} />)
    expect(screen.getByRole('listitem', { name: 'and 4 others' })).toBeInTheDocument()
  })
})
