'use client'

import * as React from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from '../controls/Button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../overlays/Tooltip'
import { shouldCloseOnEscape } from './flowEscape'

export interface FlowShellProps {
  /** The name of the flow, after the brand in the header. */
  title?: string
  /** A logo or app name at the left of the header, for example a link home. */
  brand?: React.ReactNode
  children: React.ReactNode
  /** The pinned footer (a `FlowFooter` or a `FlowFooterOutlet`). It stays outside the scroll area. */
  footer?: React.ReactNode
  /** Closes the flow. The close button and Escape call it, after `beforeClose`. */
  onClose: () => void
  /**
   * Guards the close button and Escape. Return false (or a promise of false) to stay in the flow, for example
   * after a `useConfirm()` about unsaved work. The in-flow Back is not guarded here.
   */
  beforeClose?: () => boolean | Promise<boolean>
  /** Shows a Back button at the very left of the header. Connect it to the step logic of the flow. */
  onBack?: () => void
  /** The name of the Back button. Name the real destination when you can. */
  backLabel?: string
  /** The name of the close button. Name the flow when you can ("Close new trip"). */
  closeLabel?: string
  /** A left rail beside the content, for example the step list of a wizard. */
  leftRail?: React.ReactNode
  /** Replaces the brand and title block at the left of the header. */
  headerStart?: React.ReactNode
  /** Shows at the right of the header, before the close button. */
  headerEnd?: React.ReactNode
  /** A notice under the header, above the content (an `InlineNotice` or a banner). */
  notice?: React.ReactNode
  className?: string
}

/**
 * The full-screen frame of a task flow: a header with Back and Close, a scrolling `main`, and a pinned footer.
 * Escape closes the flow through the same guard as the close button, but only when no dialog, menu or listbox is
 * open on top: Escape closes that first.
 *
 *     <FlowShell title="New trip" onClose={exit} beforeClose={confirmDiscard} footer={<FlowFooter>…</FlowFooter>}>
 *       <StepHeader title="Where to?" />
 *     </FlowShell>
 */
export function FlowShell({
  title,
  brand,
  children,
  footer,
  onClose,
  beforeClose,
  onBack,
  backLabel = 'Back',
  closeLabel = 'Close',
  leftRail,
  headerStart,
  headerEnd,
  notice,
  className,
}: FlowShellProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)

  const handleClose = async () => {
    if (beforeClose && !(await beforeClose())) return
    onClose()
  }

  // The listener lives for the whole mount and calls the newest close handler through this ref.
  const closeRef = React.useRef(handleClose)
  React.useEffect(() => {
    closeRef.current = handleClose
  })
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (shouldCloseOnEscape(event, document, rootRef.current)) void closeRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const main = <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>

  return (
    <div ref={rootRef} className={cn('flex h-dvh flex-col overflow-hidden bg-canvas text-ink', className)}>
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          {onBack && (
            <Button variant="outline" size="compact" className="gap-1.5" aria-label={backLabel} onClick={onBack}>
              <ArrowLeft aria-hidden="true" />
              Back
            </Button>
          )}
          {headerStart ?? (
            <>
              {brand && <span className="flex shrink-0 items-center text-body font-semibold">{brand}</span>}
              {brand && title && (
                <span aria-hidden="true" className="text-ink-faint">
                  |
                </span>
              )}
              {title && <span className="truncate text-body font-semibold">{title}</span>}
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {headerEnd}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" aria-label={closeLabel} onClick={() => void handleClose()}>
                  <X aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                sideOffset={8}
                variant="standard"
                className="border-b-2 bg-surface-raised font-semibold tracking-wide text-ink-muted"
              >
                Esc
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>
      {notice}
      {leftRail ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {leftRail}
          {main}
        </div>
      ) : (
        main
      )}
      {footer}
    </div>
  )
}
