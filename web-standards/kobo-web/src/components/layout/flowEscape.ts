/**
 * The Escape rule of a full-screen flow. Escape closes the flow only when nothing on top of it wants the key first.
 */

/** The roles of a layer that handles Escape itself. */
const OVERLAY_SELECTOR = '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[aria-expanded="true"]'

/** An overlay that is open anywhere in the document (Radix marks open layers with `data-state="open"`). */
const OPEN_OVERLAY_SELECTOR = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[role="listbox"]',
].join(',')

export interface EscapeEventLike {
  key: string
  defaultPrevented: boolean
  target: EventTarget | null
}

/**
 * True when this Escape press should close the flow. It is false when another handler took the key
 * (`defaultPrevented`), when focus is in an overlay or an open combobox, or when an overlay is open on top
 * (a dialog in a portal, a menu, a listbox). `root` is the flow's own element: a listbox that is part of the
 * flow's content (an inline list) does not count, but one in a portal outside it does.
 */
export function shouldCloseOnEscape(event: EscapeEventLike, doc: Document, root: Element | null = null): boolean {
  if (event.key !== 'Escape' || event.defaultPrevented) return false
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest(OVERLAY_SELECTOR)) return false
  for (const overlay of doc.querySelectorAll(OPEN_OVERLAY_SELECTOR)) {
    if (!root || !root.contains(overlay)) return false
  }
  return true
}
