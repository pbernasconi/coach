// Keyboard shortcuts: which key press runs which shortcut. Pure, so node --test can check it
// (src/components/hotkeys/HotkeysProvider.tsx does the listening).

/** The navigation keys on every page: 1–6 open the nav sections in their order; t opens today's plan. */
export const NAV_KEYS = [
  { key: '1', href: '/', label: 'Performance' },
  { key: '2', href: '/plan', label: 'Plan' },
  { key: '3', href: '/lift', label: 'Lift' },
  { key: '4', href: '/goals', label: 'Goals' },
  { key: '5', href: '/health', label: 'Health' },
  { key: '6', href: '/settings', label: 'Settings' },
];

/**
 * True when a key press must not run a shortcut: a modifier is held (Cmd-T, Ctrl-K… stay the browser's), the
 * person is typing (input, textarea, select, contenteditable), the key repeats, or a dialog other than the help
 * is open (it has its own keys).
 * @param {{ key: string, metaKey?: boolean, ctrlKey?: boolean, altKey?: boolean, repeat?: boolean, isComposing?: boolean }} e
 * @param {{ tagName?: string, isContentEditable?: boolean } | null} target
 * @param {boolean} dialogOpen
 */
export function ignoreKey(e, target, dialogOpen) {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || e.isComposing) return true;
  const tag = String(target?.tagName ?? '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return true;
  return dialogOpen;
}

/**
 * The shortcut for a key: the page's own first (the newest registration wins), then the global ones.
 * Letters match in either case; "?" matches Shift-/.
 * @template T
 * @param {string} key KeyboardEvent.key
 * @param {{ key: string }[][]} pages shortcut lists, oldest first
 * @param {{ key: string }[]} globals
 * @returns {T | null}
 */
export function findShortcut(key, pages, globals) {
  const k = key.length === 1 ? key.toLowerCase() : key;
  for (let i = pages.length - 1; i >= 0; i--) {
    const hit = pages[i].find((s) => s.key === k);
    if (hit) return /** @type {T} */ (hit);
  }
  return /** @type {T | null} */ (globals.find((s) => s.key === k) ?? null);
}
