'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PRINT_ROOT_CLASS } from './usePrintDocumentReady'

export interface PrintDocumentLayoutProps {
  title: string
  /** A line under the title, for example a reference or a date range. */
  meta?: ReactNode
  /** The logo or app name at the top left. */
  logo?: ReactNode
  /** The stamp at the top right, for example "Printed May 31, 2026, 8:00 AM". */
  printedAt: string
  /** A boxed note above the title, for example "Shared copy (read only)". */
  notice?: ReactNode
  /** The small print at the bottom, for example the legal name of the publisher. */
  footer?: ReactNode
  children: ReactNode
}

/**
 * The printed page: a header with the logo and the print stamp, the title, the body and a footer.
 * It has no hooks and no portal, so it renders as is in the catalog and in tests. Paper is always light: the
 * print CSS puts the light palette on `.print-root`.
 */
export function PrintDocumentLayout({ title, meta, logo, printedAt, notice, footer, children }: PrintDocumentLayoutProps) {
  return (
    <div className="font-sans text-body text-ink">
      <header className="mb-4 flex items-center justify-between gap-4 border-b border-line pb-3">
        <span className="flex h-8 items-center gap-2 text-title2 [&>svg]:h-full [&>svg]:w-auto">{logo}</span>
        <span className="text-footnote text-ink-muted">{printedAt}</span>
      </header>
      {notice && <p className="mb-4 border border-ink px-2 py-1 text-footnote font-semibold">{notice}</p>}
      <h1 className="text-title2">{title}</h1>
      {meta && <p className="mt-0.5 text-footnote text-ink-muted">{meta}</p>}
      <div className="mt-4">{children}</div>
      {footer && <footer className="mt-8 border-t border-line pt-3 text-footnote text-ink-muted">{footer}</footer>}
    </div>
  )
}

/** "Printed May 31, 2026, 8:00 AM" in the browser locale. */
const defaultPrintedAt = () =>
  `Printed ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`

export interface PrintDocumentProps extends Omit<PrintDocumentLayoutProps, 'printedAt'> {
  /** The print stamp. By default, "Printed" and the time now. */
  printedAt?: string
  /**
   * False while the data the page needs is not ready. The printout then shows `unavailableMessage` in place of
   * the body, and `PrintButton` stays disabled: a half-loaded page never prints.
   */
  ready?: boolean
  unavailableMessage?: string
}

/**
 * A print-only copy of the page. It renders in a portal on `<body>`, outside any scroll area, so a long list
 * prints on every page. It is hidden on screen and from screen readers (the content is already on the page);
 * the print CSS hides everything else when printing. Pair it with a `PrintButton`.
 *
 *     <PrintDocument title="Trip to Lisbon" meta="May 3 – May 9" logo={<AppLogo />} ready={!trip.isLoading}>
 *       <ItineraryTable days={trip.days} />
 *     </PrintDocument>
 */
export function PrintDocument({
  printedAt,
  ready = true,
  unavailableMessage = 'This page cannot be printed yet. Reload the page and try again.',
  children,
  ...layout
}: PrintDocumentProps) {
  const [mounted, setMounted] = useState(false)
  // createPortal needs document.body, which the server does not have.
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <div className={PRINT_ROOT_CLASS} data-print-ready={ready ? 'true' : 'false'} aria-hidden="true">
      {ready ? (
        <PrintDocumentLayout printedAt={printedAt ?? defaultPrintedAt()} {...layout}>
          {children}
        </PrintDocumentLayout>
      ) : (
        <p className="p-8 text-center text-body font-semibold text-ink">{unavailableMessage}</p>
      )}
    </div>,
    document.body,
  )
}
