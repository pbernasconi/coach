import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The contrast gate for the coach brand in tokens.css: text on the brand fill, brand ink on the surfaces it sits on,
// and the focus ring (3:1, WCAG 1.4.11). Vitest runs from the package folder.
const css = readFileSync(resolve(process.cwd(), 'src/tokens/tokens.css'), 'utf8')

/** The hex custom properties of the first rule whose selector list starts with `selector`. */
function block(selector: string): Map<string, string> {
  const at = css.indexOf(`${selector},`)
  if (at < 0) throw new Error(`no rule ${selector}`)
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at))
  return new Map([...body.matchAll(/(--k-[\w-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1] ?? '', m[2] ?? '']))
}

function luminance(hex: string): number {
  const lin = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5)
}

function contrast(a: string | undefined, b: string | undefined): number {
  if (!a || !b) throw new Error('missing token')
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

describe('coach brand contrast', () => {
  const light = block("[data-brand='coach']")
  const dark = new Map([...light, ...block(".dark [data-brand='coach']")])

  it('keeps text on the brand fill at 4.5:1', () => {
    expect(contrast(light.get('--k-on-brand'), light.get('--k-brand'))).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps brand ink at 4.5:1 on the surface and on the wash, light and dark', () => {
    expect(contrast(light.get('--k-brand-ink'), '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrast(light.get('--k-brand-ink'), light.get('--k-brand-wash'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(dark.get('--k-brand-ink'), '#1c1c1e')).toBeGreaterThanOrEqual(4.5)
    expect(contrast(dark.get('--k-brand-ink'), dark.get('--k-brand-wash'))).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the focus ring at 3:1 on the wash', () => {
    expect(contrast(light.get('--k-ring'), light.get('--k-brand-wash'))).toBeGreaterThanOrEqual(3)
    expect(contrast(dark.get('--k-ring'), dark.get('--k-brand-wash'))).toBeGreaterThanOrEqual(3)
  })
})
