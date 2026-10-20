import { cn } from '../../lib/cn'
import { StandardTooltip } from '../overlays/StandardTooltip'
import { Avatar, AvatarFallback } from './Avatar'

export interface AvatarGroupUser {
  initials: string
  /** The full name. It is the tooltip and part of the spoken list name. */
  name?: string
}

export interface AvatarGroupProps {
  users: AvatarGroupUser[]
  /** The number of avatars to show before the "+N" chip. */
  max?: number
  size?: 'sm' | 'md'
  className?: string
  /** The list name when there are no people. */
  emptyLabel?: string
  /** The spoken name of the "+N" chip. */
  moreLabel?: (count: number) => string
}

const SIZE_CLASS = {
  sm: 'size-7 text-caption',
  md: 'size-8 text-footnote',
} as const

/**
 * A row of overlapping initials avatars with a "+N" chip. A screen reader hears one list named with
 * every name. A named avatar shows its name in a tooltip and is a tab stop for that reason.
 *
 *     <AvatarGroup users={[{ initials: 'AP', name: 'Ada Park' }, { initials: 'LM', name: 'Leo Marsh' }]} />
 */
export function AvatarGroup({
  users,
  max = 3,
  size = 'md',
  className,
  emptyLabel = 'No members',
  moreLabel = (count) => `${count} more members`,
}: AvatarGroupProps) {
  const visible = users.slice(0, max)
  const overflow = users.length - max
  const label = users.length > 0 ? users.map((user) => user.name ?? user.initials).join(', ') : emptyLabel

  return (
    <div className={cn('flex items-center', className)} role="list" aria-label={label}>
      {visible.map((user, index) => {
        const avatar = (
          <Avatar
            key={index}
            role="listitem"
            className={cn(SIZE_CLASS[size], 'border-2 border-surface', index > 0 && '-ml-2')}
            style={{ zIndex: visible.length - index }}
          >
            <AvatarFallback className={SIZE_CLASS[size]}>{user.initials}</AvatarFallback>
          </Avatar>
        )
        return user.name ? (
          <StandardTooltip key={index} content={user.name} triggerMode="description">
            {avatar}
          </StandardTooltip>
        ) : (
          avatar
        )
      })}
      {overflow > 0 && (
        <div
          role="listitem"
          aria-label={moreLabel(overflow)}
          className={cn(
            SIZE_CLASS[size],
            '-ml-2 flex shrink-0 items-center justify-center rounded-full border-2 border-surface',
            'bg-surface-raised font-semibold text-ink-muted',
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
