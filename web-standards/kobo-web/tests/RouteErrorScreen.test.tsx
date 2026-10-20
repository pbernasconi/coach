import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RouteErrorScreen } from '../src/patterns/RouteErrorScreen'

describe('RouteErrorScreen', () => {
  it('reports the error one time and resets on Try again', async () => {
    const reset = vi.fn()
    const onReport = vi.fn()
    const error = new Error('render failed')
    const { rerender } = render(<RouteErrorScreen error={error} reset={reset} onReport={onReport} />)
    rerender(<RouteErrorScreen error={error} reset={reset} onReport={(e) => onReport(e)} />)

    expect(onReport).toHaveBeenCalledTimes(1)
    expect(onReport).toHaveBeenCalledWith(error)
    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('shows a second way out when given one', () => {
    render(<RouteErrorScreen error={new Error('x')} reset={vi.fn()} secondaryAction={<a href="/">Go home</a>} />)
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/')
  })

  it('offers Reload, not Try again, for an error from an old build', async () => {
    const onReload = vi.fn()
    const error = Object.assign(new Error('Loading chunk 42 failed.'), { name: 'ChunkLoadError' })
    render(<RouteErrorScreen error={error} reset={vi.fn()} onReload={onReload} />)
    expect(screen.getByRole('heading', { name: 'A new version is available' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(onReload).toHaveBeenCalledOnce()
  })

  it('takes its own words and its own stale-build check', () => {
    render(
      <RouteErrorScreen
        error={new Error('x')}
        reset={vi.fn()}
        isStaleBuild={() => false}
        copy={{ title: 'This page stopped', retry: 'Load again' }}
      />,
    )
    expect(screen.getByRole('heading', { name: 'This page stopped' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Load again' })).toBeInTheDocument()
  })
})
