'use client'

import { Printer } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from '../controls/Button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../overlays/Tooltip'
import { usePrintDocumentReady } from './usePrintDocumentReady'

export interface PrintButtonProps {
  /** Text next to the icon. Without it the button is icon-only, and `printLabel` names it. */
  label?: string
  /**
   * For a page that builds its print copy on demand: the click calls this in place of printing, and the page
   * calls `window.print()` when the copy is ready. Show `loading` meanwhile.
   */
  onRequest?: () => void
  loading?: boolean
  /** The name of an icon-only button and the tooltip when ready. */
  printLabel?: string
  /** The tooltip while the print copy is not ready. */
  preparingLabel?: string
  className?: string
}

/**
 * Opens the browser's print dialog. It stays disabled until a `PrintDocument` on the page is ready. It is hidden
 * on a phone and on the printout itself.
 *
 *     <PrintButton label="Print" />
 */
export function PrintButton({
  label,
  onRequest,
  loading = false,
  printLabel = 'Print',
  preparingLabel = 'The print copy is not ready yet',
  className,
}: PrintButtonProps) {
  const documentReady = usePrintDocumentReady()
  const ready = onRequest ? true : documentReady

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="compact"
            disabled={!ready}
            loading={loading}
            aria-label={label ? undefined : printLabel}
            onClick={() => {
              if (onRequest) return onRequest()
              if (ready) window.print()
            }}
            className={cn('hidden md:inline-flex print:hidden', className)}
          >
            <Printer aria-hidden="true" />
            {label && <span>{label}</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent variant="standard">{ready ? printLabel : preparingLabel}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
