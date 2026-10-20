import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

const MAX_WIDTH = {
  default: 'max-w-2xl',
  large: 'max-w-3xl',
  medium: 'max-w-4xl',
  wide: 'max-w-6xl',
} as const

export interface FlowFooterProps {
  children: ReactNode
  /** `between` puts a summary on the left and the actions on the right; `end` puts everything on the right. */
  justify?: 'between' | 'end'
  /** Match the inner width to the content column above it, so the actions line up with the content. */
  width?: keyof typeof MAX_WIDTH
}

/**
 * The pinned action bar at the bottom of a `FlowShell`. It keeps clear of the iPhone home indicator.
 * The two halves wrap when a long summary does not fit.
 *
 *     <FlowShell footer={<FlowFooter><span>3 files</span><Button>Upload</Button></FlowFooter>}>…</FlowShell>
 */
export function FlowFooter({ children, justify = 'between', width = 'default' }: FlowFooterProps) {
  return (
    <footer className="shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <div
        className={cn(
          'mx-auto flex w-full flex-wrap items-center gap-3 gap-y-2 px-4 py-4 md:px-6',
          MAX_WIDTH[width],
          justify === 'end' ? 'justify-end' : 'justify-between',
        )}
      >
        {children}
      </div>
    </footer>
  )
}
