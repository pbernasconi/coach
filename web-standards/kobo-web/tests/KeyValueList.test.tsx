import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KeyValueList, useKeyValueRowDensity } from '../src/components/data/KeyValueList'
import { KeyValueRow } from '../src/components/data/KeyValueRow'

function DensityProbe() {
  return <p>density: {useKeyValueRowDensity()}</p>
}

describe('KeyValueList', () => {
  it('renders its rows', () => {
    render(
      <KeyValueList>
        <KeyValueRow label="Email" value="rosa@example.com" />
        <KeyValueRow label="Name" value="Rosa Diaz" />
      </KeyValueList>,
    )
    expect(screen.getByText('rosa@example.com')).toBeInTheDocument()
    expect(screen.getByText('Rosa Diaz')).toBeInTheDocument()
  })

  it('gives its density to the rows, compact by default', () => {
    const { rerender } = render(
      <KeyValueList>
        <DensityProbe />
      </KeyValueList>,
    )
    expect(screen.getByText('density: compact')).toBeInTheDocument()
    rerender(
      <KeyValueList density="comfortable">
        <DensityProbe />
      </KeyValueList>,
    )
    expect(screen.getByText('density: comfortable')).toBeInTheDocument()
  })
})
