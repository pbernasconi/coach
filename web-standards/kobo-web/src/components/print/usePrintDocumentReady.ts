'use client'

import { useEffect, useState } from 'react'

/** The class of the print root that `PrintDocument` puts on `<body>`. The print CSS keys off it. */
export const PRINT_ROOT_CLASS = 'print-root'

const DEFAULT_PRINT_READY_SELECTOR = `.${PRINT_ROOT_CLASS}[data-print-ready="true"]`

/**
 * Calls `onChange` now and every time the document gains or loses a ready print root. Returns a function that
 * stops watching.
 */
export function subscribeToPrintDocumentReady(
  onChange: (ready: boolean) => void,
  selector: string = DEFAULT_PRINT_READY_SELECTOR,
): () => void {
  const update = () => onChange(Boolean(document.querySelector(selector)))
  update()
  const observer = new MutationObserver(update)
  observer.observe(document.body, { childList: true, subtree: true, attributes: true })
  return () => observer.disconnect()
}

/** True while the page has at least one `PrintDocument` that is ready to print. */
export function usePrintDocumentReady(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => subscribeToPrintDocumentReady(setReady), [])
  return ready
}
