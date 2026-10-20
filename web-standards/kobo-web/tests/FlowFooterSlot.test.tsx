import { render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo, useState, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import {
  FlowFooterOutlet,
  FlowFooterSlotProvider,
  useFlowFooter,
  useHasFlowFooterSlot,
} from '../src/components/layout/FlowFooterSlot'

/** A step that registers a footer the way callers do: with a memoized node. */
function Registrar({ label }: { label: string }) {
  const node = useMemo(() => <div>{label}</div>, [label])
  useFlowFooter(node)
  return null
}

describe('FlowFooterSlot', () => {
  it('shows the fallback when no step registered a footer', () => {
    render(
      <FlowFooterSlotProvider>
        <FlowFooterOutlet fallback={<div>fallback footer</div>} />
      </FlowFooterSlotProvider>,
    )
    expect(screen.getByText('fallback footer')).toBeInTheDocument()
  })

  it('shows a registered footer in place of the fallback', async () => {
    render(
      <FlowFooterSlotProvider>
        <Registrar label="registered footer" />
        <FlowFooterOutlet fallback={<div>fallback footer</div>} />
      </FlowFooterSlotProvider>,
    )
    expect(await screen.findByText('registered footer')).toBeInTheDocument()
    expect(screen.queryByText('fallback footer')).not.toBeInTheDocument()
  })

  it('goes back to the fallback when the step unmounts', async () => {
    function Harness() {
      const [show, setShow] = useState(true)
      return (
        <FlowFooterSlotProvider>
          {show && <Registrar label="registered footer" />}
          <FlowFooterOutlet fallback={<div>fallback footer</div>} />
          <button type="button" onClick={() => setShow(false)}>
            hide
          </button>
        </FlowFooterSlotProvider>
      )
    }
    render(<Harness />)
    expect(await screen.findByText('registered footer')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'hide' }))
    expect(await screen.findByText('fallback footer')).toBeInTheDocument()
    expect(screen.queryByText('registered footer')).not.toBeInTheDocument()
  })

  it('swaps the footer when one step replaces another', async () => {
    function Harness() {
      const [step, setStep] = useState<'pick' | 'review'>('pick')
      return (
        <FlowFooterSlotProvider>
          {step === 'pick' ? <Registrar label="pick footer" /> : <Registrar label="review footer" />}
          <FlowFooterOutlet />
          <button type="button" onClick={() => setStep('review')}>
            next
          </button>
        </FlowFooterSlotProvider>
      )
    }
    render(<Harness />)
    expect(await screen.findByText('pick footer')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'next' }))
    expect(await screen.findByText('review footer')).toBeInTheDocument()
    expect(screen.queryByText('pick footer')).not.toBeInTheDocument()
  })

  it('tells a part whether a slot exists', () => {
    expect(renderHook(() => useHasFlowFooterSlot()).result.current).toBe(false)
    const wrapper = ({ children }: { children: ReactNode }) => <FlowFooterSlotProvider>{children}</FlowFooterSlotProvider>
    expect(renderHook(() => useHasFlowFooterSlot(), { wrapper }).result.current).toBe(true)
  })
})
