import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FlowFooter } from '../src/components/layout/FlowFooter'

describe('FlowFooter', () => {
  it('renders its children in a footer landmark', () => {
    render(
      <FlowFooter justify="end" width="wide">
        <button type="button">Save</button>
      </FlowFooter>,
    )
    expect(screen.getByRole('contentinfo')).toContainElement(screen.getByRole('button', { name: 'Save' }))
  })
})
