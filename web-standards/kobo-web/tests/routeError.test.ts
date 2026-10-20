import { describe, expect, it } from 'vitest'
import { isStaleBuildError } from '../src/patterns/routeError'

describe('isStaleBuildError', () => {
  it.each([
    [Object.assign(new Error('x'), { name: 'ChunkLoadError' }), true],
    [new Error('Loading chunk 7 failed.'), true],
    [new Error('Loading CSS chunk app-shell failed'), true],
    [new TypeError('Failed to fetch dynamically imported module: /assets/notes.js'), true],
    [new TypeError('error loading dynamically imported module'), true],
    [new TypeError('Importing a module script failed.'), true],
    [new Error('Cannot read properties of undefined'), false],
    ['ChunkLoadError', false],
    [null, false],
  ])('%o → %s', (error, expected) => {
    expect(isStaleBuildError(error)).toBe(expected)
  })
})
