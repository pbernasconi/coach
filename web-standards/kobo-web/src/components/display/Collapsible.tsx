'use client'

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'

/**
 * A region that opens and closes. The trigger gets `aria-expanded` and `aria-controls`.
 *
 *     <Collapsible>
 *       <CollapsibleTrigger asChild><Button variant="plain">Show details</Button></CollapsibleTrigger>
 *       <CollapsibleContent>…</CollapsibleContent>
 *     </Collapsible>
 */
export const Collapsible = CollapsiblePrimitive.Root
export const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger
export const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent
