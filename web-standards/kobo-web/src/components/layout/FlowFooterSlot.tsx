'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// A flow has one pinned footer, outside the scroll area. A deep step sometimes owns the state the footer needs.
// The step registers the footer with useFlowFooter, and the FlowFooterOutlet in the shell's footer slot shows it,
// so the parent does not have to lift that state.

type FooterSetter = (node: ReactNode) => void

const SetFooterContext = createContext<FooterSetter | null>(null)
const FooterNodeContext = createContext<ReactNode>(null)

/**
 * Holds the footer that a step registers. Put it around the `FlowShell`.
 *
 *     <FlowFooterSlotProvider>
 *       <FlowShell footer={<FlowFooterOutlet />}><Steps /></FlowShell>
 *     </FlowFooterSlotProvider>
 */
export function FlowFooterSlotProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode>(null)
  return (
    <SetFooterContext.Provider value={setNode}>
      <FooterNodeContext.Provider value={node}>{children}</FooterNodeContext.Provider>
    </SetFooterContext.Provider>
  )
}

/** Shows the footer a step registered, or `fallback` when no step has one. Put it in the `footer` of `FlowShell`. */
export function FlowFooterOutlet({ fallback = null }: { fallback?: ReactNode }) {
  const node = useContext(FooterNodeContext)
  return <>{node ?? fallback}</>
}

/**
 * True inside a `FlowFooterSlotProvider`. A part that can show in a flow or on a plain page uses it to choose:
 * register its actions in the slot, or show its own footer in place.
 */
export function useHasFlowFooterSlot(): boolean {
  return useContext(SetFooterContext) !== null
}

/**
 * Registers the pinned footer from a step. Pass a memoized node (`useMemo`), so the effect runs again only when
 * the footer changes. The slot clears when the step unmounts.
 *
 *     const footer = useMemo(() => <FlowFooter><Button onClick={save}>Save</Button></FlowFooter>, [save])
 *     useFlowFooter(footer)
 */
export function useFlowFooter(node: ReactNode) {
  const setFooter = useContext(SetFooterContext)
  useEffect(() => {
    if (!setFooter) return
    setFooter(node)
    return () => setFooter(null)
  }, [setFooter, node])
}
