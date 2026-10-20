'use client'

import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../overlays/Tooltip'
import { focusRing } from './Button'

/** How long the "Copied" state stays, in milliseconds. */
export const COPIED_RESET_MS = 800

export interface CopyButtonProps {
  /** The text that goes to the clipboard. */
  value: string
  className?: string
  copyLabel?: string
  copiedLabel?: string
  failedLabel?: string
}

type CopyStatus = 'idle' | 'copied' | 'failed'

/**
 * An icon button that copies a value. It shows a check and a "Copied" tooltip, and a screen reader
 * hears "Copied" (or "Could not copy") from a live region.
 *
 *     <CopyButton value={shareUrl} />
 */
export function CopyButton({
  value,
  className,
  copyLabel = 'Copy',
  copiedLabel = 'Copied',
  failedLabel = 'Could not copy',
}: CopyButtonProps) {
  const [status, setStatus] = React.useState<CopyStatus>('idle')
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  React.useEffect(() => () => clearTimeout(timer.current), [])

  const handleCopy = async () => {
    let next: CopyStatus = 'copied'
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      next = 'failed'
    }
    setStatus(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus('idle'), COPIED_RESET_MS)
  }

  const copied = status === 'copied'
  const message = status === 'copied' ? copiedLabel : status === 'failed' ? failedLabel : ''

  return (
    <>
      <TooltipProvider>
        <Tooltip open={status !== 'idle' || undefined}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? copiedLabel : copyLabel}
              className={cn(
                'inline-flex rounded-badge text-ink-muted transition-colors duration-(--motion-state) ease-standard hover:text-ink',
                focusRing,
                className,
              )}
            >
              {copied ? (
                <Check aria-hidden="true" className="size-3.5 text-success-ink" />
              ) : (
                <Copy aria-hidden="true" className="size-3.5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="px-2 py-1">
            {status === 'idle' ? copyLabel : message}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <span role="status" className="sr-only">
        {message}
      </span>
    </>
  )
}
