import type { KeyboardEvent, MouseEvent } from 'react'

const INTERACTIVE = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[contenteditable="true"]',
  '[data-row-interactive="true"]',
].join(', ')

const isInteractiveTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(INTERACTIVE) !== null

const hasTextSelectionWithin = (element: Element): boolean => {
  const selection = window.getSelection()
  if (selection === null || selection.isCollapsed) return false
  return element.contains(selection.anchorNode) || element.contains(selection.focusNode)
}

export interface ClickableRowProps {
  tabIndex: 0
  onClick: (event: MouseEvent) => void
  onKeyDown: (event: KeyboardEvent) => void
  'aria-selected'?: boolean
}

/**
 * The props that make a table row work with a mouse and a keyboard: `<tr {...clickableRowProps(open)}>`.
 *
 * - It does not set `role="button"`. On a `<tr>` that replaces the `row` role, and a screen reader loses the
 *   row and column links of the table.
 * - A click on a control in the row (a button, a link, a checkbox) or a text selection does not open the row.
 * - Enter and Space open the row only when the row itself has focus. Space would page down the scroll
 *   container, and Enter could click the control that opens next, so both have their default prevented.
 * - Pass `selected` only for a row in a selection table. A row that opens a page is not "selected".
 */
export function clickableRowProps(activate: () => void, options?: { selected?: boolean }): ClickableRowProps {
  return {
    tabIndex: 0,
    onClick: (event) => {
      if (isInteractiveTarget(event.target) || hasTextSelectionWithin(event.currentTarget)) return
      activate()
    },
    onKeyDown: (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      if (event.target !== event.currentTarget) return
      event.preventDefault()
      activate()
    },
    ...(options?.selected === undefined ? {} : { 'aria-selected': options.selected }),
  }
}
