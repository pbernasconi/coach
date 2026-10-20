import { describe, expect, it, vi } from 'vitest'
import { isSidebarShortcut, resolveOpen, sidebarCookie, sidebarState } from '../src/components/navigation/sidebarState'

describe('sidebarState', () => {
  it.each([
    [true, 'expanded'],
    [false, 'collapsed'],
  ] as const)('open=%s is %s', (open, state) => {
    expect(sidebarState(open)).toBe(state)
  })

  it('builds the cookie', () => {
    expect(sidebarCookie(true)).toBe('sidebar_state=true; path=/; max-age=604800')
    expect(sidebarCookie(false, 'nav', 60)).toBe('nav=false; path=/; max-age=60')
  })

  it.each([
    [{ key: 'b', metaKey: true, ctrlKey: false }, true],
    [{ key: 'b', metaKey: false, ctrlKey: true }, true],
    [{ key: 'B', metaKey: true, ctrlKey: false }, true],
    [{ key: 'b', metaKey: false, ctrlKey: false }, false],
    [{ key: 'k', metaKey: true, ctrlKey: false }, false],
    [{ key: 'b', metaKey: true, ctrlKey: false, defaultPrevented: true }, false],
  ])('shortcut %o is %s', (event, expected) => {
    expect(isSidebarShortcut(event)).toBe(expected)
  })

  it('resolves a value or an updater', () => {
    expect(resolveOpen(false, true)).toBe(false)
    const toggle = vi.fn((open: boolean) => !open)
    expect(resolveOpen(toggle, true)).toBe(false)
    expect(toggle).toHaveBeenCalledWith(true)
  })
})
