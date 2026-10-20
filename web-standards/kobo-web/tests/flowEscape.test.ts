import { afterEach, describe, expect, it } from 'vitest'
import { shouldCloseOnEscape } from '../src/components/layout/flowEscape'

const press = (target: Element, overrides: Partial<{ key: string; defaultPrevented: boolean }> = {}) => ({
  key: 'Escape',
  defaultPrevented: false,
  target,
  ...overrides,
})

const mount = (html: string) => {
  document.body.innerHTML = html
}

describe('shouldCloseOnEscape', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it.each([
    ['Escape on the page', '<div id="root"><input id="t" /></div>', {}, true],
    ['another key', '<div id="root"><input id="t" /></div>', { key: 'Enter' }, false],
    ['a key another handler took', '<div id="root"><input id="t" /></div>', { defaultPrevented: true }, false],
    ['focus in a dialog', '<div id="root"></div><div role="dialog"><button id="t"></button></div>', {}, false],
    ['focus in an alert dialog', '<div id="root"></div><div role="alertdialog"><button id="t"></button></div>', {}, false],
    ['focus on an open combobox', '<div id="root"><input id="t" aria-expanded="true" /></div>', {}, false],
    [
      'an open menu in a portal',
      '<div id="root"><button id="t"></button></div><div role="menu" data-state="open"></div>',
      {},
      false,
    ],
    [
      'a closed dialog left in the document',
      '<div id="root"><button id="t"></button></div><div role="dialog" data-state="closed"></div>',
      {},
      true,
    ],
    ['an inline listbox in the flow', '<div id="root"><button id="t"></button><ul role="listbox"></ul></div>', {}, true],
  ])('%s', (_, html, overrides, expected) => {
    mount(html)
    const target = document.getElementById('t')
    if (!target) throw new Error('no target')
    expect(shouldCloseOnEscape(press(target, overrides), document, document.getElementById('root'))).toBe(expected)
  })
})
