import { describe, expect, it } from 'vitest'
import { cn } from '../src/lib/cn'

describe('cn', () => {
  it('keeps a type role and a text colour together', () => {
    expect(cn('text-title', 'text-ink')).toBe('text-title text-ink')
    expect(cn('text-ink-muted text-footnote')).toBe('text-ink-muted text-footnote')
  })
  it('lets a later type role win over an earlier one', () => {
    expect(cn('text-body', 'text-title')).toBe('text-title')
  })
  it('lets a later text colour win over an earlier one', () => {
    expect(cn('text-ink', 'text-danger-ink')).toBe('text-danger-ink')
  })
  it('resolves the radius, shadow and layer tokens', () => {
    expect(cn('rounded-control', 'rounded-card')).toBe('rounded-card')
    expect(cn('shadow-card', 'shadow-float')).toBe('shadow-float')
    expect(cn('z-modal', 'z-toast')).toBe('z-toast')
  })
})
