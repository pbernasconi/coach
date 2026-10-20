'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/** The chart point under the cursor, shared by the stream charts and the map (both use the same series points). */
type Hover = { index: number | null; setIndex: (i: number | null) => void };

const HoverContext = createContext<Hover>({ index: null, setIndex: () => {} });

export function ActivityHoverProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState<number | null>(null);
  const value = useMemo(() => ({ index, setIndex }), [index]);
  return <HoverContext.Provider value={value}>{children}</HoverContext.Provider>;
}

export const useActivityHover = () => useContext(HoverContext);
