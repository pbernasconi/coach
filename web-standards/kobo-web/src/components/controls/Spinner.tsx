import { LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

const SIZE = { sm: 'size-3.5', md: 'size-4', lg: 'size-5', xl: 'size-6' } as const

export interface SpinnerProps {
  size?: keyof typeof SIZE
  className?: string
}

/**
 * The one spinning glyph. It is decorative, so a screen reader does not read it.
 * A pending button uses `<Button loading>`. A loading region uses `SkeletonRegion`, which announces the state.
 */
export function Spinner({ size = 'md', className }: SpinnerProps) {
  return <LoaderCircle aria-hidden="true" className={cn('shrink-0 animate-spin', SIZE[size], className)} />
}
